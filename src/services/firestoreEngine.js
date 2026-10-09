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
    getCountFromServer
} from './firebase.js';

import { storageService } from './storageService.js';
import { resolveSubjectCode, DEFAULT_SUBJECT_CODES, setDynamicSubjectCodes } from '../constants/subjectCodes.js';

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

    // 2. Fetch Questions (Source of Truth: Firestore 'questions' collection)
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
                await setDoc(qRef, normalized, { merge: true });
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
                await deleteDoc(doc(db, 'questions', questionId));
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

    // 8. Decrement Student Quota after Test Start
    decrementStudentQuota: async (uid) => {
        const profile = await firestoreEngine.getUserProfile(uid);
        if (!profile) return;

        const currentRemaining = profile.remainingTests || 0;
        if (currentRemaining <= 0) return;

        const nextRemaining = Math.max(0, currentRemaining - 1);
        const nextCompleted = (profile.completedTests || 0) + 1;
        
        if (isFirebaseConnected && db) {
            try {
                const userRef = doc(db, 'users', uid);
                await updateDoc(userRef, {
                    remainingTests: nextRemaining,
                    completedTests: nextCompleted,
                    updatedAt: new Date().toISOString()
                });

                const updatedProfile = {
                    ...profile,
                    remainingTests: nextRemaining,
                    completedTests: nextCompleted
                };
                storageService.setCurrentUser(updatedProfile);
            } catch (e) {
                console.error('[Firestore Engine] Quota decrement error:', e.message);
            }
        }
    },

    // 8b. Record a completed free-test attempt — free tests have no quota,
    // so this count (checked against the exam's admin-configurable
    // freeAttemptLimit in getExamAccess) is what stops unlimited retakes.
    markFreeTestUsed: async (uid, examId) => {
        const profile = await firestoreEngine.getUserProfile(uid);
        if (!profile) return;

        const attempts = { ...(profile.freeTestAttempts || {}) };
        attempts[examId] = (attempts[examId] || 0) + 1;

        if (isFirebaseConnected && db) {
            try {
                const userRef = doc(db, 'users', uid);
                await updateDoc(userRef, {
                    freeTestAttempts: attempts,
                    updatedAt: new Date().toISOString()
                });

                const updatedProfile = { ...profile, freeTestAttempts: attempts };
                storageService.setCurrentUser(updatedProfile);
            } catch (e) {
                console.error('[Firestore Engine] Free test usage record error:', e.message);
            }
        }
    },

    // 9. Save Test Attempt (Source of Truth: Firestore 'test_attempts' collection)
    saveSubmission: async (attemptData) => {
        if (isFirebaseConnected && db) {
            try {
                const attemptId = attemptData.id || ('SUB-' + Date.now().toString(36).toUpperCase());
                const normalizedAttempt = {
                    ...attemptData,
                    id: attemptId
                };
                const subRef = doc(db, 'test_attempts', attemptId);
                await setDoc(subRef, normalizedAttempt);
                console.log('[Firestore Engine] Saved test attempt to Cloud Firestore test_attempts:', attemptId);
                return normalizedAttempt;
            } catch (err) {
                console.error('[Firestore Engine] Error saving test attempt to Firestore:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
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
    getExamLeaderboard: async ({ examId, attemptId, finalScore, timeTakenSeconds, totalMarks, accuracy }) => {
        const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
        if (!idToken) return null;

        try {
            const res = await fetch('/api/leaderboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`
                },
                body: JSON.stringify({ examId, attemptId, finalScore, timeTakenSeconds, totalMarks, accuracy })
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error('[Firestore Engine] Leaderboard fetch failed:', e.message);
            return null;
        }
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
