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
            } catch (err) {
                console.warn('[Firestore Engine] Error fetching questions from Firestore, using local fallback:', err.message);
            }
        }
        return storageService.getQuestions();
    },

    // 3. Save Question
    saveQuestion: async (questionData) => {
        if (isFirebaseConnected && db) {
            try {
                const qRef = doc(db, 'questions', questionData.id);
                await setDoc(qRef, questionData);
                console.log('[Firestore Engine] Saved question:', questionData.id);
            } catch (err) {
                console.warn('[Firestore Engine] Error saving question to Firestore:', err.message);
            }
        }
        storageService.saveQuestion(questionData);
    },

    // 4. Save Exam Blueprint
    saveExamBlueprint: async (examData) => {
        if (isFirebaseConnected && db) {
            try {
                const eRef = doc(db, 'exams', examData.id);
                await setDoc(eRef, examData);
                console.log('[Firestore Engine] Saved exam blueprint:', examData.id);
            } catch (err) {
                console.warn('[Firestore Engine] Error saving exam to Firestore:', err.message);
            }
        }
        storageService.saveExamBlueprint(examData);
    },

    // 5. Get Student Profile & Test Quotas
    getUserProfile: async (uid) => {
        if (isFirebaseConnected && db) {
            try {
                const userRef = doc(db, 'users', uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    return { id: snap.id, ...snap.data() };
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error getting user profile:', err.message);
            }
        }
        const curr = storageService.getCurrentUser();
        return curr && (curr.id === uid || curr.uid === uid) ? curr : {
            uid,
            name: 'Alex Student',
            email: 'student@sigma.com',
            mobile: '9876543210',
            allowedTests: 0,
            remainingTests: 0,
            completedTests: 0,
            status: 'active'
        };
    },

    // 6. Fetch ALL Registered Student Profiles (Cloud Firestore + Local Storage)
    getStudents: async () => {
        let firestoreStudents = [];
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'users'));
                if (!snapshot.empty) {
                    firestoreStudents = snapshot.docs
                        .map(d => ({ id: d.id, uid: d.id, ...d.data() }))
                        .filter(u => u.role !== 'admin');
                    console.log(`[Firestore Engine] Fetched ${firestoreStudents.length} registered students from Cloud Firestore.`);
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error fetching users from Firestore:', err.message);
            }
        }

        const localStudents = storageService.getStudents();
        const combined = [...firestoreStudents];
        localStudents.forEach(ls => {
            if (!combined.some(cs => cs.email === ls.email || cs.id === ls.id)) {
                combined.push(ls);
            }
        });

        return combined;
    },

    // 7. Update Student Quota with Instant Storage & Active User Sync
    updateStudentQuota: async (uid, allowedTests, status = 'active') => {
        const allowedNum = parseInt(allowedTests, 10);
        const profile = await firestoreEngine.getUserProfile(uid);
        const completed = profile ? (profile.completedTests || 0) : 0;
        const remaining = Math.max(0, allowedNum - completed);

        if (isFirebaseConnected && db) {
            try {
                const userRef = doc(db, 'users', uid);
                await updateDoc(userRef, {
                    allowedTests: allowedNum,
                    remainingTests: remaining,
                    status
                });
            } catch (err) {
                console.warn('[Firestore Engine] Error updating quota:', err.message);
            }
        }
        const students = storageService.getStudents();
        const index = students.findIndex(s => s.id === uid || s.uid === uid || (profile && s.email === profile.email));
        let updatedProfile = null;

        if (index !== -1) {
            students[index] = {
                ...students[index],
                allowedTests: allowedNum,
                remainingTests: remaining,
                status
            };
            updatedProfile = students[index];
        } else if (profile) {
            updatedProfile = {
                ...profile,
                allowedTests: allowedNum,
                remainingTests: remaining,
                status
            };
            students.push(updatedProfile);
        } else {
            updatedProfile = {
                id: uid,
                uid,
                allowedTests: allowedNum,
                remainingTests: remaining,
                completedTests: 0,
                status
            };
            students.push(updatedProfile);
        }

        localStorage.setItem('cep_react_students', JSON.stringify(students));
        localStorage.setItem('sigma_students', JSON.stringify(students));

        const currUser = storageService.getCurrentUser();
        if (currUser && (currUser.id === uid || currUser.uid === uid || (profile && currUser.email === profile.email))) {
            storageService.setCurrentUser({ ...currUser, ...updatedProfile });
        }

        return updatedProfile;
    },

    // 7b. Save Complete Student Profile Details (Name, Email, Mobile, Enrollment ID, Quota, Status)
    saveStudentProfile: async (studentData) => {
        const { id, uid, name, email, mobile, enrollmentId, allowedTests, status } = studentData;
        const stdId = id || uid || 'std_' + Date.now();
        const allowedNum = parseInt(allowedTests, 10) || 0;
        
        const existing = await firestoreEngine.getUserProfile(stdId);
        const completed = existing ? (existing.completedTests || 0) : 0;
        const remaining = Math.max(0, allowedNum - completed);

        const updatedProfile = {
            ...(existing || {}),
            id: stdId,
            uid: stdId,
            name: name || existing?.name || 'Student User',
            email: email || existing?.email || '',
            mobile: mobile || existing?.mobile || '9876543210',
            enrollmentId: enrollmentId || existing?.enrollmentId || ('SIGMA-2026-' + Math.floor(1000 + Math.random() * 9000)),
            allowedTests: allowedNum,
            remainingTests: remaining,
            completedTests: completed,
            purchasedPackages: existing?.purchasedPackages || [],
            status: status || 'active'
        };

        if (isFirebaseConnected && db) {
            try {
                await setDoc(doc(db, 'users', stdId), updatedProfile);
            } catch (err) {
                console.warn('[Firestore Engine] Error saving student profile:', err.message);
            }
        }

        const students = storageService.getStudents();
        const index = students.findIndex(s => s.id === stdId || s.uid === stdId || s.email === updatedProfile.email);
        if (index !== -1) {
            students[index] = updatedProfile;
        } else {
            students.push(updatedProfile);
        }

        localStorage.setItem('cep_react_students', JSON.stringify(students));
        localStorage.setItem('sigma_students', JSON.stringify(students));

        const currUser = storageService.getCurrentUser();
        if (currUser && (currUser.id === stdId || currUser.uid === stdId || currUser.email === updatedProfile.email)) {
            storageService.setCurrentUser({ ...currUser, ...updatedProfile });
        }

        return updatedProfile;
    },

    // 8. Decrement Student Quota on Exam Start
    decrementStudentQuota: async (uid) => {
        const profile = await firestoreEngine.getUserProfile(uid);
        if (profile) {
            const nextRemaining = Math.max(0, (profile.remainingTests || 1) - 1);
            const nextCompleted = (profile.completedTests || 0) + 1;
            
            if (isFirebaseConnected && db) {
                try {
                    const userRef = doc(db, 'users', uid);
                    await updateDoc(userRef, {
                        remainingTests: nextRemaining,
                        completedTests: nextCompleted
                    });
                } catch (e) {
                    console.warn('[Firestore Engine] Quota decrement fallback:', e.message);
                }
            }

            const updatedProfile = {
                ...profile,
                remainingTests: nextRemaining,
                completedTests: nextCompleted
            };
            storageService.setCurrentUser(updatedProfile);
        }
    },

    // 9. Save Scorecard Submission
    saveSubmission: async (submissionData) => {
        if (isFirebaseConnected && db) {
            try {
                const subRef = doc(db, 'submissions', submissionData.id);
                await setDoc(subRef, submissionData);
                console.log('[Firestore Engine] Saved submission to Cloud Firestore:', submissionData.id);
            } catch (err) {
                console.warn('[Firestore Engine] Error saving submission to Firestore:', err.message);
            }
        }
        storageService.saveSubmission(submissionData);
    },

    // 10. Fetch ALL Submissions Log (Cloud Firestore + Local Storage + Demo Seed Fallback)
    getSubmissions: async (studentId = null) => {
        let firestoreSubs = [];
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'submissions'));
                if (!snapshot.empty) {
                    firestoreSubs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error fetching submissions:', err.message);
            }
        }
        const localSubs = storageService.getSubmissions(null);

        const combined = [...firestoreSubs];
        localSubs.forEach(ls => {
            if (!combined.some(cs => cs.id === ls.id)) {
                combined.push(ls);
            }
        });

        if (combined.length === 0) {
            const demoSubmissions = [
                {
                    id: 'sub_1001',
                    studentId: 'std_102',
                    studentName: 'Rahul Patil',
                    studentEmail: 'rahul@sigma.com',
                    examId: 'police_bharti',
                    examCode: 'PB-MOCK',
                    examName: 'Maharashtra Police Bharti Mock',
                    submittedAt: new Date(Date.now() - 1000 * 3600 * 2).toISOString(),
                    timeTakenSeconds: 3420,
                    finalScore: 82,
                    totalMarks: 100,
                    percentage: 82.0,
                    accuracy: 88.5,
                    passed: true
                },
                {
                    id: 'sub_1002',
                    studentId: 'std_101',
                    studentName: 'Alex Student',
                    studentEmail: 'student@sigma.com',
                    examId: 'ssc_gd',
                    examCode: 'SSC-GD-CBT',
                    examName: 'SSC GD Constable Mock',
                    submittedAt: new Date(Date.now() - 1000 * 3600 * 24).toISOString(),
                    timeTakenSeconds: 3100,
                    finalScore: 118,
                    totalMarks: 160,
                    percentage: 73.8,
                    accuracy: 81.2,
                    passed: true
                }
            ];
            demoSubmissions.forEach(ds => combined.push(ds));
        }

        let filtered = combined;
        if (studentId) {
            filtered = filtered.filter(s => 
                s.studentId === studentId || 
                s.uid === studentId || 
                (s.studentEmail && s.studentEmail.toLowerCase() === studentId.toLowerCase())
            );
        }
        filtered.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        return filtered;
    },

    // 11. Save Package Purchase Request (UPI QR + UTR Ref No with Unique Validation)
    savePackagePurchaseRequest: async (requestData) => {
        const cleanUtr = String(requestData.utrNumber || '').trim();
        const existingReqs = await firestoreEngine.getPackagePurchaseRequests();
        const duplicate = existingReqs.find(r => r.utrNumber === cleanUtr && r.status !== 'rejected');
        
        if (duplicate) {
            return {
                success: false,
                message: `UTR number ${cleanUtr} has already been submitted and processed. Duplicate UTR submissions are not allowed.`
            };
        }

        if (isFirebaseConnected && db) {
            try {
                const reqRef = doc(db, 'package_requests', requestData.id);
                await setDoc(reqRef, requestData);
                console.log('[Firestore Engine] Saved package purchase request:', requestData.id);
            } catch (err) {
                console.warn('[Firestore Engine] Firestore request save fallback:', err.message);
            }
        }

        const local = localStorage.getItem('sigma_package_requests');
        const list = local ? JSON.parse(local) : [];
        list.unshift(requestData);
        localStorage.setItem('sigma_package_requests', JSON.stringify(list));
        return { success: true };
    },

    // 12. Fetch Package Purchase Requests
    getPackagePurchaseRequests: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'package_requests'));
                if (!snapshot.empty) {
                    const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    reqs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    return reqs;
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error fetching package requests:', err.message);
            }
        }
        const local = localStorage.getItem('sigma_package_requests');
        return local ? JSON.parse(local) : [
            {
                id: 'req_101',
                studentId: 'std_102',
                studentName: 'Rahul Patil',
                studentMobile: '9876543210',
                packageName: 'Police Batch – 100 Tests',
                targetExam: 'Police Bharti',
                testQuota: 100,
                amount: 199,
                utrNumber: '422198034120',
                senderUpi: 'rahul@ybl',
                status: 'pending',
                createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
            }
        ];
    },

    // 13. Approve Package Purchase Request (Credits Package & Test Quota)
    approvePackagePurchaseRequest: async (requestId) => {
        const requests = await firestoreEngine.getPackagePurchaseRequests();
        const req = requests.find(r => r.id === requestId);
        if (!req) return { success: false, message: 'Request not found.' };

        const updatedReq = { ...req, status: 'approved', approvedAt: new Date().toISOString() };

        if (isFirebaseConnected && db) {
            try {
                await setDoc(doc(db, 'package_requests', requestId), updatedReq);
            } catch (e) {
                console.warn('[Firestore Engine] Error updating request status:', e.message);
            }
        }

        const local = localStorage.getItem('sigma_package_requests');
        const list = local ? JSON.parse(local) : [];
        const nextList = list.map(r => r.id === requestId ? updatedReq : r);
        localStorage.setItem('sigma_package_requests', JSON.stringify(nextList));

        const allStudents = await firestoreEngine.getStudents();
        const student = allStudents.find(s => s.id === req.studentId || s.uid === req.studentId || s.email === req.studentEmail);

        if (student) {
            const newPkg = {
                packageName: req.packageName,
                exam: req.targetExam,
                purchaseDate: new Date().toLocaleDateString('en-IN'),
                expiry: '12 Months',
                paymentStatus: 'Paid',
                utrNumber: req.utrNumber
            };
            const currentPkgs = student.purchasedPackages || [];
            const nextPkgs = [...currentPkgs, newPkg];
            const nextAllowed = (student.allowedTests || 0) + (req.testQuota || 100);
            const nextRemaining = (student.remainingTests || 0) + (req.testQuota || 100);

            const updatedStudent = {
                ...student,
                purchasedPackages: nextPkgs,
                allowedTests: nextAllowed,
                remainingTests: nextRemaining
            };

            const localList = storageService.getStudents();
            const nextLocal = localList.map(s => (s.id === student.id || s.email === student.email) ? updatedStudent : s);
            if (!nextLocal.some(s => s.id === student.id)) nextLocal.push(updatedStudent);
            localStorage.setItem('cep_react_students', JSON.stringify(nextLocal));
            localStorage.setItem('sigma_students', JSON.stringify(nextLocal));

            const currUser = storageService.getCurrentUser();
            if (currUser && (currUser.id === student.id || currUser.email === student.email)) {
                storageService.setCurrentUser(updatedStudent);
            }

            if (isFirebaseConnected && db) {
                try {
                    await setDoc(doc(db, 'users', student.id || student.uid), updatedStudent);
                } catch (e) {
                    console.warn('[Firestore Engine] User profile credit update error:', e.message);
                }
            }
        }

        return { success: true };
    },

    // 14. Reject Package Purchase Request
    rejectPackagePurchaseRequest: async (requestId) => {
        const requests = await firestoreEngine.getPackagePurchaseRequests();
        const req = requests.find(r => r.id === requestId);
        if (!req) return { success: false, message: 'Request not found.' };

        const updatedReq = { ...req, status: 'rejected', rejectedAt: new Date().toISOString() };

        if (isFirebaseConnected && db) {
            try {
                await setDoc(doc(db, 'package_requests', requestId), updatedReq);
            } catch (e) {
                console.warn('[Firestore Engine] Error rejecting request:', e.message);
            }
        }

        const local = localStorage.getItem('sigma_package_requests');
        const list = local ? JSON.parse(local) : [];
        const nextList = list.map(r => r.id === requestId ? updatedReq : r);
        localStorage.setItem('sigma_package_requests', JSON.stringify(nextList));

        return { success: true };
    },

    // 15. Admin Merchant Payment Settings (UPI ID & QR Code Image Config)
    getMerchantPaymentSettings: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snap = await getDoc(doc(db, 'settings', 'payment'));
                if (snap.exists()) {
                    return snap.data();
                }
            } catch (e) {
                console.warn('[Firestore Engine] Payment settings fallback:', e.message);
            }
        }
        const local = localStorage.getItem('sigma_merchant_payment_settings');
        return local ? JSON.parse(local) : {
            merchantName: 'SigmaForce CEP Official',
            upiId: 'sigmaforce@upi',
            qrImageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=sigmaforce@upi%26pn=SigmaForce%26cu=INR'
        };
    },

    saveMerchantPaymentSettings: async (settings) => {
        if (isFirebaseConnected && db) {
            try {
                await setDoc(doc(db, 'settings', 'payment'), settings);
            } catch (e) {
                console.warn('[Firestore Engine] Error saving payment settings:', e.message);
            }
        }
        localStorage.setItem('sigma_merchant_payment_settings', JSON.stringify(settings));
    },

    // 15. Reset ALL Existing Student Quotas to Zero
    resetAllStudentQuotasToZero: async () => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'users'));
                if (!snapshot.empty) {
                    const updates = snapshot.docs
                        .filter(d => d.data().role !== 'admin')
                        .map(d => updateDoc(doc(db, 'users', d.id), { allowedTests: 0, remainingTests: 0 }));
                    await Promise.all(updates);
                    console.log(`[Firestore Engine] Reset ${updates.length} student quotas to 0 in Cloud Firestore.`);
                }
            } catch (err) {
                console.warn('[Firestore Engine] Error resetting Firestore student quotas:', err.message);
            }
        }

        const students = storageService.getStudents();
        const resetList = students.map(s => ({
            ...s,
            allowedTests: 0,
            remainingTests: 0
        }));

        localStorage.setItem('cep_react_students', JSON.stringify(resetList));
        localStorage.setItem('sigma_students', JSON.stringify(resetList));

        const currUser = storageService.getCurrentUser();
        if (currUser && currUser.role === 'student') {
            storageService.setCurrentUser({
                ...currUser,
                allowedTests: 0,
                remainingTests: 0
            });
        }

        return resetList;
    }
};
