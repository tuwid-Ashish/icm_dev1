import React, { createContext, useContext, useState, useEffect } from 'react';
import { firebaseAuthService } from '../services/firebaseAuthService.js';
import { storageService } from '../services/storageService.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => storageService.getCurrentUser());
    const [authLoading, setAuthLoading] = useState(true);

    // Subscribe to Firebase Auth state listener
    useEffect(() => {
        const unsubscribe = firebaseAuthService.subscribeAuthState((authUser) => {
            if (authUser) {
                setUser(authUser);
                storageService.setCurrentUser(authUser);
            } else {
                setUser(null);
                storageService.setCurrentUser(null);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Login Method with expectedRole parameter
    const login = async (email, password, expectedRole = 'student') => {
        const res = await firebaseAuthService.loginUser(email, password, expectedRole);
        if (res.success) {
            setUser(res.user);
            storageService.setCurrentUser(res.user);
        }
        return res;
    };

    // Signup Method (with mandatory mobile)
    const signup = async (name, email, password, mobile) => {
        const res = await firebaseAuthService.registerStudent(name, email, password, mobile);
        if (res.success) {
            setUser(res.user);
            storageService.setCurrentUser(res.user);
        }
        return res;
    };

    // Logout Method
    const logout = async () => {
        await firebaseAuthService.logoutUser();
        setUser(null);
        storageService.setCurrentUser(null);
    };

    // Refresh User State from Storage or Firestore (Async sync with fresh DB data)
    const refreshUser = async () => {
        const current = storageService.getCurrentUser();
        if (current && (current.id || current.uid)) {
            const latest = await firestoreEngine.getUserProfile(current.id || current.uid);
            if (latest) {
                setUser({ ...latest });
                storageService.setCurrentUser(latest);
                return;
            }
        }
        const updated = storageService.getCurrentUser();
        setUser(updated ? { ...updated } : null);
    };

    return (
        <AuthContext.Provider value={{ user, authLoading, login, signup, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
