/**
 * POST /api/admin/create-student      (administrators only)
 * Body: { name, email, mobile, enrollmentId?, allowedTests?, password? }
 *
 * Creates a student who can actually sign in: a Firebase login AND the profile
 * the app reads, under the same id.
 *
 * The admin screen used to write only a profile, under a made-up id
 * (std_<timestamp>). With no login behind it the student could never sign in,
 * and the profile could never match anything the app looks up by login id. The
 * profile's document id MUST be the login's uid — the security rules and every
 * lookup depend on it — so the login is created first and its uid is used.
 *
 * Either step failing leaves nothing half-made: if the profile cannot be
 * written, the login that was just created is deleted again.
 *
 * Like reset-password, the password is generated here (or chosen by the admin),
 * returned once, and never stored or logged.
 */
import crypto from 'crypto';
import { adminAuth, adminDb, requireAdmin } from '../../../lib/firebaseAdmin.js';
import { describeAuthError } from '../../../lib/authErrors.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const generatePassword = (length = 10) =>
    Array.from({ length }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const caller = await requireAdmin(req, res);
    if (!caller) return;

    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : '';
    const quota = body.allowedTests === undefined || body.allowedTests === '' ? 0 : Number(body.allowedTests);

    if (!name || name.length > 100) {
        res.status(400).json({ error: 'A name is required (up to 100 characters).' });
        return;
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
        res.status(400).json({ error: 'A valid email address is required.' });
        return;
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
        res.status(400).json({ error: 'The mobile number must be exactly 10 digits.' });
        return;
    }
    if (!Number.isInteger(quota) || quota < 0 || quota > 500) {
        res.status(400).json({ error: 'The test quota must be a whole number from 0 to 500.' });
        return;
    }
    const typed = typeof body.password === 'string' ? body.password : '';
    if (typed && (typed.length < 8 || typed.length > 128)) {
        res.status(400).json({ error: 'The password must be between 8 and 128 characters.' });
        return;
    }
    const password = typed || generatePassword();
    const enrollmentId = (typeof body.enrollmentId === 'string' && body.enrollmentId.trim())
        ? body.enrollmentId.trim().slice(0, 40)
        : 'SIGMA-2026-' + Math.floor(1000 + Math.random() * 9000);

    let created = null;
    try {
        created = await adminAuth.createUser({ email, password, displayName: name });

        const now = new Date().toISOString();
        await adminDb.collection('users').doc(created.uid).set({
            uid: created.uid,
            id: created.uid,
            name,
            email,
            mobile,
            role: 'student',
            status: 'active',
            enrollmentId,
            allowedTests: quota,
            remainingTests: quota,
            completedTests: 0,
            purchasedPackages: [],
            createdAt: now,
            createdByAdmin: caller.uid
        });

        try {
            await adminDb.collection('admin_actions').add({
                type: 'student_created',
                targetUid: created.uid,
                byUid: caller.uid,
                generated: !typed,
                at: now
            });
        } catch (auditErr) {
            console.error('[admin/create-student] Could not write audit record:', auditErr.message);
        }

        res.status(200).json({ success: true, uid: created.uid, email, password, generated: !typed });
    } catch (err) {
        // Do not leave a login with no profile behind.
        if (created) {
            await adminAuth.deleteUser(created.uid).catch(e =>
                console.error('[admin/create-student] Could not undo login creation:', e.message));
        }
        console.error('[admin/create-student] Failed:', err.code || '', err.message || err);
        const d = describeAuthError(err, 'Could not create the student.');
        res.status(d.status).json({ error: d.message, detail: d.detail });
    }
}
