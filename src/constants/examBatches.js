// Canonical exam batch list. Duplicated as inline arrays in a few existing
// admin components (QuestionBankManager.jsx, PackageManager.jsx, etc.) —
// not retrofitted here, just used for new code so we don't add a 5th copy.
export const EXAM_BATCHES = ['Police Bharti', 'Vanrakshak', 'SSC GD'];

// Explicit exam-id -> question-batch-tag mapping, used by examEngine.js to
// pull the right question pool for a given exam. Previously this was
// inferred by fuzzy-matching the exam's (often Marathi) display name against
// the batch tag, which never actually matched for any exam — every mock
// silently fell back to drawing from the entire question bank across all
// exam boards instead of its own. Free-test exams map to the same batch as
// their paid counterpart (a free test should preview that board's actual
// questions, not a random mix).
export const EXAM_ID_TO_BATCH = {
    police_bharti: 'Police Bharti',
    pb: 'Police Bharti',
    ssc_gd: 'SSC GD',
    vanrakshak: 'Vanrakshak'
};
