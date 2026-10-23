import {
    auth,
    db,
    isFirebaseConnected,
    collection,
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
    where,
    limit,
    startAfter,
    orderBy,
    documentId,
    arrayUnion,
    arrayRemove,
    getCountFromServer
} from './firebase.js';

import { storageService } from './storageService.js';
import { resolveSubjectCode, DEFAULT_SUBJECT_CODES, setDynamicSubjectCodes } from '../constants/subjectCodes.js';
import { INDEX_COLLECTION, INDEX_META_ID, indexKey } from '../utils/questionIndex.js';

/**
 * Combines the built-in M1-M9 defaults with whatever is in the local cache,
 * keyed by code, cache winning on conflict.
 *
 * The previous `offline.length > 0 ? offline : DEFAULTS` treated a partial
 * cache as a complete dataset, so the first locally-saved subject replaced all
 * nine defaults — one added code made the other nine disappear. A merge can
 * only ever return a superset of the defaults.
 */
function mergeSubjectCodes(cached) {
    const byCode = new Map();
    DEFAULT_SUBJECT_CODES.forEach(s => byCode.set(s.code, s));
    (cached || []).forEach(s => {
        const code = (s.code || s.id || '').toUpperCase();
        if (code) byCode.set(code, { ...byCode.get(code), ...s, code });
    });
    return [...byCode.values()].sort(
        (a, b) => (a.order || 99) - (b.order || 99) || (a.code || '').localeCompare(b.code || '')
    );
}

