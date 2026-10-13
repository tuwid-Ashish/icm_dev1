/**
 * The question index.
 *
 * Reading the whole question bank costs one database read per question — about
 * 2,400 reads every time a student starts a paper, and 10,000 at 10,000
 * questions. A paper only needs about 100 of them.
 *
 * So the bank is indexed: one small document per subject,
 *     question_index/<SUBJECT CODE> = { subjectCode, ids: [questionId, ...] }
 * holding only the ids of that subject's questions. To build a paper the app
 * reads the few index documents it needs, chooses random ids from them, and
 * fetches only those questions. Cost per paper is then about the size of the
 * paper, and no longer grows with the bank.
 *
 * `question_index/_meta` says whether the index has been built and is complete.
 * Until it is, everything falls back to reading the whole bank, so the app is
 * correct either way — the index only makes it cheaper.
 *
 * Writes keep the index in step: adding, editing, importing or deleting a
 * question updates its subject's index document in the same all-or-nothing
 * batch. `Rebuild index` (admin) and scripts/buildQuestionIndex.js recompute it
 * from the questions if it ever drifts.
 */

export const INDEX_COLLECTION = 'question_index';
export const INDEX_META_ID = '_meta';

/** The index document id for a subject code — upper-cased, and safe as a document id. */
export function indexKey(code) {
    const key = String(code || '').trim().toUpperCase().replace(/\//g, '_');
    return key || 'OTHER';
}
