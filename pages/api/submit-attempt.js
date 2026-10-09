/**
 * POST /api/submit-attempt
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body:    { attempt: <the evaluated scorecard> }
 *
 * Saves a finished test and does everything that must happen because of it, in
 * ONE transaction, on the server:
 *
 *   1. writes the attempt to test_attempts
 *   2. uses up one test of the student's quota (or records a free-test attempt)
 *   3. folds the result into the student's ranking stats
 *
 * Why this is a server route: steps 2 and 3 change fields the security rules
 * forbid a browser from writing (remainingTests, completedTests,
 * freeTestAttempts). The old client-side calls were rejected by those rules —
 * silently, inside a try/catch — so since the rules went live a finished test
 * never reduced anyone's quota and free-test limits were never enforced.
 *
 * Scoring itself is still done in the browser, by product decision (unproctored
 * practice exams). What the server does NOT take from the browser: who the
 * student is (the ID token), whether the exam is a free test (the exam
 * document), the percentage (recomputed from marks), or any field outside the
 * whitelist below.
 *
 * Idempotent on the attempt id: a retry, or a timer auto-submit racing a manual
 * submit, finds the attempt already saved and changes nothing — so quota can't
 * be used twice for one test.
 */
import { adminDb, verifyCaller } from '../../lib/firebaseAdmin.js';
import { applyAttemptToStats } from '../../lib/ranking.js';

const ALLOWED_FIELDS = [
    'sessionId', 'examId', 'examName', 'examCode',
    'totalQuestions', 'totalMarks', 'attemptedCount', 'unattemptedCount',
    'correctCount', 'wrongCount', 'grossScore', 'negativeDeduction',
    'finalScore', 'accuracy', 'passed', 'timeTakenSeconds', 'detailedReview'
];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const caller = await verifyCaller(req);
    if (!caller) {
        res.status(401).json({ error: 'Sign in required.' });
        return;
    }
    const uid = caller.uid;

    const input = req.body && req.body.attempt;
    if (!input || typeof input !== 'object' || !input.examId) {
        res.status(400).json({ error: 'A scorecard is required.' });
        return;
    }

    const totalMarks = num(input.totalMarks);
    const finalScore = num(input.finalScore);
    if (totalMarks <= 0 || finalScore < 0 || finalScore > totalMarks) {
        res.status(400).json({ error: 'The scorecard marks are not valid.' });
        return;
    }

    const attemptId = String(input.id || '').trim() || `SUB-${Date.now().toString(36).toUpperCase()}`;
    if (!/^[A-Za-z0-9_-]{4,80}$/.test(attemptId)) {
        res.status(400).json({ error: 'Invalid attempt id.' });
        return;
    }

    try {
        const examSnap = await adminDb.collection('exams').doc(String(input.examId)).get();
        if (!examSnap.exists) {
            res.status(400).json({ error: 'Unknown exam.' });
            return;
        }
        const isFreeTest = !!examSnap.data().isFreeTest;

        const attemptRef = adminDb.collection('test_attempts').doc(attemptId);
        const userRef = adminDb.collection('users').doc(uid);
        const statsRef = adminDb.collection('student_stats').doc(uid);

        const outcome = await adminDb.runTransaction(async (tx) => {
            const [existing, userSnap, statsSnap] = await Promise.all([
                tx.get(attemptRef), tx.get(userRef), tx.get(statsRef)
            ]);

            if (existing.exists) {
                if (existing.data().studentId !== uid) return { conflict: true };
                return { alreadySaved: true };
            }
            if (!userSnap.exists) return { noProfile: true };
            const user = userSnap.data();

            // Only whitelisted fields, so the browser cannot smuggle extra data in.
            const clean = {};
            for (const key of ALLOWED_FIELDS) {
                if (input[key] !== undefined) clean[key] = input[key];
            }
            const percentage = Math.round((finalScore / totalMarks) * 1000) / 10;
            const paperType = input.paperType === 'subject' ? 'subject' : 'full';

            const attempt = {
                ...clean,
                id: attemptId,
                studentId: uid,
                studentName: user.name || '',
                studentEmail: user.email || '',
                percentage,
                paperType,
                isFreeTest,
                submittedAt: new Date().toISOString()
            };
            tx.set(attemptRef, attempt);

            // Quota. Same rule as before: a paid test uses one test if any are
            // left; a free test is counted against the exam's free-attempt limit.
            const profileUpdate = { updatedAt: new Date().toISOString() };
            if (isFreeTest) {
                profileUpdate.freeTestAttempts = {
                    ...(user.freeTestAttempts || {}),
                    [attempt.examId]: num((user.freeTestAttempts || {})[attempt.examId]) + 1
                };
            } else if (num(user.remainingTests) > 0) {
                profileUpdate.remainingTests = num(user.remainingTests) - 1;
                profileUpdate.completedTests = num(user.completedTests) + 1;
            }
            tx.update(userRef, profileUpdate);

            // Ranking standings (full papers only — see lib/ranking.js).
            const nextStats = applyAttemptToStats(
                statsSnap.exists ? statsSnap.data() : { uid },
                attempt,
                { isFreeTest, name: user.name || '' }
            );
            tx.set(statsRef, { ...nextStats, updatedAt: new Date().toISOString() });

            return { saved: true };
        });

        if (outcome.conflict) {
            res.status(409).json({ error: 'This attempt id belongs to another student.' });
            return;
        }
        if (outcome.noProfile) {
            res.status(409).json({ error: 'Your student profile could not be found.' });
            return;
        }

        res.status(200).json({ success: true, attemptId, alreadySaved: !!outcome.alreadySaved });
    } catch (err) {
        console.error('[submit-attempt] Failed:', err);
        res.status(500).json({ error: 'Could not save your result. Please try again.' });
    }
}
