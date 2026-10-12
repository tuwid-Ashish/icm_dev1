/**
 * POST /api/admin/reset-password      (administrators only)
 * Body: { uid, password? }
 *
 * Sets a new login password for a student who has forgotten theirs, so an admin
 * can hand it to them. If `password` is omitted the server generates a strong
 * one; either way the new password is returned ONCE in the response and is not
 * stored or logged anywhere.
 *
 * Deliberately limited:
 *   - students only: an account carrying the admin claim (or an admin profile)
 *     is refused, so this tool can never be used to take over an admin login
 *   - the student's existing sessions are revoked, so a device that still has
 *     the old password signed in is signed out when its session next refreshes
 *   - each reset is recorded in admin_actions (who, for whom, when) — never the
 *     password itself
 *
 * Needs the student to have a real login (a Firebase Auth account). A profile
 * created by hand in the admin screen has none; that is reported clearly rather
 * than silently creating a login under a different id.
 */
import crypto from 'crypto';
import { adminAuth, adminDb, requireAdmin } from '../../../lib/firebaseAdmin.js';

// No 0/O, 1/l/I — this gets read out over the phone or typed from WhatsApp.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const generatePassword = (length = 10) =>
    Array.from({ length }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const caller = await requireAdmin(req, res);
    if (!caller) return;

    const { uid, password } = req.body || {};
    if (!uid || typeof uid !== 'string') {
        res.status(400).json({ error: 'A student is required.' });
        return;
    }
    if (password !== undefined && password !== null && password !== '') {
        if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
            res.status(400).json({ error: 'The password must be between 8 and 128 characters.' });
            return;
        }
    }
    const chosen = typeof password === 'string' && password.length > 0 ? password : null;

    try {
        let target;
        try {
            target = await adminAuth.getUser(uid);
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                res.status(404).json({ error: 'This student has no login account, so there is no password to reset. (Profiles added by hand in the admin screen cannot sign in.)' });
                return;
            }
            throw err;
        }

        const profile = await adminDb.collection('users').doc(uid).get();
        if ((target.customClaims && target.customClaims.admin) || (profile.exists && profile.data().role === 'admin')) {
            res.status(403).json({ error: 'Administrator accounts cannot be changed from here.' });
            return;
        }

        const newPassword = chosen || generatePassword();
        await adminAuth.updateUser(uid, { password: newPassword });
        await adminAuth.revokeRefreshTokens(uid);

        try {
            await adminDb.collection('admin_actions').add({
                type: 'password_reset',
                targetUid: uid,
                byUid: caller.uid,
                generated: !chosen,
                at: new Date().toISOString()
            });
        } catch (auditErr) {
            // The password has already changed; failing the request now would
            // leave the admin unable to tell the student what it is.
            console.error('[admin/reset-password] Could not write audit record:', auditErr.message);
        }

        res.status(200).json({ success: true, password: newPassword, generated: !chosen, email: target.email || '' });
    } catch (err) {
        console.error('[admin/reset-password] Failed:', err.code || err.message);
        res.status(500).json({ error: 'Could not reset the password. Please try again.' });
    }
}
