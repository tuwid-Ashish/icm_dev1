/**
 * POST /api/leaderboard
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body:    { examId }
 *
 * Returns the caller's standing for one exam and overall, plus that exam's
 * top 10. Rules of the ranking are in lib/ranking.js: one row per student,
 * average percentage over full papers, ties share a rank.
 *
 * Reads the per-student `student_stats` documents that /api/submit-attempt
 * keeps up to date. A rank is "how many students are ahead of me + 1", answered
 * with count queries, so a scorecard costs about a dozen reads however many
 * attempts exist. The previous version read every attempt for the exam on
 * every scorecard, and ranked attempts rather than students.
 *
 * Nothing identifying leaves this route: no uid, no email. Just display names.
 */
import { FieldPath } from 'firebase-admin/firestore';
import { adminDb, verifyCaller } from '../../lib/firebaseAdmin.js';
import { RANKING_METRIC, rankFromAhead } from '../../lib/ranking.js';

const TOP_N = 10;

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

    const examId = String((req.body || {}).examId || '').trim();
    if (!examId) {
        res.status(400).json({ error: 'examId is required.' });
        return;
    }

    try {
        const stats = adminDb.collection('student_stats');
        const mineSnap = await stats.doc(caller.uid).get();
        const mine = mineSnap.exists ? mineSnap.data() : {};
        const myExam = mine.exams && mine.exams[examId];
        const myOverall = mine.overall;

        // FieldPath, not a dotted string: an exam id containing a dot or dash
        // would otherwise be read as a path separator.
        const examRankField = new FieldPath('exams', examId, 'rankPct');
        const examCountField = new FieldPath('exams', examId, 'count');

        const [examTotal, examAhead, overallTotal, overallAhead, topSnap] = await Promise.all([
            stats.where(examCountField, '>', 0).count().get(),
            myExam && myExam.count > 0
                ? stats.where(examRankField, '>', myExam.rankPct).count().get()
                : Promise.resolve(null),
            stats.where('overall.count', '>', 0).count().get(),
            myOverall && myOverall.count > 0
                ? stats.where('overall.rankPct', '>', myOverall.rankPct).count().get()
                : Promise.resolve(null),
            stats.orderBy(examRankField, 'desc').limit(TOP_N).get()
        ]);

        const topDocs = topSnap.docs.filter(d => d.data().exams?.[examId]?.count > 0);

        // Competition ranking for the list too, so tied students show the same
        // number as the one the student sees on their own card.
        let lastPct = null;
        let lastRank = 0;
        const topRankers = topDocs.map((d, idx) => {
            const data = d.data();
            const bucket = data.exams[examId];
            const rank = bucket.rankPct === lastPct ? lastRank : idx + 1;
            lastPct = bucket.rankPct;
            lastRank = rank;
            return {
                rank,
                name: data.name || 'Student',
                avgPct: bucket.avgPct,
                bestPct: bucket.bestPct,
                papers: bucket.count,
                isYou: d.id === caller.uid
            };
        });

        res.status(200).json({
            metric: RANKING_METRIC,
            exam: {
                ranked: !!(myExam && myExam.count > 0),
                rank: examAhead ? rankFromAhead(examAhead.data().count) : null,
                totalStudents: examTotal.data().count,
                myAvgPct: myExam ? myExam.avgPct : null,
                myBestPct: myExam ? myExam.bestPct : null,
                myPapers: myExam ? myExam.count : 0,
                topAvgPct: topRankers.length ? topRankers[0].avgPct : null
            },
            overall: {
                ranked: !!(myOverall && myOverall.count > 0),
                rank: overallAhead ? rankFromAhead(overallAhead.data().count) : null,
                totalStudents: overallTotal.data().count,
                myAvgPct: myOverall && myOverall.count ? myOverall.avgPct : null,
                myPapers: myOverall ? myOverall.count : 0
            },
            topRankers
        });
    } catch (err) {
        console.error('[leaderboard] Failed:', err);
        res.status(500).json({ error: 'Could not load the leaderboard.' });
    }
}
