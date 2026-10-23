/**
 * POST /api/report-question
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body:    { questionId, reason, note?, examId? }
 *
 * A student flags a question that looks wrong (a mistake in the question or an
 * option, a wrong answer key, a missing figure...). It lands in
 * question_reports, which the admin "Reported Questions" tab lists — so the admin
 * works through only the flagged questions instead of searching the whole bank.
 *
 * Done on the server, not by a direct browser write, because:
 *   - one student must not be able to bury the admin in reports, so each student
 *     is limited to DAILY_LIMIT reports a day;
 *   - the subject and a snippet of the question are copied from the question
 *     itself, so a report cannot be made to say something it is not about;
 *   - who reported it comes from the ID token, never from the request.
 *
 * One report per student per question: reporting the same open question again
 * changes nothing. If the admin has already closed the earlier report and the
 * student still thinks it is wrong, a new report is accepted.
 */
import { adminDb, verifyCaller } from '../../lib/firebaseAdmin.js';

const REASONS = ['wrong_answer', 'wrong_question', 'wrong_option', 'unclear', 'other'];
const DAILY_LIMIT = 30;

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

    const body = req.body || {};
    const questionId = typeof body.questionId === 'string' ? body.questionId.trim() : '';
    const reason = body.reason;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    const examId = typeof body.examId === 'string' ? body.examId.trim().slice(0, 80) : '';

    if (!questionId || questionId.length > 120 || questionId.includes('/')) {
        res.status(400).json({ error: 'A question is required.' });
        return;
    }
    if (!REASONS.includes(reason)) {
        res.status(400).json({ error: 'Please choose what is wrong with the question.' });
        return;
    }

    try {
        const [questionSnap, profileSnap] = await Promise.all([
            adminDb.collection('questions').doc(questionId).get(),
            adminDb.collection('users').doc(uid).get()
        ]);
        if (!questionSnap.exists) {
            res.status(404).json({ error: 'That question could not be found.' });
            return;
        }
        const question = questionSnap.data();
        const studentName = profileSnap.exists ? (profileSnap.data().name || '') : '';

        const now = new Date();
        const day = now.toISOString().slice(0, 10);
        const reportRef = adminDb.collection('question_reports').doc(`${questionId}_${uid}`);
        const limitRef = adminDb.collection('report_limits').doc(`${uid}_${day}`);

        const outcome = await adminDb.runTransaction(async (tx) => {
            const [existing, limitSnap] = await Promise.all([tx.get(reportRef), tx.get(limitRef)]);

            if (existing.exists && existing.data().status === 'open') return { alreadyReported: true };

            const used = limitSnap.exists ? Number(limitSnap.data().count || 0) : 0;
            if (used >= DAILY_LIMIT) return { tooMany: true };

            tx.set(reportRef, {
                questionId,
                subjectCode: question.subjectCode || '',
                questionText: String(question.text || '').slice(0, 300),
                studentId: uid,
                studentName,
                reason,
                note,
                examId,
                status: 'open',
                createdAt: now.toISOString()
            });
            tx.set(limitRef, { uid, date: day, count: used + 1 });
            return { saved: true };
        });

        if (outcome.tooMany) {
            res.status(429).json({ error: 'You have sent a lot of reports today. Please try again tomorrow.' });
            return;
        }
        res.status(200).json({ success: true, alreadyReported: !!outcome.alreadyReported });
    } catch (err) {
        console.error('[report-question] Failed:', err.code || '', err.message || err);
        res.status(500).json({ error: 'Could not send your report. Please try again.' });
    }
}
