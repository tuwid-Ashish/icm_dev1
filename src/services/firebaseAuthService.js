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
    registerStudent: async (name, email, password) => {
        if (isFirebaseConnected && auth && db) {
            try {
                // Step 1: Create Auth user in Firebase Authentication
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                const uid = userCred.user.uid;

                // Step 2: Create Student Profile Document in Cloud Firestore (users/{uid})
                const enrollmentId = 'SIGMA-2026-' + Math.floor(1000 + Math.random() * 9000);
                const userProfile = {
                    uid,
                    name,
                    email,
                    role: email === 'admin@sigma.com' ? 'admin' : 'student',
                    allowedTests: 20,
                    remainingTests: 20,
                    completedTests: 0,
                    enrollmentId,
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
            password,
            role: 'student',
            allowedTests: 20,
            remainingTests: 20,
            completedTests: 0,
            enrollmentId: 'SIGMA-2026-LOC',
            status: 'active'
        };
        storageService.saveStudent(userObj);
        storageService.setCurrentUser(userObj);
        return { success: true, user: userObj };
    },

    // 2. Sign In User (Student or Admin)
    loginUser: async (email, password) => {
        if (isFirebaseConnected && auth && db) {
            try {
                // Step 1: Authenticate with Firebase Auth
                const userCred = await signInWithEmailAndPassword(auth, email, password);
                const uid = userCred.user.uid;

                // Step 2: Fetch User Profile from Firestore
                const userDocRef = doc(db, 'users', uid);
                const snap = await getDoc(userDocRef);

                let userProfile;
                if (snap.exists()) {
                    userProfile = { id: snap.id, ...snap.data() };
                } else {
                    // Initialize default profile if doc missing
                    const enrollmentId = 'SIGMA-2026-' + Math.floor(1000 + Math.random() * 9000);
                    userProfile = {
                        uid,
                        id: uid,
                        name: userCred.user.displayName || email.split('@')[0],
                        email,
                        role: email === 'admin@sigma.com' ? 'admin' : 'student',
                        allowedTests: 20,
                        remainingTests: 20,
                        completedTests: 0,
                        enrollmentId,
                        status: 'active',
                        createdAt: new Date().toISOString()
                    };
                    await setDoc(userDocRef, userProfile);
                }

                console.log('[Firebase Auth] User signed in:', userProfile.email);
                return { success: true, user: userProfile };
            } catch (err) {
                console.error('[Firebase Auth] Sign in error:', err.code, err.message);
                let msg = 'Authentication failed. Please check your credentials.';
                if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    msg = 'Invalid email or password.';
                } else if (err.code === 'auth/invalid-email') {
                    msg = 'Please enter a valid email address.';
                }
                return { success: false, message: msg };
            }
        }

        // Fallback for demo testing
        const res = storageService.login(email, password);
        return res;
    },

    // 3. Sign Out User
    logoutUser: async () => {
        if (isFirebaseConnected && auth) {
            try {
                await firebaseSignOut(auth);
            } catch (err) {
                console.error('[Firebase Auth] Sign out error:', err);
            }
        }
        storageService.setCurrentUser(null);
    },

    // 4. Subscribe Auth State Listener
    subscribeAuthState: (onUserChanged) => {
        if (isFirebaseConnected && auth && db) {
            return onAuthStateChanged(auth, async (firebaseUser) => {
                if (firebaseUser) {
                    try {
                        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
                        if (snap.exists()) {
                            onUserChanged({ id: snap.id, ...snap.data() });
                            return;
                        }
                    } catch (e) {
                        console.warn('[Firebase Auth] Error loading user doc:', e);
                    }
                    onUserChanged({
                        id: firebaseUser.uid,
                        uid: firebaseUser.uid,
                        name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                        email: firebaseUser.email,
                        role: firebaseUser.email === 'admin@sigma.com' ? 'admin' : 'student',
                        allowedTests: 20,
                        remainingTests: 20,
                        completedTests: 0,
                        enrollmentId: 'SIGMA-2026-FB'
                    });
                } else {
                    onUserChanged(null);
                }
            });
        }
        return () => {};
    }
};
