import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc as rawSetDoc,
  getDoc as rawGetDoc,
  collection,
  getDocs as rawGetDocs,
  addDoc as rawAddDoc,
  updateDoc as rawUpdateDoc,
  deleteDoc as rawDeleteDoc,
  writeBatch as rawWriteBatch,
  query,
  where,
  getCountFromServer as rawGetCountFromServer
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
};

let app = null;
let auth = null;
let db = null;
let isFirebaseConnected = false;

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseConnected = true;
    console.log('[Firebase] Real Firebase initialized successfully for project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('[Firebase] Warning initializing Firebase SDK:', err);
  }
} else {
  console.info('[Firebase] Operating in local fallback mode. Add keys to .env file to connect live Cloud Firestore.');
}

// ---- Daily-limit detection --------------------------------------------------
// When Firebase's daily allowance is used up, every read and write fails with
// "resource-exhausted". Most of the app catches errors and shows an empty list,
// so to an admin that looks like "my questions are gone". Every Firestore call
// below goes through a guard that notices this one error, tells the admin
// screens (which show a clear message with the numbers), and then rethrows —
// so nothing else about how a call behaves changes.
export const QUOTA_EVENT = 'sigma:quota-exceeded';
let lastQuotaReport = 0;

export function reportFirestoreError(err) {
  const text = `${(err && err.code) || ''} ${(err && err.message) || ''}`;
  if (!/resource-exhausted|quota exceeded/i.test(text)) return;
  const now = Date.now();
  if (now - lastQuotaReport < 5000) return;
  lastQuotaReport = now;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(QUOTA_EVENT));
}

const guard = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    reportFirestoreError(err);
    throw err;
  }
};

const setDoc = guard(rawSetDoc);
const getDoc = guard(rawGetDoc);
const getDocs = guard(rawGetDocs);
const addDoc = guard(rawAddDoc);
const updateDoc = guard(rawUpdateDoc);
const deleteDoc = guard(rawDeleteDoc);
const getCountFromServer = guard(rawGetCountFromServer);

// A batch's failure surfaces when it is committed, not when it is created.
const writeBatch = (...args) => {
  const batch = rawWriteBatch(...args);
  const commit = batch.commit.bind(batch);
  batch.commit = async () => {
    try {
      return await commit();
    } catch (err) {
      reportFirestoreError(err);
      throw err;
    }
  };
  return batch;
};

export {
  app,
  auth,
  db,
  isFirebaseConnected,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  getCountFromServer
};
