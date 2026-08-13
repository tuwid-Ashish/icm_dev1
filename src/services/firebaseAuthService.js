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
    // 1. Register New Student Account
    registerStudent: async (name, email, password, mobile) => {
        if (isFirebaseConnected && auth && db) {
            try {
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                const uid = userCred.user.uid;

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

                storageService.setCurrentUser(userProfile);
                return { success: true, user: userProfile };
            } catch (err) {
                console.error('[Firebase Auth] Registration error:', err);
                return { success: false, message: err.message };
            }
        }
        return { success: false, message: 'Firebase authentication service unavailable.' };
    },

    // 2. Login User with Strict Role Isolation
    loginUser: async (email, password, expectedRole = 'student') => {
        if (isFirebaseConnected && auth && db) {
            try {
                const userCred = await signInWithEmailAndPassword(auth, email, password);
                const uid = userCred.user.uid;

                const userDoc = await getDoc(doc(db, 'users', uid));
                let userProfile = null;
                if (userDoc.exists()) {
                    userProfile = { id: userDoc.id, uid: userDoc.id, ...userDoc.data() };
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
                        status: 'active',
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(doc(db, 'users', uid), userProfile);
                }

                if (userProfile.role !== expectedRole) {
                    await firebaseSignOut(auth);
                    if (expectedRole === 'student') {
                        return { success: false, message: 'Admin accounts must log in via the dedicated /admin portal.' };
                    } else {
                        return { success: false, message: 'Student accounts cannot access the system administration portal.' };
                    }
                }

                storageService.setCurrentUser(userProfile);
                return { success: true, user: userProfile };
            } catch (err) {
                console.error('[Firebase Auth] Login error:', err);
                return { success: false, message: err.message || 'Invalid email or password.' };
            }
        }
        return { success: false, message: 'Firebase authentication service unavailable.' };
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
                            const p = { id: userDoc.id, uid: userDoc.id, ...userDoc.data() };
                            storageService.setCurrentUser(p);
                            callback(p);
                        } else {
                            const p = {
                                uid: authUser.uid,
                                id: authUser.uid,
                                name: authUser.displayName || authUser.email.split('@')[0],
                                email: authUser.email,
                                role: authUser.email.includes('admin') ? 'admin' : 'student',
                                status: 'active'
                            };
                            storageService.setCurrentUser(p);
                            callback(p);
                        }
                    } catch (e) {
                        callback(null);
                    }
                } else {
                    storageService.setCurrentUser(null);
                    callback(null);
                }
            });
        }

        const current = storageService.getCurrentUser();
        callback(current);
        return () => {};
    }
};
