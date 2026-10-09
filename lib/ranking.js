/**
 * Student ranking — pure functions, no database access.
 *
 * WHAT IS RANKED
 *   One row per STUDENT (never per attempt), using the average percentage
 *   across all their FULL papers. Subject-practice papers are not counted:
 *   they share an exam id with full mocks but are a different kind of paper,
 *   and comparing a one-subject drill with a mixed blueprint paper is not fair.
 *
 *   Two standings are kept for every student:
 *     - per exam  (e.g. Police Bharti): their full papers on that exam
 *     - overall   : their full papers across every PAID exam
 *   Free tests rank within their own exam only; they are a limited preview,
 *   so they do not feed the overall standing.
 *
 *   Percentage, not raw marks: papers differ in length (a blueprint the bank
 *   cannot fully fill, or one edited later, has a different total), so raw
 *   marks are not comparable between attempts.
 *
 * HOW IT STAYS CHEAP
 *   Standings are kept as running totals on one `student_stats/{uid}` document
 *   per student, updated when a test is submitted. A rank is then "how many
 *   students have a higher average than mine", which the database answers with
 *   a count query — a handful of reads no matter how many attempts exist. The
 *   previous version read every attempt for the exam on every scorecard.
 *
 *   Ties share a rank (1, 2, 2, 4), the usual competition ranking.
 */

/** 'average' ranks by mean % over all full papers; 'best' by the single best %. */
export const RANKING_METRIC = 'average';

const round2 = (n) => Math.round(n * 100) / 100;

const clampPct = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.min(100, Math.max(0, v));
};

export function emptyBucket() {
    return { count: 0, sumPct: 0, avgPct: 0, bestPct: 0, totalSeconds: 0, rankPct: 0 };
}

/** Folds one attempt's percentage into a running bucket. Returns a new bucket. */
export function addToBucket(bucket, pct, seconds) {
    const b = bucket && bucket.count ? bucket : emptyBucket();
    const count = b.count + 1;
    const sumPct = round2(b.sumPct + clampPct(pct));
    const avgPct = round2(sumPct / count);
    const bestPct = Math.max(b.bestPct || 0, clampPct(pct));
    return {
        count,
        sumPct,
        avgPct,
        bestPct,
        totalSeconds: (b.totalSeconds || 0) + Math.max(0, Number(seconds) || 0),
        // The single number rank queries compare on, so switching the metric
        // changes one constant instead of every query.
        rankPct: RANKING_METRIC === 'best' ? bestPct : avgPct
    };
}

/**
 * Applies one submitted attempt to a student's stats document.
 * Returns the updated document. Only full papers count.
 */
export function applyAttemptToStats(stats, attempt, { isFreeTest = false, name = '' } = {}) {
    const next = {
        uid: stats?.uid || attempt.studentId,
        name: name || stats?.name || 'Student',
        overall: stats?.overall || emptyBucket(),
        exams: { ...(stats?.exams || {}) }
    };

    if (attempt.paperType !== 'full') return next;

    const pct = attempt.percentage;
    const seconds = attempt.timeTakenSeconds;

    next.exams[attempt.examId] = addToBucket(next.exams[attempt.examId], pct, seconds);
    if (!isFreeTest) next.overall = addToBucket(next.overall, pct, seconds);
    return next;
}

/**
 * Builds stats documents from a list of saved attempts, for backfilling
 * history. `isFreeTestByExam` maps examId -> boolean. Attempts whose paperType
 * is missing (saved before it existed) are classed from the exam name, which
 * carried "(<Subject> Practice)" for subject papers.
 */
export function buildStatsFromAttempts(attempts, { isFreeTestByExam = {}, nameByUid = {} } = {}) {
    const byUid = {};
    const ordered = [...attempts].sort(
        (a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0)
    );
    for (const a of ordered) {
        const paperType = a.paperType || (/practice/i.test(a.examName || '') ? 'subject' : 'full');
        byUid[a.studentId] = applyAttemptToStats(
            byUid[a.studentId],
            { ...a, paperType },
            { isFreeTest: !!isFreeTestByExam[a.examId], name: nameByUid[a.studentId] }
        );
    }
    return byUid;
}

/** Competition rank from the number of students strictly ahead of you. */
export const rankFromAhead = (studentsAhead) => studentsAhead + 1;
