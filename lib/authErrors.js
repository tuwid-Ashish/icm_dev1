/**
 * Turns a Firebase Admin error into { status, message, detail } for the admin
 * tools that manage logins.
 *
 * These routes are administrator-only, so it is safe — and far more useful — to
 * tell the admin what actually went wrong. A generic "please try again" hid the
 * real cause of a failure that only happens in production, where the admin had
 * no way to see the server log.
 *
 * `detail` is the raw Firebase error code or message, shown in small print for
 * anyone who needs to look the problem up. It never contains a password.
 */
export function describeAuthError(err, fallback = 'Something went wrong on the server.') {
    const code = (err && err.code) || '';
    const raw = String((err && err.message) || '');
    const text = `${code} ${raw}`;

    if (code === 'auth/email-already-exists') {
        return { status: 409, message: 'A login with this email address already exists.' };
    }
    if (code === 'auth/invalid-email') {
        return { status: 400, message: 'That email address is not valid.' };
    }
    if (code === 'auth/invalid-password' || code === 'auth/weak-password') {
        return { status: 400, message: 'That password is not accepted. Use at least 8 characters.' };
    }
    if (code === 'auth/user-not-found') {
        return { status: 404, message: 'This student has no login account.' };
    }
    if (code === 'auth/operation-not-allowed') {
        return {
            status: 500,
            message: 'Email and password sign-in is turned off for this Firebase project. Turn it on in Firebase Console, under Authentication, Sign-in method.',
            detail: code
        };
    }
    // The key can read and write the database but is not allowed to manage logins.
    if (code === 'auth/insufficient-permission' || /PERMISSION_DENIED|insufficient permission|does not have permission|not authorized/i.test(text)) {
        return {
            status: 500,
            message: 'The server key is not allowed to manage logins. In Google Cloud Console, open IAM and give the Firebase service account the "Firebase Authentication Admin" role.',
            detail: code || raw.slice(0, 160)
        };
    }
    // The key itself was rejected or is malformed.
    if (/credential|access token|invalid_grant|private key|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(text)) {
        return {
            status: 500,
            message: 'The server could not sign in to Firebase. Check the FIREBASE_SERVICE_ACCOUNT value in Vercel, or try again in a moment.',
            detail: code || raw.slice(0, 160)
        };
    }
    return { status: 500, message: fallback, detail: code || raw.slice(0, 160) };
}
