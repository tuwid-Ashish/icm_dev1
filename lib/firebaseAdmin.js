/**
 * Firebase Admin SDK singleton for Next.js API routes (server only).
 *
 * Never import this from anything under src/ — it holds a private key and
 * bypasses Firestore security rules by design. It exists so that quota,
 * role and purchase writes can happen somewhere the browser cannot reach.
 *
 * Credentials, in priority order:
 *   1. FIREBASE_SERVICE_ACCOUNT — the service account JSON as a single-line
 *      string (this is what you set in the Vercel dashboard).
 *   2. serviceAccountKey.json at the project root (local development only;
 *      it is gitignored and is NOT deployed).
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function loadCredential() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (raw && raw.trim()) {
        try {
            return cert(JSON.parse(raw));
        } catch (e) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON: ' + e.message);
        }
    }

    const localPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(localPath)) {
        return cert(JSON.parse(fs.readFileSync(localPath, 'utf-8')));
    }

    throw new Error(
        'No Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT (service account JSON) ' +
        'in the deployment environment, or place serviceAccountKey.json at the project root for local dev.'
    );
}

const app = getApps().length ? getApp() : initializeApp({ credential: loadCredential() });

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

/**
 * Resolves the caller's identity from the `Authorization: Bearer <idToken>`
 * header. Returns the decoded token, or null when absent/invalid.
 *
 * A request body can claim to be any student; a verified ID token cannot.
 * Every write performed on a user's behalf must key off this, never off a
 * uid sent in the body.
 */
export async function verifyCaller(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return null;
    try {
        return await adminAuth.verifyIdToken(token);
    } catch {
        return null;
    }
}

/**
 * Like verifyCaller, but also requires the signed `admin` custom claim.
 * Sends the 401/403 response itself and returns null when the caller is not an
 * admin, so a route can simply `if (!caller) return;`.
 *
 * The claim is set by scripts/grantAdminClaim.js and cannot be edited by the
 * browser — unlike the `role` field on the user profile, which a route must
 * never trust for permissions.
 */
export async function requireAdmin(req, res) {
    const caller = await verifyCaller(req);
    if (!caller) {
        res.status(401).json({ error: 'Sign in required.' });
        return null;
    }
    if (caller.admin !== true) {
        res.status(403).json({ error: 'Administrators only.' });
        return null;
    }
    return caller;
}
