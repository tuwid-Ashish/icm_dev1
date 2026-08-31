import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

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
  writeBatch
};