export const firestoreEngine = {
    // 0. Subject Codes & Subject Master CRUD
    getSubjectCodes: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'subject_codes'));
                if (!snapshot.empty) {
                    const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    list.sort((a, b) => (a.order || 99) - (b.order || 99) || (a.code || '').localeCompare(b.code || ''));
                    setDynamicSubjectCodes(list);
                    return list;
                }
                
                // Seed initial defaults if empty
                console.log('[Firestore Engine] Seeding default subject codes (M1-M9)...');
                const batch = writeBatch(db);
                DEFAULT_SUBJECT_CODES.forEach((s, idx) => {
                    const sRef = doc(db, 'subject_codes', s.code);
                    batch.set(sRef, { ...s, id: s.code, order: idx + 1, updatedAt: new Date().toISOString() });
                });
                await batch.commit();
                setDynamicSubjectCodes(DEFAULT_SUBJECT_CODES);
                return DEFAULT_SUBJECT_CODES;
            } catch (err) {
                console.error('[Firestore Engine] Error fetching subject codes from Firestore:', err.message);
                const res = mergeSubjectCodes(storageService.getSubjectCodesOffline());
                setDynamicSubjectCodes(res);
                return res;
            }
        }
        const res = mergeSubjectCodes(storageService.getSubjectCodesOffline());
        setDynamicSubjectCodes(res);
        return res;
    },

    saveSubjectCode: async (subjectData) => {
        const rawCode = (subjectData.code || '').trim().toUpperCase();
        if (!rawCode) throw new Error('Subject code is required (e.g. M10).');

        const normalized = {
            id: rawCode,
            code: rawCode,
            name: subjectData.name ? subjectData.name.trim() : rawCode,
            name_mr: subjectData.name_mr ? subjectData.name_mr.trim() : (subjectData.name || rawCode),
            color: subjectData.color || '#6366f1',
            aliases: subjectData.aliases ? (typeof subjectData.aliases === 'string' ? subjectData.aliases.trim() : subjectData.aliases) : '',
            order: parseInt(subjectData.order, 10) || 99,
            updatedAt: new Date().toISOString()
        };

        if (isFirebaseConnected && db) {
            try {
                const sRef = doc(db, 'subject_codes', rawCode);
                await setDoc(sRef, normalized, { merge: true });
                console.log('[Firestore Engine] Saved subject code:', rawCode);
            } catch (err) {
                console.error('[Firestore Engine] Error saving subject code to Firestore:', err.message);
            }
        }

        storageService.saveSubjectCodeOffline(normalized);
        const all = await firestoreEngine.getSubjectCodes();
        setDynamicSubjectCodes(all);
        return normalized;
    },

    deleteSubjectCode: async (code) => {
        const cleanCode = (code || '').trim().toUpperCase();
        if (!cleanCode) return { success: false };

        if (isFirebaseConnected && db) {
            try {
                const sRef = doc(db, 'subject_codes', cleanCode);
                await deleteDoc(sRef);
                console.log('[Firestore Engine] Deleted subject code from Firestore:', cleanCode);
            } catch (err) {
                console.error('[Firestore Engine] Error deleting subject code from Firestore:', err.message);
            }
        }

        storageService.deleteSubjectCodeOffline(cleanCode);
        const all = await firestoreEngine.getSubjectCodes();
        setDynamicSubjectCodes(all);
        return { success: true };
    },

    // 1. Fetch Exams (Source of Truth: Firestore 'exams' collection)
    getExams: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'exams'));
                if (!snapshot.empty) {
                    const exams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    console.log(`[Firestore Engine] Fetched ${exams.length} exams from Cloud Firestore.`);
                    return exams;
                }
                return [];
            } catch (err) {
                console.error('[Firestore Engine] Error fetching exams from Firestore:', err.message);
                return [];
            }
        }
        return [];
    },

    // 1b. One exam by id — one read, instead of reading every exam to find one.
    getExamById: async (examId) => {
        if (!examId || !isFirebaseConnected || !db) return null;
        try {
            const snap = await getDoc(doc(db, 'exams', String(examId)));
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch (err) {
            console.error('[Firestore Engine] Error fetching exam:', err.message);
            return null;
        }
    },

    // 2. Fetch Questions (Source of Truth: Firestore 'questions' collection)
    //
    // Reads EVERY question — one read each. Used only as the fallback while the
    // question index is not built, and by the index rebuild. Papers and admin
    // screens use the index and the paged/by-id readers below instead.
    getQuestions: async (batchFilter = null) => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'questions'));
                if (!snapshot.empty) {
                    let questions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (batchFilter && batchFilter !== 'ALL') {
                        questions = questions.filter(q => {
                            if (Array.isArray(q.batches)) {
                                return q.batches.includes('ALL') || q.batches.includes(batchFilter) || q.batches.some(b => b.toLowerCase().includes(batchFilter.toLowerCase()));
                            }
                            const singleBatch = q.batch || '';
                            return singleBatch === 'ALL' || singleBatch === batchFilter || singleBatch.toLowerCase().includes(batchFilter.toLowerCase());
                        });
                    }
                    console.log(`[Firestore Engine] Fetched ${questions.length} questions from Cloud Firestore.`);
                    return questions;
                }
                return [];
            } catch (err) {
                console.error('[Firestore Engine] Error fetching questions from Firestore:', err.message);
                return [];
            }
        }
        return [];
    },

    // 2b. How many questions exist per subject code.
    //
    // Uses Firestore's count aggregation, which is billed at roughly one read
    // per 1000 matched index entries rather than one per document — so the
    // blueprint editor can show live availability without pulling the whole
    // 2000+ question bank into the browser just to call .length on it.
    getQuestionCountsBySubject: async (codes = []) => {
        const counts = {};
        if (!isFirebaseConnected || !db || !codes.length) return counts;

        await Promise.all(codes.map(async (code) => {
            try {
                const snap = await getCountFromServer(
                    query(collection(db, 'questions'), where('subjectCode', '==', code))
                );
                counts[code] = snap.data().count;
            } catch (err) {
                // Leave the code absent rather than reporting a confident 0 —
                // "we could not check" and "there are none" must not look alike.
                console.error(`[Firestore Engine] Count failed for subject ${code}:`, err.message);
            }
        }));

        return counts;
    },

    // ---- Question index (see src/utils/questionIndex.js) ---------------------

    // Is the index built and complete? One read. null when it is not.
    getQuestionIndexMeta: async () => {
        if (!isFirebaseConnected || !db) return null;
        try {
            const snap = await getDoc(doc(db, INDEX_COLLECTION, INDEX_META_ID));
            return snap.exists() ? snap.data() : null;
        } catch (err) {
            console.error('[Firestore Engine] Could not read the question index status:', err.message);
            return null;
        }
    },

    // The question ids for the given subjects — one read per subject.
    // Throws on failure so the paper builder can fall back to the full bank.
    getQuestionIndexForSubjects: async (codes) => {
        const keys = [...new Set((codes || []).map(indexKey))];
        const snaps = await Promise.all(keys.map(k => getDoc(doc(db, INDEX_COLLECTION, k))));
        const out = {};
        snaps.forEach((snap, i) => { out[keys[i]] = snap.exists() ? (snap.data().ids || []) : []; });
        return out;
    },

    // Every subject's ids — one read per subject (about ten reads in all).
    getAllQuestionIndex: async () => {
        const snap = await getDocs(collection(db, INDEX_COLLECTION));
        const out = {};
        snap.docs.forEach(d => { if (d.id !== INDEX_META_ID) out[d.id] = d.data().ids || []; });
        return out;
    },

    // How many questions there are, in total and per subject, without reading
    // them. Falls back to reading the bank once only while the index is unbuilt.
    getQuestionStats: async () => {
        const meta = await firestoreEngine.getQuestionIndexMeta();
        if (meta && meta.built) {
            try {
                const index = await firestoreEngine.getAllQuestionIndex();
                const counts = {};
                let total = 0;
                Object.entries(index).forEach(([code, ids]) => { counts[code] = ids.length; total += ids.length; });
                return { source: 'index', total, counts, builtAt: meta.builtAt || null };
            } catch (err) {
                console.error('[Firestore Engine] Could not read the question index:', err.message);
            }
        }
        const all = await firestoreEngine.getQuestions('ALL');
        const counts = {};
        all.forEach(q => { const k = indexKey(q.subjectCode); counts[k] = (counts[k] || 0) + 1; });
        // `questions` is returned in this fallback only, so a screen that needs the
        // whole bank while the index is unbuilt does not have to read it a second time.
        return { source: 'full', total: all.length, counts, builtAt: null, questions: all };
    },

    // Totals for the Overview without reading the documents: Firestore counts
    // them on its side and bills about one read per 1,000 counted. (Reading every
    // student and every attempt just to show two numbers cost one read each, and
    // grew with every user and every test.)
    countStudents: async () => {
        if (!isFirebaseConnected || !db) return 0;
        try {
            const snap = await getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student')));
            return snap.data().count;
        } catch (err) {
            console.error('[Firestore Engine] Could not count students:', err.message);
            return 0;
        }
    },

    countAttempts: async () => {
        if (!isFirebaseConnected || !db) return 0;
        try {
            const snap = await getCountFromServer(collection(db, 'test_attempts'));
            return snap.data().count;
        } catch (err) {
            console.error('[Firestore Engine] Could not count test attempts:', err.message);
            return 0;
        }
    },

    // Fetch specific questions by id — one read per question returned.
    // Firestore accepts 30 ids per `in` query, so they go in chunks of 30.
    getQuestionsByIds: async (ids) => {
        const unique = [...new Set(ids || [])];
        const chunks = [];
        for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));
        const results = await Promise.all(chunks.map(async (chunk) => {
            const snap = await getDocs(query(collection(db, 'questions'), where(documentId(), 'in', chunk)));
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }));
        return results.flat();
    },

    getQuestionById: async (questionId) => {
        if (!questionId || !isFirebaseConnected || !db) return null;
        try {
            const snap = await getDoc(doc(db, 'questions', String(questionId).trim()));
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        } catch (err) {
            console.error('[Firestore Engine] Could not look up question:', err.message);
            return null;
        }
    },

    // One page of questions for the admin screens: reads only the page, not the
    // bank. Ordered by document id, which needs no extra index.
    getQuestionPage: async ({ subjectCode = null, pageSize = 50, cursor = null } = {}) => {
        if (!isFirebaseConnected || !db) return { questions: [], cursor: null, hasMore: false };
        const constraints = [];
        if (subjectCode && subjectCode !== 'ALL') constraints.push(where('subjectCode', '==', subjectCode));
        if (cursor) constraints.push(startAfter(cursor));
        constraints.push(limit(pageSize));
        const snap = await getDocs(query(collection(db, 'questions'), ...constraints));
        return {
            questions: snap.docs.map(d => ({ id: d.id, ...d.data() })),
            cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
            hasMore: snap.docs.length === pageSize
        };
    },

    // Recompute the whole index from the questions. Reads every question once
    // (that is the cost), so it is for first-time setup or repair, not routine.
    rebuildQuestionIndex: async () => {
        if (!isFirebaseConnected || !db) throw new Error('Firestore database is not connected.');
        const bank = await getDocs(collection(db, 'questions'));
        const byKey = {};
        bank.docs.forEach(d => {
            const key = indexKey(d.data().subjectCode);
            (byKey[key] ||= []).push(d.id);
        });

        const existing = await getDocs(collection(db, INDEX_COLLECTION));
        const now = new Date().toISOString();
        const batch = writeBatch(db);
        Object.entries(byKey).forEach(([key, ids]) => {
            // set() without merge replaces the id list outright, dropping stale entries.
            batch.set(doc(db, INDEX_COLLECTION, key), { subjectCode: key, ids, updatedAt: now });
        });
        existing.docs.forEach(d => {
            if (d.id !== INDEX_META_ID && !byKey[d.id]) batch.delete(d.ref);
        });
        batch.set(doc(db, INDEX_COLLECTION, INDEX_META_ID), {
            built: true, version: 1, builtAt: now, totalQuestions: bank.size, subjects: Object.keys(byKey).length
        });
        await batch.commit();

        const counts = {};
        Object.entries(byKey).forEach(([key, ids]) => { counts[key] = ids.length; });
        return { total: bank.size, counts };
    },

    // 3. Save Question (Firestore 'questions' collection)
    saveQuestion: async (questionData) => {
        const qId = questionData.id || 'Q-' + Date.now().toString(36).toUpperCase();
        const resolvedSubject = resolveSubjectCode(questionData.subjectCode || questionData.subject) || { code: 'OTHER', name: questionData.subject || 'General' };
        const normalized = {
            ...questionData,
            id: qId,
            subjectCode: resolvedSubject.code,
            subject: resolvedSubject.name,
            correctOption: questionData.correctOption !== undefined ? questionData.correctOption : (questionData.correctIndex || 0),
            correctIndex: questionData.correctOption !== undefined ? questionData.correctOption : (questionData.correctIndex || 0),
            updatedAt: new Date().toISOString()
        };

        if (isFirebaseConnected && db) {
            try {
                const qRef = doc(db, 'questions', qId);

                // The index must follow the question. When an existing question's
                // subject changes, its id has to leave the OLD subject's index too,
                // so look up where it was (one read).
                let previousKey = null;
                try {
                    const prev = await getDoc(qRef);
                    if (prev.exists() && prev.data().subjectCode) previousKey = indexKey(prev.data().subjectCode);
                } catch { /* if this read fails the save below will surface the real problem */ }
                const newKey = indexKey(normalized.subjectCode);

                // Question and index change together or not at all.
                const batch = writeBatch(db);
                batch.set(qRef, normalized, { merge: true });
                if (previousKey && previousKey !== newKey) {
                    batch.set(doc(db, INDEX_COLLECTION, previousKey), { ids: arrayRemove(qId), updatedAt: normalized.updatedAt }, { merge: true });
                }
                batch.set(doc(db, INDEX_COLLECTION, newKey), { subjectCode: newKey, ids: arrayUnion(qId), updatedAt: normalized.updatedAt }, { merge: true });
                await batch.commit();

                console.log('[Firestore Engine] Saved question to Cloud Firestore:', qId);
                return normalized;
            } catch (err) {
                console.error('[Firestore Engine] Error saving question to Firestore:', err.message);
                throw err;
            }
        }
        storageService.saveQuestionOffline(normalized);
        return normalized;
    },

    // 3a. Save Bulk Questions in Atomic Batch Chunks (Firestore 'questions' collection)
    saveQuestionsBulk: async (questionsList, onProgress) => {
        if (!questionsList || questionsList.length === 0) return { count: 0 };

        const normalizedList = questionsList.map(q => {
            const qId = q.id || 'Q-' + Math.random().toString(36).substring(2, 9).toUpperCase();
            const resolvedSubject = resolveSubjectCode(q.subjectCode || q.subject) || { code: 'OTHER', name: q.subject || 'General' };
            return {
                ...q,
                id: qId,
                subjectCode: resolvedSubject.code,
                subject: resolvedSubject.name,
                correctOption: q.correctOption !== undefined ? q.correctOption : (q.correctIndex || 0),
                correctIndex: q.correctOption !== undefined ? q.correctOption : (q.correctIndex || 0),
                updatedAt: new Date().toISOString()
            };
        });

        if (isFirebaseConnected && db) {
            try {
                // Firestore batch limit is 500 ops per commit; use 200 chunk size for safety
                const CHUNK_SIZE = 200;
                let totalSaved = 0;

                for (let i = 0; i < normalizedList.length; i += CHUNK_SIZE) {
                    const chunk = normalizedList.slice(i, i + CHUNK_SIZE);
                    const batch = writeBatch(db);

                    chunk.forEach(item => {
                        const qRef = doc(db, 'questions', item.id);
                        batch.set(qRef, item, { merge: true });
                    });

                    // Add this chunk's ids to their subjects' index documents in the
                    // same batch (200 questions + a handful of index docs, well under
                    // the 500-operation limit). An id re-imported under a different
                    // subject can leave a stale entry in its old subject; paper
                    // building checks each fetched question's subject and skips such
                    // entries, and Rebuild index clears them.
                    const idsByKey = {};
                    chunk.forEach(item => { (idsByKey[indexKey(item.subjectCode)] ||= []).push(item.id); });
                    Object.entries(idsByKey).forEach(([key, ids]) => {
                        batch.set(doc(db, INDEX_COLLECTION, key), { subjectCode: key, ids: arrayUnion(...ids), updatedAt: new Date().toISOString() }, { merge: true });
                    });

                    await batch.commit();
                    totalSaved += chunk.length;
                    if (onProgress) onProgress(totalSaved, normalizedList.length);
                }
                console.log(`[Firestore Engine] Bulk saved ${totalSaved} questions to Cloud Firestore.`);
                return { count: totalSaved };
            } catch (err) {
                console.error('[Firestore Engine] Error during bulk question import:', err.message);
                throw err;
            }
        }

        // Offline fallback
        normalizedList.forEach(item => storageService.saveQuestionOffline(item));
        return { count: normalizedList.length };
    },


    // 3b. Delete Question (Firestore 'questions' collection)
    deleteQuestion: async (questionId) => {
        if (isFirebaseConnected && db) {
            try {
                const qRef = doc(db, 'questions', questionId);

                // Remove the id from its subject's index in the same batch.
                let key = null;
                try {
                    const snap = await getDoc(qRef);
                    if (snap.exists() && snap.data().subjectCode) key = indexKey(snap.data().subjectCode);
                } catch { /* fall through: the delete below reports any real failure */ }

                const batch = writeBatch(db);
                batch.delete(qRef);
                if (key) {
                    batch.set(doc(db, INDEX_COLLECTION, key), { ids: arrayRemove(questionId), updatedAt: new Date().toISOString() }, { merge: true });
                }
                await batch.commit();

                console.log('[Firestore Engine] Deleted question from Firestore:', questionId);
                return { success: true };
            } catch (err) {
                console.error('[Firestore Engine] Error deleting question from Firestore:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    // 4. Save Exam Blueprint (Firestore 'exams' collection)
    saveExamBlueprint: async (examData) => {
        if (isFirebaseConnected && db) {
            try {
                const eRef = doc(db, 'exams', examData.id);
                await setDoc(eRef, examData, { merge: true });
                console.log('[Firestore Engine] Saved exam blueprint to Cloud Firestore:', examData.id);
                return examData;
            } catch (err) {
                console.error('[Firestore Engine] Error saving exam blueprint to Firestore:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    deleteExamBlueprint: async (examId) => {
        if (isFirebaseConnected && db) {
            try {
                await deleteDoc(doc(db, 'exams', examId));
                console.log('[Firestore Engine] Deleted exam blueprint from Firestore:', examId);
                return { success: true };
            } catch (err) {
                console.error('[Firestore Engine] Error deleting exam blueprint from Firestore:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    // 5. Get Student Profile & Test Quotas (Firestore 'users' collection)
    getUserProfile: async (uid) => {
        if (!uid) return null;
        if (isFirebaseConnected && db) {
            try {
                const userRef = doc(db, 'users', uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    return { id: snap.id, uid: snap.id, ...snap.data() };
                }
                return null;
            } catch (err) {
                console.error('[Firestore Engine] Error getting user profile:', err.message);
                return null;
            }
        }
        return null;
    },

    // 6. Fetch ALL Registered Student Profiles (Firestore 'users' collection)
    getStudents: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'users'));
                if (!snapshot.empty) {
                    const students = snapshot.docs
                        .map(d => ({ id: d.id, uid: d.id, ...d.data() }))
                        .filter(u => u.role !== 'admin');
                    console.log(`[Firestore Engine] Fetched ${students.length} registered students from Cloud Firestore.`);
                    return students;
                }
                return [];
            } catch (err) {
                console.error('[Firestore Engine] Error fetching users from Firestore:', err.message);
                return [];
            }
        }
        return [];
    },

    // 6b. Paged and searchable student list for the admin screens.
    //
    // getStudents() above reads EVERY account — one read each, on every visit,
    // and growing with every sign-up. These read 50 at a time (newest first) and
    // find one student by email, mobile number or the start of their name.
    getStudentPage: async ({ pageSize = 50, cursor = null } = {}) => {
        if (!isFirebaseConnected || !db) return { students: [], cursor: null, hasMore: false };
        const constraints = [orderBy('createdAt', 'desc')];
        if (cursor) constraints.push(startAfter(cursor));
        constraints.push(limit(pageSize));
        const snap = await getDocs(query(collection(db, 'users'), ...constraints));
        return {
            // Admin accounts live in the same collection; keep them out of the list.
            students: snap.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() })).filter(u => u.role !== 'admin'),
            cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
            hasMore: snap.docs.length === pageSize
        };
    },

    // Firestore cannot search inside text, so this matches what an admin has in
    // hand: an email address, a 10-digit mobile number, or the start of a name
    // (tried as typed, as Title Case and as lower case, because the match is
    // case-sensitive). At most 20 results.
    searchStudents: async (term) => {
        const t = String(term || '').trim();
        if (t.length < 2 || !isFirebaseConnected || !db) return [];
        const users = collection(db, 'users');
        const queries = [];
        if (t.includes('@')) {
            [...new Set([t, t.toLowerCase()])].forEach(v => queries.push(query(users, where('email', '==', v))));
        } else if (/^\d{10}$/.test(t)) {
            queries.push(query(users, where('mobile', '==', t)));
        } else {
            const titleCase = t.replace(/\b\w/g, c => c.toUpperCase());
            [...new Set([t, titleCase, t.toLowerCase()])].forEach(v =>
                queries.push(query(users, where('name', '>=', v), where('name', '<=', v + ''), limit(20))));
        }
        const snaps = await Promise.all(queries.map(q => getDocs(q)));
        const seen = new Map();
        snaps.forEach(s => s.docs.forEach(d => {
            if (!seen.has(d.id) && d.data().role !== 'admin') seen.set(d.id, { id: d.id, uid: d.id, ...d.data() });
        }));
        return [...seen.values()].slice(0, 20);
    },

    // 10c. Paged test-attempt list for the Reports screen (50 at a time).
    //
    // Sorting happens in Firestore. Filtering by exam as well needs a composite
    // index (examId + submittedAt); only the date sorts are offered with it
    // (see firestore.indexes.json). A missing index surfaces as the Firestore
    // error 'failed-precondition', which the screen explains to the admin.
    getSubmissionsPage: async ({ sort = 'date_desc', examId = null, pageSize = 50, cursor = null } = {}) => {
        if (!isFirebaseConnected || !db) return { submissions: [], cursor: null, hasMore: false };
        const field = sort.startsWith('score') ? 'finalScore' : 'submittedAt';
        const direction = sort.endsWith('_asc') ? 'asc' : 'desc';
        const constraints = [];
        if (examId) constraints.push(where('examId', '==', examId));
        constraints.push(orderBy(field, direction));
        if (cursor) constraints.push(startAfter(cursor));
        constraints.push(limit(pageSize));
        const snap = await getDocs(query(collection(db, 'test_attempts'), ...constraints));
        return {
            submissions: snap.docs.map(d => ({ id: d.id, ...d.data() })),
            cursor: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
            hasMore: snap.docs.length === pageSize
        };
    },

    // Find attempts by a student's email (exact) or the start of their name.
    // Newest first, at most 50.
    searchSubmissions: async (term) => {
        const t = String(term || '').trim();
        if (t.length < 2 || !isFirebaseConnected || !db) return [];
        const attempts = collection(db, 'test_attempts');
        const queries = [];
        if (t.includes('@')) {
            [...new Set([t, t.toLowerCase()])].forEach(v => queries.push(query(attempts, where('studentEmail', '==', v), limit(50))));
        } else {
            const titleCase = t.replace(/\b\w/g, c => c.toUpperCase());
            [...new Set([t, titleCase, t.toLowerCase()])].forEach(v =>
                queries.push(query(attempts, where('studentName', '>=', v), where('studentName', '<=', v + ''), limit(50))));
        }
        const snaps = await Promise.all(queries.map(q => getDocs(q)));
        const seen = new Map();
        snaps.forEach(s => s.docs.forEach(d => { if (!seen.has(d.id)) seen.set(d.id, { id: d.id, ...d.data() }); }));
        return [...seen.values()]
            .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
            .slice(0, 50);
    },

    // 7. Update Student Quota in Firestore
    updateStudentQuota: async (uid, allowedTests, status = 'active') => {
        const allowedNum = parseInt(allowedTests, 10) || 0;
        const profile = await firestoreEngine.getUserProfile(uid);
        const completed = profile ? (profile.completedTests || 0) : 0;
        const remaining = Math.max(0, allowedNum - completed);

        if (isFirebaseConnected && db) {
            try {
                const userRef = doc(db, 'users', uid);
                await updateDoc(userRef, {
                    allowedTests: allowedNum,
                    remainingTests: remaining,
                    status,
                    updatedAt: new Date().toISOString()
                });
                const updated = { ...profile, allowedTests: allowedNum, remainingTests: remaining, status };
                
                const currUser = storageService.getCurrentUser();
                if (currUser && (currUser.id === uid || currUser.uid === uid)) {
                    storageService.setCurrentUser(updated);
                }
                return updated;
            } catch (err) {
                console.error('[Firestore Engine] Error updating quota in Firestore:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    // 7b. Save Complete Student Profile Details (Firestore 'users' collection)
    saveStudentProfile: async (studentData) => {
        const stdId = studentData.uid || studentData.id;
        if (!stdId) throw new Error('Student UID is required.');
        const allowedNum = parseInt(studentData.allowedTests, 10) || 0;
        
        const existing = await firestoreEngine.getUserProfile(stdId);
        const completed = existing ? (existing.completedTests || 0) : 0;
        const remaining = Math.max(0, allowedNum - completed);

        const updatedProfile = {
            ...(existing || {}),
            uid: stdId,
            id: stdId,
            name: studentData.name || existing?.name || '',
            email: studentData.email || existing?.email || '',
            mobile: studentData.mobile || existing?.mobile || '',
            enrollmentId: studentData.enrollmentId || existing?.enrollmentId || ('SIGMA-2026-' + Math.floor(1000 + Math.random() * 9000)),
            allowedTests: allowedNum,
            remainingTests: remaining,
            completedTests: completed,
            purchasedPackages: existing?.purchasedPackages || [],
            role: 'student',
            status: studentData.status || 'active',
            // The Students screen lists newest sign-ups first, ordered by this
            // field; a profile without it would not appear in that list at all.
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (isFirebaseConnected && db) {
            try {
                await setDoc(doc(db, 'users', stdId), updatedProfile, { merge: true });
                const currUser = storageService.getCurrentUser();
                if (currUser && (currUser.id === stdId || currUser.uid === stdId)) {
                    storageService.setCurrentUser(updatedProfile);
                }
                return updatedProfile;
            } catch (err) {
                console.error('[Firestore Engine] Error saving student profile to Firestore:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    // 9. Save a finished test — server-side.
    //
    // /api/submit-attempt saves the attempt, uses up one test of the student's
    // quota (or records a free-test attempt) and updates their ranking, all in
    // one step. These used to be three separate browser writes; the quota and
    // free-test ones touch fields the security rules reserve for the server, so
    // they were rejected (silently, inside a catch) and a finished test never
    // reduced anyone's quota.
    //
    // Throws on failure so the caller can fall back to its offline copy.
    submitAttempt: async (attempt) => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) throw new Error('Your session has expired. Please sign in again.');

        let res;
        let data;
        try {
            res = await fetch('/api/submit-attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ attempt })
            });
            data = await res.json();
        } catch {
            throw new Error('Could not reach the server to save your result.');
        }
        if (!res.ok || !data.success) throw new Error(data?.error || 'Could not save your result.');
        return data;
    },

    // 10. Fetch Test Attempts Log (Source of Truth: Firestore 'test_attempts' collection)
    // Pass a studentId for a student's own history; omit it only from admin
    // screens, which is the sole context allowed to read the whole collection.
    //
    // This used to fetch every attempt and filter in JavaScript. Security rules
    // are not filters — under owner-scoped rules a collection read that touches
    // one forbidden document fails outright, so the filtering has to happen in
    // the query. It also stops every student pulling the entire table (and
    // every other student's answers) down to their browser.
    getSubmissions: async (studentId = null) => {
        if (isFirebaseConnected && db) {
            try {
                const ref = collection(db, 'test_attempts');
                const snapshot = await getDocs(
                    studentId ? query(ref, where('studentId', '==', studentId)) : ref
                );
                let attempts = [];
                if (!snapshot.empty) {
                    attempts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                }
                attempts.sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0));
                console.log(`[Firestore Engine] Fetched ${attempts.length} test attempts from test_attempts collection.`);
                return attempts;
            } catch (err) {
                console.error('[Firestore Engine] Error fetching test attempts from Firestore:', err.message);
                return [];
            }
        }
        return [];
    },

    // 10b. Rank + anonymised top-10 for one exam, computed server-side.
    // The scorecard used to read every attempt in the database to work this
    // out, exposing all students' emails, uids and answer reviews to each
    // other. /api/leaderboard returns display names and scores only.
    getExamLeaderboard: async ({ examId }) => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) return null;

        try {
            const res = await fetch('/api/leaderboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({ examId })
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error('[Firestore Engine] Leaderboard fetch failed:', e.message);
            return null;
        }
    },

    // 10c. Admin payment tools. These call administrator-only server routes —
    // the browser never sees the Razorpay secret, and the server checks the
    // signed admin claim, not anything the page says about itself.
    adminListPayments: async () => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) throw new Error('Please sign in again.');
        let res, data;
        try {
            res = await fetch('/api/admin/payments', { headers: { Authorization: `Bearer ${idToken}` } });
            data = await res.json();
        } catch {
            throw new Error('Could not reach the server.');
        }
        if (!res.ok) throw new Error(data?.error || 'Could not load payments.');
        return data.payments || [];
    },

    adminCreditPayment: async ({ paymentId, uid }) => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) throw new Error('Please sign in again.');
        let res, data;
        try {
            res = await fetch('/api/admin/credit-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ paymentId, uid })
            });
            data = await res.json();
        } catch {
            throw new Error('Could not reach the server.');
        }
        if (!res.ok) throw new Error(data?.error || 'Could not credit this payment.');
        return data;
    },

    // Sets a student's login password (admin only). Returns { password } — shown
    // to the admin once so it can be passed to the student; it is not stored.
    adminResetStudentPassword: async ({ uid, password }) => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) throw new Error('Please sign in again.');
        let res, data;
        try {
            res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ uid, password: password || undefined })
            });
            data = await res.json();
        } catch {
            throw new Error('Could not reach the server.');
        }
        if (!res.ok) throw new Error((data?.error || 'Could not reset the password.') + (data?.detail ? ` (${data.detail})` : ''));
        return data;
    },

    // ---- Reported questions --------------------------------------------------

    // A student flags a question that looks wrong. Goes through the server, which
    // validates it and limits how many a student can send a day.
    // Resolves { alreadyReported } on success; throws an Error with a plain message.
    reportQuestion: async ({ questionId, reason, note, examId }) => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) throw new Error('Please sign in again.');
        let res, data;
        try {
            res = await fetch('/api/report-question', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ questionId, reason, note, examId })
            });
            data = await res.json();
        } catch {
            throw new Error('Could not reach the server.');
        }
        if (res.status === 429) { const e = new Error(data?.error || 'Too many reports today.'); e.code = 'too-many'; throw e; }
        if (!res.ok) throw new Error(data?.error || 'Could not send your report.');
        return { alreadyReported: !!data.alreadyReported };
    },

    // The open reports — one read per report, and only reports that are still
    // open, so the admin sees just the flagged questions, never the whole bank.
    getOpenQuestionReports: async ({ max = 300 } = {}) => {
        if (!isFirebaseConnected || !db) return [];
        const snap = await getDocs(query(collection(db, 'question_reports'), where('status', '==', 'open'), limit(max)));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    countOpenQuestionReports: async () => {
        if (!isFirebaseConnected || !db) return 0;
        try {
            const snap = await getCountFromServer(query(collection(db, 'question_reports'), where('status', '==', 'open')));
            return snap.data().count;
        } catch (err) {
            console.error('[Firestore Engine] Could not count reported questions:', err.message);
            return 0;
        }
    },

    // Close every open report on a question. `resolution` is 'fixed' or 'no_issue'.
    resolveQuestionReports: async (questionId, resolution) => {
        if (!isFirebaseConnected || !db) throw new Error('Firestore database is not connected.');
        const snap = await getDocs(query(collection(db, 'question_reports'), where('questionId', '==', questionId)));
        const batch = writeBatch(db);
        const now = new Date().toISOString();
        const by = auth?.currentUser?.uid || null;
        let closed = 0;
        snap.docs.forEach(d => {
            if (d.data().status === 'open') {
                batch.update(d.ref, { status: 'resolved', resolution, resolvedAt: now, resolvedBy: by });
                closed++;
            }
        });
        if (closed) await batch.commit();
        return closed;
    },

    // Firestore usage today and for the last week, from the server (admin only).
    // Never throws: { available: false, message } explains what to switch on.
    adminGetUsage: async () => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) return { available: false, reason: 'signin', message: 'Please sign in again.' };
        try {
            const res = await fetch('/api/admin/usage', { headers: { Authorization: `Bearer ${idToken}` } });
            return await res.json();
        } catch {
            return { available: false, reason: 'error', message: 'Could not reach the server.' };
        }
    },

    // Creates a student who can actually sign in (login + profile, same id).
    // Returns { uid, email, password } — the password is shown to the admin once.
    adminCreateStudent: async ({ name, email, mobile, enrollmentId, allowedTests, password }) => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) throw new Error('Please sign in again.');
        let res, data;
        try {
            res = await fetch('/api/admin/create-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                body: JSON.stringify({ name, email, mobile, enrollmentId, allowedTests, password: password || undefined })
            });
            data = await res.json();
        } catch {
            throw new Error('Could not reach the server.');
        }
        if (!res.ok) throw new Error((data?.error || 'Could not create the student.') + (data?.detail ? ` (${data.detail})` : ''));
        return data;
    },

    // 11. Course Packages Management (Source of Truth: Firestore 'packages' collection)
    getPackages: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'packages'));
                if (!snapshot.empty) {
                    const pkgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    console.log(`[Firestore Engine] Fetched ${pkgs.length} packages from Cloud Firestore.`);
                    return pkgs;
                }
                return [];
            } catch (err) {
                console.error('[Firestore Engine] Error fetching packages from Firestore:', err.message);
                return [];
            }
        }
        return [];
    },

    savePackage: async (packageData) => {
        if (isFirebaseConnected && db) {
            try {
                const pkgId = packageData.id || ('pkg_' + Date.now());
                const normalized = {
                    ...packageData,
                    id: pkgId,
                    createdAt: packageData.createdAt || new Date().toISOString()
                };
                await setDoc(doc(db, 'packages', pkgId), normalized, { merge: true });
                console.log('[Firestore Engine] Saved package to Cloud Firestore:', pkgId);
                return normalized;
            } catch (err) {
                console.error('[Firestore Engine] Error saving package to Firestore:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    deletePackage: async (packageId) => {
        if (isFirebaseConnected && db) {
            try {
                await deleteDoc(doc(db, 'packages', packageId));
                console.log('[Firestore Engine] Deleted package from Firestore:', packageId);
                return { success: true };
            } catch (err) {
                console.error('[Firestore Engine] Error deleting package from Firestore:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    // 12. Package Purchase Requests (Source of Truth: Firestore 'package_requests' collection)
    // Uniqueness of the UTR is enforced by the document id, not by scanning.
    //
    // The old version read every purchase request and looked for a duplicate in
    // JavaScript. That was racy (two submissions of the same UTR a moment apart
    // both saw "no duplicate"), it cost a full collection read per submission,
    // and under owner-scoped rules a student cannot list that collection at all.
    // Deriving the id from the UTR means a second submission is refused by
    // Firestore itself: the rules allow `create` but not `update`, so writing to
    // an id that already exists is denied atomically.
    savePackagePurchaseRequest: async (requestData) => {
        const cleanUtr = String(requestData.utrNumber || '').trim();
        if (!cleanUtr) {
            return { success: false, message: 'A UTR / transaction reference number is required.' };
        }

        if (isFirebaseConnected && db) {
            const reqId = 'utr_' + cleanUtr;
            const normalized = {
                ...requestData,
                id: reqId,
                utrNumber: cleanUtr,
                status: 'pending',
                createdAt: new Date().toISOString()
            };

            try {
                // Write straight at the UTR-keyed document — no read first.
                //
                // The security rules already enforce uniqueness: a student may
                // `create` this document but not `update` it, so a setDoc lands
                // only when the UTR has never been used. Reading first was
                // actively wrong under those rules — a get() on a document that
                // does NOT exist is denied (the read rule dereferences
                // resource.data, which is null), and the handler below treats
                // permission-denied as "duplicate". Every genuine first-time
                // submission would have been rejected as a duplicate.
                await setDoc(doc(db, 'package_requests', reqId), normalized);
                return { success: true, request: normalized };
            } catch (err) {
                // A denied write here is the uniqueness constraint doing its
                // job: the document already exists, so this was an update.
                if (err.code === 'permission-denied') {
                    return {
                        success: false,
                        message: `UTR number ${cleanUtr} has already been submitted. Duplicate UTR submissions are not allowed.`
                    };
                }
                console.error('[Firestore Engine] Error saving package purchase request:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    getPackagePurchaseRequests: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'package_requests'));
                if (!snapshot.empty) {
                    const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    reqs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    return reqs;
                }
                return [];
            } catch (err) {
                console.error('[Firestore Engine] Error fetching package requests:', err.message);
                return [];
            }
        }
        return [];
    },

    // 13. Approve Package Purchase Request (Credits Package & Test Quota in Firestore)
    approvePackagePurchaseRequest: async (requestId) => {
        if (!isFirebaseConnected || !db) throw new Error('Firestore database is not connected.');

        // Direct document read — this used to pull the whole collection and
        // scan it in JavaScript to find one known id.
        const reqSnap = await getDoc(doc(db, 'package_requests', requestId));
        if (!reqSnap.exists()) return { success: false, message: 'Request not found.' };
        const req = { id: reqSnap.id, ...reqSnap.data() };

        if (req.status === 'approved') {
            // Approving twice would credit the quota twice.
            return { success: false, message: 'This request has already been approved.' };
        }

        const updatedReq = { ...req, status: 'approved', approvedAt: new Date().toISOString() };

        if (isFirebaseConnected && db) {
            try {
                await setDoc(doc(db, 'package_requests', requestId), updatedReq, { merge: true });

                const student = await firestoreEngine.getUserProfile(req.studentId);
                if (student) {
                    // Look up the package to snapshot its examId — req itself
                    // only carries a display label (targetExam), the same gap
                    // that caused the Dashboard/Catalog access bug.
                    const allPackages = await firestoreEngine.getPackages();
                    const sourcePkg = allPackages.find(p => p.id === req.packageId);

                    const newPkg = {
                        id: 'pkg_purch_' + Date.now(),
                        packageId: req.packageId || null,
                        examId: sourcePkg?.examId || null,
                        packageName: req.packageName,
                        exam: req.targetExam,
                        totalTests: req.testQuota || 100,
                        amountPaid: req.amount || sourcePkg?.discountPrice || sourcePkg?.price || 0,
                        paymentMethod: 'Manual UPI',
                        paymentReference: req.utrNumber,
                        paymentStatus: 'COMPLETED',
                        purchaseDate: new Date().toISOString()
                    };
                    const currentPkgs = student.purchasedPackages || [];
                    const nextPkgs = [...currentPkgs, newPkg];
                    const nextAllowed = (student.allowedTests || 0) + (req.testQuota || 100);
                    const nextRemaining = (student.remainingTests || 0) + (req.testQuota || 100);

                    const updatedStudent = {
                        ...student,
                        purchasedPackages: nextPkgs,
                        allowedTests: nextAllowed,
                        remainingTests: nextRemaining,
                        updatedAt: new Date().toISOString()
                    };

                    await setDoc(doc(db, 'users', student.uid || student.id), updatedStudent, { merge: true });

                    const currUser = storageService.getCurrentUser();
                    if (currUser && (currUser.id === student.id || currUser.uid === student.uid)) {
                        storageService.setCurrentUser(updatedStudent);
                    }
                }
                return { success: true };
            } catch (e) {
                console.error('[Firestore Engine] Error approving request:', e.message);
                throw e;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    // 14. Reject Package Purchase Request
    rejectPackagePurchaseRequest: async (requestId) => {
        if (isFirebaseConnected && db) {
            try {
                const reqRef = doc(db, 'package_requests', requestId);
                const snap = await getDoc(reqRef);
                if (!snap.exists()) return { success: false, message: 'Request not found.' };

                const updatedReq = { ...snap.data(), status: 'rejected', rejectedAt: new Date().toISOString() };
                await setDoc(reqRef, updatedReq, { merge: true });
                return { success: true };
            } catch (e) {
                console.error('[Firestore Engine] Error rejecting request:', e.message);
                throw e;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    // 14a-i. Create a real Razorpay order server-side (/api/razorpay/create-order).
    // The Key Secret never reaches the browser — this just returns the order id
    // and public Key ID needed to open the checkout popup.
    createRazorpayOrder: async ({ packageId }) => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) {
            throw new Error('Your session has expired. Please sign in again before paying.');
        }

        let res;
        let data;
        try {
            res = await fetch('/api/razorpay/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                // No amount: the server prices the order from the package
                // document, so the browser cannot disagree with verify-payment.
                body: JSON.stringify({ packageId })
            });
            data = await res.json();
        } catch {
            // Network failure, or the server crashed and returned an HTML error
            // page instead of JSON. Nothing has been charged at this point.
            throw new Error('Payments are temporarily unavailable. You have not been charged — please try again shortly.');
        }

        if (!res.ok) {
            throw new Error(data?.error || 'Could not start checkout. You have not been charged.');
        }
        return data;
    },

    // 14a-ii. Verify a completed Razorpay payment and credit the quota.
    //
    // Both now happen inside /api/razorpay/verify-payment, which is the only
    // place with the Key Secret and the Admin SDK. This function deliberately
    // sends no price, no quota and no uid: the server takes the buyer from the
    // Firebase ID token, the price and quota from the package document, and
    // the amount actually paid from the Razorpay API. Anything this browser
    // claims about those is ignored.
    verifyRazorpayPayment: async ({ orderId, paymentId, signature, packageId }) => {
        // This runs AFTER the gateway has taken the money, so every failure
        // here must come back as a result the UI can show — never a thrown
        // error. A crashed server returns an HTML error page, which made
        // res.json() throw inside Razorpay's handler: no message, spinner stuck,
        // and the student unable to tell whether they had been charged.
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) {
            return { success: false, retryable: false, error: 'Your session has expired. Please sign in again.' };
        }

        let res;
        let data;
        try {
            res = await fetch('/api/razorpay/verify-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({ orderId, paymentId, signature, packageId })
            });
            data = await res.json();
        } catch {
            return {
                success: false,
                retryable: true,
                error: 'We could not reach our server to add your package.'
            };
        }

        if (!res.ok || !data.success) {
            return {
                success: false,
                // A server-side fault (5xx) is worth retrying; a rejected
                // payment (4xx) will fail the same way again.
                retryable: res.status >= 500,
                error: data?.error || 'Payment verification failed.'
            };
        }

        return {
            success: true,
            alreadyCredited: !!data.alreadyCredited,
            creditedTests: data.creditedTests,
            message: data.message
        };
    },

    // 14b. Quota crediting used to live here as processRazorpayPaymentSuccess,
    // called by the browser after the server said the signature was valid.
    // That made the signature check decorative: nothing stopped a student
    // invoking it directly, and the Firestore rules let any signed-in user
    // write any user document anyway. It now happens inside
    // /api/razorpay/verify-payment with the Admin SDK, in the same
    // transaction as the idempotency marker. There is deliberately no
    // client-side path that can grant quota.

    // 15. Admin Merchant Payment Settings (Source of Truth: Firestore 'settings/payment' document)
    getMerchantPaymentSettings: async () => {
        const envKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
        // const DEFAULT_KEY = 'rzp_test_E66NI3Yg44x1mj';

        const resolveKey = (adminSavedKey) => {
            if (adminSavedKey && adminSavedKey.trim() && adminSavedKey.trim() !== 'rzp_test_sigmaforce2026') {
                return adminSavedKey.trim();
            }
            if (envKey && envKey.trim() && envKey.trim() !== 'rzp_test_sigmaforce2026') {
                return envKey.trim();
            }
            return envKey.trim();
        };

        if (isFirebaseConnected && db) {
            try {
                const snap = await getDoc(doc(db, 'settings', 'payment'));
                if (snap.exists()) {
                    const data = snap.data();
                    return {
                        merchantName: data.merchantName || 'SigmaForce CEP Official',
                        upiId: data.upiId || 'sigmaforce@upi',
                        qrImageUrl: data.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=sigmaforce@upi%26pn=SigmaForce%26cu=INR`,
                        ...data,
                        razorpayKeyId: resolveKey(data.razorpayKeyId)
                    };
                }
            } catch (e) {
                console.error('[Firestore Engine] Error getting merchant payment settings:', e.message);
            }
        }
        return {
            merchantName: 'SigmaForce CEP Official',
            upiId: 'sigmaforce@upi',
            qrImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=sigmaforce@upi%26pn=SigmaForce%26cu=INR',
            razorpayKeyId: resolveKey('')
        };
    },

    saveMerchantPaymentSettings: async (settings) => {
        if (isFirebaseConnected && db) {
            try {
                const normalized = {
                    ...settings,
                    updatedAt: new Date().toISOString()
                };
                await setDoc(doc(db, 'settings', 'payment'), normalized);
                console.log('[Firestore Engine] Saved merchant payment settings to Firestore doc settings/payment');
                return normalized;
            } catch (e) {
                console.error('[Firestore Engine] Error saving payment settings to Firestore:', e.message);
                throw e;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    // 16. Reset ALL Existing Student Quotas to Zero
    resetAllStudentQuotasToZero: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'users'));
                if (!snapshot.empty) {
                    const updates = snapshot.docs
                        .filter(d => d.data().role !== 'admin')
                        .map(d => updateDoc(doc(db, 'users', d.id), { allowedTests: 0, remainingTests: 0, updatedAt: new Date().toISOString() }));
                    await Promise.all(updates);
                    console.log(`[Firestore Engine] Reset ${updates.length} student quotas to 0 in Cloud Firestore.`);
                }
            } catch (err) {
                console.error('[Firestore Engine] Error resetting Firestore student quotas:', err.message);
                throw err;
            }
        }
    }
};
