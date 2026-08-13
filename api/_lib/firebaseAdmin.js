/**
 * Shared firebase-admin bootstrap for Vercel serverless functions under /api.
 * Reads the service account from process.env.FIREBASE_SERVICE_ACCOUNT_KEY
 * (set in Vercel Project Settings -> Environment Variables, as a single-line
 * JSON string) in production, falling back to the local serviceAccountKey.json
 * file used by scripts/seedFirestoreAdmin.js for local `vercel dev` testing.
 * Never commit serviceAccountKey.json — it's already in .gitignore.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

function loadServiceAccount() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    }

    const localPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(localPath)) {
        return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }

    throw new Error(
        'No Firebase service account found. Set FIREBASE_SERVICE_ACCOUNT_KEY in Vercel ' +
        'Project Settings, or place serviceAccountKey.json in the repo root for local vercel dev.'
    );
}

let dbInstance = null;

export function getAdminDb() {
    if (dbInstance) return dbInstance;

    if (getApps().length === 0) {
        initializeApp({ credential: cert(loadServiceAccount()) });
    }

    dbInstance = getFirestore();
    return dbInstance;
}
