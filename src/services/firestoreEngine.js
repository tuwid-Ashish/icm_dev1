import { 
    db, 
    isFirebaseConnected, 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    addDoc, 
    updateDoc,
    deleteDoc
} from './firebase.js';

import { storageService } from './storageService.js';

export const firestoreEngine = {
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

    // 3. Save Question (Firestore 'questions' collection)
    saveQuestion: async (questionData) => {
        if (isFirebaseConnected && db) {
            try {
                const qId = questionData.id || 'Q-' + Date.now().toString(36).toUpperCase();
                const normalized = {
                    ...questionData,
                    id: qId,
                    correctOption: questionData.correctOption !== undefined ? questionData.correctOption : (questionData.correctIndex || 0),
                    correctIndex: questionData.correctOption !== undefined ? questionData.correctOption : (questionData.correctIndex || 0),
                    updatedAt: new Date().toISOString()
                };
                const qRef = doc(db, 'questions', qId);
                await setDoc(qRef, normalized, { merge: true });
                console.log('[Firestore Engine] Saved question to Cloud Firestore:', qId);
                return normalized;
            } catch (err) {
                console.error('[Firestore Engine] Error saving question to Firestore:', err.message);
                throw err;
            }
        }
        throw new Error('Firestore database is not connected.');
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
    getSubmissions: async (studentId = null) => {
        if (isFirebaseConnected && db) {
            try {
                const snapshot = await getDocs(collection(db, 'test_attempts'));
                let attempts = [];
                if (!snapshot.empty) {
                    attempts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                }

                if (studentId) {
                    attempts = attempts.filter(s => 
                        s.studentId === studentId || 
                        s.uid === studentId || 
                        (s.studentEmail && s.studentEmail.toLowerCase() === studentId.toLowerCase())
                    );
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
                const reqId = requestData.id || ('req_' + Date.now());
                const normalized = { ...requestData, id: reqId, createdAt: new Date().toISOString() };
                const reqRef = doc(db, 'package_requests', reqId);
                await setDoc(reqRef, normalized);
                console.log('[Firestore Engine] Saved package purchase request to Cloud Firestore:', reqId);
                return { success: true, request: normalized };
            } catch (err) {
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
        const requests = await firestoreEngine.getPackagePurchaseRequests();
        const req = requests.find(r => r.id === requestId);
        if (!req) return { success: false, message: 'Request not found.' };

        const updatedReq = { ...req, status: 'approved', approvedAt: new Date().toISOString() };

        if (isFirebaseConnected && db) {
            try {
                await setDoc(doc(db, 'package_requests', requestId), updatedReq, { merge: true });

                const student = await firestoreEngine.getUserProfile(req.studentId);
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
    createRazorpayOrder: async ({ amount, packageId }) => {
        const res = await fetch('/api/razorpay/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, packageId })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data?.error || 'Could not create Razorpay order.');
        }
        return data;
    },

    // 14a-ii. Verify a completed Razorpay payment server-side
    // (/api/razorpay/verify-payment) and credit quota only if the HMAC
    // signature genuinely came from Razorpay — replaces the old pattern of
    // crediting quota directly from a client-side Firestore write.
    verifyRazorpayPayment: async ({ orderId, paymentId, signature, student, pkg, amount }) => {
        const res = await fetch('/api/razorpay/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, paymentId, signature, student, pkg, amount })
        });
        const data = await res.json();

        if (data.success) {
            const currUser = storageService.getCurrentUser();
            const studentId = student.uid || student.id;
            if (currUser && (currUser.id === studentId || currUser.uid === studentId)) {
                storageService.setCurrentUser(data.user);
            }
        }

        return data;
    },

    // 14b. Process Instant Razorpay Payment Success & Credit Student Quota
    // NOTE: only used by the client-side "Simulate Instant Quota Credit" test
    // button (no real payment involved). Real payments go through
    // verifyRazorpayPayment above, which credits quota server-side.
    processRazorpayPaymentSuccess: async ({ student, pkg, paymentId, amount }) => {
        const studentId = student.uid || student.id;
        const profile = await firestoreEngine.getUserProfile(studentId);
        const currentRemaining = Number(profile?.remainingTests || student.remainingTests || 0);
        const currentAllowed = Number(profile?.allowedTests || student.allowedTests || 0);
        const addedQuota = Number(pkg.totalTests || 10);

        const newPurchasedPackage = {
            id: 'pkg_purch_' + Date.now(),
            packageId: pkg.id,
            packageName: pkg.name,
            exam: pkg.exam,
            totalTests: addedQuota,
            amountPaid: amount || pkg.discountPrice || pkg.price,
            paymentMethod: 'Razorpay',
            razorpayPaymentId: paymentId,
            paymentStatus: 'COMPLETED',
            purchaseDate: new Date().toISOString()
        };

        const updatedStudent = {
            ...(profile || student),
            uid: studentId,
            id: studentId,
            remainingTests: currentRemaining + addedQuota,
            allowedTests: currentAllowed + addedQuota,
            purchasedPackages: [...((profile?.purchasedPackages || student.purchasedPackages) || []), newPurchasedPackage],
            updatedAt: new Date().toISOString()
        };

        const requestData = {
            id: 'req_rzp_' + Date.now(),
            studentId: studentId,
            studentName: student.name,
            studentEmail: student.email,
            studentMobile: student.mobile || '9876543210',
            packageId: pkg.id,
            packageName: pkg.name,
            targetExam: pkg.exam,
            testQuota: addedQuota,
            amount: amount || pkg.discountPrice || pkg.price,
            paymentMethod: 'Razorpay',
            utrNumber: paymentId,
            razorpayPaymentId: paymentId,
            status: 'approved',
            createdAt: new Date().toISOString(),
            approvedAt: new Date().toISOString()
        };

        if (isFirebaseConnected && db) {
            try {
                await setDoc(doc(db, 'users', studentId), updatedStudent, { merge: true });
                await setDoc(doc(db, 'package_requests', requestData.id), requestData);

                const currUser = storageService.getCurrentUser();
                if (currUser && (currUser.id === studentId || currUser.uid === studentId)) {
                    storageService.setCurrentUser(updatedStudent);
                }

                return {
                    success: true,
                    user: updatedStudent,
                    message: `Payment Successful! ${addedQuota} Tests credited instantly to your account.`
                };
            } catch (e) {
                console.error('[Firestore Engine] Razorpay Firestore credit error:', e.message);
                throw e;
            }
        }
        throw new Error('Firestore database is not connected.');
    },

    // 15. Admin Merchant Payment Settings (Source of Truth: Firestore 'settings/payment' document)
    getMerchantPaymentSettings: async () => {
        const envKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RAZORPAY_KEY_ID) ? import.meta.env.VITE_RAZORPAY_KEY_ID : '';
        const DEFAULT_KEY = 'rzp_test_E66NI3Yg44x1mj';

        const resolveKey = (adminSavedKey) => {
            if (adminSavedKey && adminSavedKey.trim() && adminSavedKey.trim() !== 'rzp_test_sigmaforce2026') {
                return adminSavedKey.trim();
            }
            if (envKey && envKey.trim() && envKey.trim() !== 'rzp_test_sigmaforce2026') {
                return envKey.trim();
            }
            return DEFAULT_KEY;
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
