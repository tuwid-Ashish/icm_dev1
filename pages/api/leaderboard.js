/**
 * POST /api/leaderboard
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body:    { examId, attemptId?, finalScore?, timeTakenSeconds?, totalMarks?, accuracy? }
 *
 * Returns the caller's rank for one exam plus an anonymised top-10.
 *
 * The scorecard used to compute this in the browser by reading the ENTIRE
 * test_attempts collection — which meant every student could read every other
 * student's uid, email, score and full answer-by-answer review. The ranking
 * only ever needed scores and display names, so it happens here instead and
 * the collection stops being world-readable to signed-in users.
 *
 * Nothing identifying leaves this route: no uid, no email, no per-question
 * review. Just the display name that a leaderboard is for.
 */
import { adminDb, verifyCaller } from '../../lib/firebaseAdmin.js';

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

    const { examId, attemptId, finalScore, timeTakenSeconds, totalMarks, accuracy } = req.body || {};
    if (!examId) {
        res.status(400).json({ error: 'examId is required.' });
        return;
    }

    try {
        const snap = await adminDb
            .collection('test_attempts')
            .where('examId', '==', String(examId))
            .get();

        const rows = snap.docs.map(d => {
            const a = d.data();
            return {
                id: d.id,
                studentId: a.studentId || '',
                name: a.studentName || 'Student',
                finalScore: Number(a.finalScore || 0),
                totalMarks: Number(a.totalMarks || 0),
                accuracy: Number(a.accuracy || 0),
                timeTakenSeconds: Number(a.timeTakenSeconds || 0)
            };
        });

        // The attempt may not have landed in Firestore yet when the scorecard
        // renders. Fold it in transiently so the rank is right either way.
        const alreadyThere = attemptId && rows.some(r => r.id === attemptId);
        if (!alreadyThere && finalScore !== undefined) {
            rows.push({
                id: attemptId || '__current__',
                studentId: caller.uid,
                name: 'You',
                finalScore: Number(finalScore || 0),
                totalMarks: Number(totalMarks || 0),
                accuracy: Number(accuracy || 0),
                timeTakenSeconds: Number(timeTakenSeconds || 0)
            });
        }

        rows.sort((a, b) =>
            b.finalScore !== a.finalScore
                ? b.finalScore - a.finalScore
                : a.timeTakenSeconds - b.timeTakenSeconds
        );

        const isCaller = (r) =>
            (attemptId && r.id === attemptId) || r.id === '__current__' || r.studentId === caller.uid;

        const rankIdx = rows.findIndex(isCaller);

        res.status(200).json({
            totalCandidates: rows.length,
            userRank: rankIdx === -1 ? 1 : rankIdx + 1,
            topperScore: rows.length ? rows[0].finalScore : Number(finalScore || 0),
            // Display name and score only — deliberately no uid, no email.
            topRankers: rows.slice(0, 10).map((r, idx) => ({
                rank: idx + 1,
                name: r.name,
                finalScore: r.finalScore,
                totalMarks: r.totalMarks,
                accuracy: r.accuracy,
                isYou: isCaller(r)
            }))
        });
    } catch (err) {
        console.error('[leaderboard] Failed:', err);
        res.status(500).json({ error: 'Could not load the leaderboard.' });
    }
}
