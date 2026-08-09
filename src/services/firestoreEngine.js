import { 
    db, 
    isFirebaseConnected, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    updateDoc 
} from './firebase.js';

import { storageService } from './storageService.js';

export const firestoreEngine = {
    // 1. Fetch Exams
    getExams: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'exams'));
                if (!snapshot.empty) {
                    const exams = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    console.log(`[Firestore Engine] Fetched ${exams.length} exams from Cloud Firestore.`);
                    return exams;
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error fetching exams from Firestore, using local fallback:', err.message);
            }
        }
        return storageService.getExams();
    },

    // 2. Fetch Questions
    getQuestions: async (batchFilter = null) => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'questions'));
                if (!snapshot.empty) {
                    let questions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (batchFilter && batchFilter !== 'ALL') {
                        questions = questions.filter(q => q.batch === batchFilter || q.batch.toLowerCase().includes(batchFilter.toLowerCase()));
                    }
                    console.log(`[Firestore Engine] Fetched ${questions.length} questions from Cloud Firestore.`);
                    return questions;
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error fetching questions from Firestore, using local fallback:', err.message);
            }
        }
        return storageService.getQuestions();
    },

    // 3. Get Student Profile & Test Quotas
    getUserProfile: async (uid) => {
        if (isFirebaseConnected && db) {
            try {
                const userRef = doc(db, 'users', uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    return { id: snap.id, ...snap.data() };
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error fetching user profile:', err.message);
            }
        }
        return storageService.getCurrentUser();
    },

    // 4. Update Student Practice Limit Quota (Admin)
    updateStudentQuota: async (studentId, allowedTests, status = 'active') => {
        const allowedNum = parseInt(allowedTests, 10);

        if (isFirebaseConnected && db) {
            try {
                const userRef = doc(db, 'users', studentId);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const currentData = snap.data();
                    const completed = currentData.completedTests || 0;
                    const remaining = Math.max(0, allowedNum - completed);
                    await updateDoc(userRef, {
                        allowedTests: allowedNum,
                        remainingTests: remaining,
                        status
                    });
                    console.log(`[Firestore Engine] Updated student ${studentId} quota to ${allowedNum}.`);
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error updating quota in Firestore:', err.message);
            }
        }
        return storageService.saveStudent({ id: studentId, allowedTests: allowedNum, status });
    },

    // 5. Atomically Decrement Test Quota on Exam Start
    decrementStudentQuota: async (studentId) => {
        if (isFirebaseConnected && db) {
            try {
                const userRef = doc(db, 'users', studentId);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const data = snap.data();
                    const remaining = Math.max(0, (data.remainingTests || 1) - 1);
                    const completed = (data.completedTests || 0) + 1;
                    await updateDoc(userRef, {
                        remainingTests: remaining,
                        completedTests: completed
                    });
                    console.log(`[Firestore Engine] Decremented quota for ${studentId}. Remaining: ${remaining}`);
                    return { remainingTests: remaining, completedTests: completed };
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error decrementing quota:', err.message);
            }
        }
        const updatedUser = storageService.decrementStudentTestBalance(studentId);
        return updatedUser;
    },

    // 6. Save Test Submission Scorecard to Firestore
    saveSubmission: async (submissionData) => {
        if (isFirebaseConnected && db) {
            try {
                const docRef = await addDoc(collection(db, 'test_attempts'), {
                    ...submissionData,
                    submittedAt: new Date().toISOString()
                });
                console.log(`[Firestore Engine] Saved test attempt to Firestore with ID: ${docRef.id}`);
                return { id: docRef.id, ...submissionData };
            } catch (err) {
                console.warn('[Firestore Engine] Error saving submission to Firestore:', err.message);
            }
        }
        return storageService.saveSubmission(submissionData);
    },

    // 7. Get Submissions
    getSubmissions: async (studentId = null) => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'test_attempts'));
                if (!snapshot.empty) {
                    let attempts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    if (studentId) attempts = attempts.filter(a => a.studentId === studentId);
                    return attempts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error fetching submissions:', err.message);
            }
        }
        return studentId ? storageService.getStudentSubmissions(studentId) : storageService.getSubmissions();
    },

    // 8. Single Question Save
    saveQuestion: async (questionData) => {
        if (isFirebaseConnected && db) {
            try {
                const qId = questionData.id || 'Q-' + Date.now();
                await setDoc(doc(db, 'questions', qId), {
                    ...questionData,
                    id: qId,
                    updatedAt: new Date().toISOString()
                });
                console.log(`[Firestore Engine] Saved question ${qId} to Cloud Firestore.`);
            } catch (err) {
                console.warn('[Firestore Engine] Error saving question:', err.message);
            }
        }
        return storageService.saveQuestion(questionData);
    },

    // 9. Bulk Upload Questions to Cloud Firestore
    bulkUploadQuestions: async (questionsList) => {
        let added = 0;
        if (isFirebaseConnected && db) {
            try {
                for (const q of questionsList) {
                    const qId = q.id || 'Q-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                    await setDoc(doc(db, 'questions', qId), { ...q, id: qId });
                    added++;
                }
                console.log(`[Firestore Engine] Bulk uploaded ${added} questions to Cloud Firestore.`);
                return { added, total: added };
            } catch (err) {
                console.warn('[Firestore Engine] Error bulk uploading questions:', err.message);
            }
        }
        return storageService.bulkUploadQuestions(questionsList);
    }
};
