import { 
    auth, 
    db, 
    isFirebaseConnected, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut as firebaseSignOut, 
    onAuthStateChanged,
    doc,
    setDoc,
    getDoc
} from './firebase.js';

import { storageService } from './storageService.js';

export const firebaseAuthService = {
    // 1. Register New Student Account (with mandatory mobile, 0 free tests initial quota)
    registerStudent: async (name, email, password, mobile) => {
        if (isFirebaseConnected && auth && db) {
            try {
                // Step 1: Create Auth user in Firebase Authentication
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                const uid = userCred.user.uid;

                // Step 2: Create Student Profile Document in Cloud Firestore (users/{uid})
                const enrollmentId = 'SIGMA-2026-' + Math.floor(1000 + Math.random() * 9000);
                const userProfile = {
                    uid,
                    id: uid,
                    name,
                    email,
                    mobile: mobile || '',
                    role: email === 'admin@sigma.com' ? 'admin' : 'student',
                    allowedTests: 0,
                    remainingTests: 0,
                    completedTests: 0,
                    enrollmentId,
                    purchasedPackages: [],
                    status: 'active',
                    createdAt: new Date().toISOString()
                };

                await setDoc(doc(db, 'users', uid), userProfile);
                console.log('[Firebase Auth] Created Firestore profile for user:', uid);

                return { success: true, user: userProfile };
            } catch (err) {
                console.error('[Firebase Auth] Registration error:', err);
                return { success: false, message: err.message };
            }
        }

        // Local Fallback if Firebase not configured
        const userObj = {
            id: 'std_' + Date.now(),
            name,
            email,
            mobile: mobile || '',
            password,
            role: 'student',
            allowedTests: 0,
            remainingTests: 0,
            completedTests: 0,
            enrollmentId: 'SIGMA-2026-LOC',
            purchasedPackages: [],
            status: 'active',
            createdAt: new Date().toISOString()
        };

        storageService.setCurrentUser(userObj);
        return { success: true, user: userObj };
    },

    // 2. Login User with Strict Role Isolation
    loginUser: async (email, password, expectedRole = 'student') => {
        if (isFirebaseConnected && auth && db) {
            try {
                const userCred = await signInWithEmailAndPassword(auth, email, password);
                const uid = userCred.user.uid;

                // Fetch student profile document from Firestore
                const userDoc = await getDoc(doc(db, 'users', uid));
                let userProfile = null;
                if (userDoc.exists()) {
                    userProfile = { id: userDoc.id, ...userDoc.data() };
                } else {
                    userProfile = {
                        uid,
                        id: uid,
                        name: userCred.user.displayName || email.split('@')[0],
                        email,
                        mobile: '',
                        role: email.toLowerCase().includes('admin') ? 'admin' : 'student',
                        allowedTests: 0,
                        remainingTests: 0,
                        completedTests: 0,
                        purchasedPackages: [],
                        status: 'active'
                    };
                }

                if (userProfile.role !== expectedRole) {
                    await firebaseSignOut(auth);
                    if (expectedRole === 'student') {
                        return { success: false, message: 'Admin accounts must log in via the dedicated /admin portal.' };
                    } else {
                        return { success: false, message: 'Student accounts cannot access the system administration portal.' };
                    }
                }

                return { success: true, user: userProfile };
            } catch (err) {
                console.error('[Firebase Auth] Login error:', err);
                return { success: false, message: err.message };
            }
        }

        // Demo Accounts Fallback with Strict Role Isolation
        if (email === 'admin@sigma.com' && password === 'admin123') {
            if (expectedRole !== 'admin') {
                return { success: false, message: 'Admin accounts must log in via the dedicated /admin portal.' };
            }
            const adminUser = {
                id: 'admin_1',
                name: 'System Administrator',
                email: 'admin@sigma.com',
                mobile: '9876543210',
                role: 'admin',
                status: 'active'
            };
            return { success: true, user: adminUser };
        }

        if (email === 'student@sigma.com' && password === 'pass123') {
            if (expectedRole !== 'student') {
                return { success: false, message: 'Student accounts cannot access the system administration portal.' };
            }
            const studentUser = {
                id: 'std_101',
                name: 'Alex Student',
                email: 'student@sigma.com',
                mobile: '9876543210',
                role: 'student',
                allowedTests: 0,
                remainingTests: 0,
                completedTests: 0,
                enrollmentId: 'SIGMA-2026-101',
                purchasedPackages: [],
                status: 'active'
            };
            return { success: true, user: studentUser };
        }

        return { success: false, message: 'Invalid email or password.' };
    },

    // 3. Sign Out
    logoutUser: async () => {
        if (isFirebaseConnected && auth) {
            try {
                await firebaseSignOut(auth);
            } catch (e) {
                console.warn('[Firebase Auth] Error signing out:', e);
            }
        }
        storageService.setCurrentUser(null);
    },

    // 4. Subscribe to Real-time Auth State Changes
    subscribeAuthState: (callback) => {
        if (isFirebaseConnected && auth && db) {
            return onAuthStateChanged(auth, async (authUser) => {
                if (authUser) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', authUser.uid));
                        if (userDoc.exists()) {
                            callback({ id: userDoc.id, ...userDoc.data() });
                        } else {
                            callback({
                                id: authUser.uid,
                                name: authUser.displayName || authUser.email.split('@')[0],
                                email: authUser.email,
                                role: authUser.email.includes('admin') ? 'admin' : 'student',
                                status: 'active'
                            });
                        }
                    } catch (e) {
                        callback(null);
                    }
                } else {
                    callback(null);
                }
            });
        }

        // Fallback for non-Firebase environment
        const current = storageService.getCurrentUser();
        callback(current);
        return () => {};
    }
};
