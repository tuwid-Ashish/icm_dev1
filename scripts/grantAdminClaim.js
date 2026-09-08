/**
 * Grants / revokes the `admin` Firebase custom claim.
 *
 * Admin used to be decided by `email.toLowerCase().includes('admin')` in the
 * browser, so anyone registering as admin.foo@gmail.com became one — and the
 * Firestore rules trusted whatever role the client had written. Admin is now a
 * signed custom claim: it can only be set here, with the service account, and
 * it is what both the app and firestore.rules check.
 *
 *   node scripts/grantAdminClaim.js --list
 *   node scripts/grantAdminClaim.js someone@example.com
 *   node scripts/grantAdminClaim.js someone@example.com --revoke
 *
 * The account must already exist in Firebase Auth (create it with
 * scripts/createAdminAccount.js first). After a change the person must sign
 * out and back in — custom claims land in a token when it is next issued.
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found at project root.');
    process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();
const db = getFirestore();

const args = process.argv.slice(2);
const LIST = args.includes('--list');
const REVOKE = args.includes('--revoke');
const email = args.find(a => !a.startsWith('--'));

async function list() {
    console.log('\n👑 Accounts and their admin status\n');
    const usersSnap = await db.collection('users').get();
    for (const d of usersSnap.docs) {
        const data = d.data();
        let claim = false;
        let authExists = true;
        try {
            const rec = await auth.getUser(d.id);
            claim = rec.customClaims?.admin === true;
        } catch {
            authExists = false;
        }
        const docRole = data.role || '(none)';
        const mismatch = (docRole === 'admin') !== claim;
        console.log(
            `   ${String(data.email || '(no email)').padEnd(34)} ` +
            `doc.role=${docRole.padEnd(8)} claim.admin=${String(claim).padEnd(6)}` +
            `${!authExists ? '  ⚠️ no Firebase Auth account' : ''}` +
            `${mismatch && authExists ? '  ⚠️ MISMATCH' : ''}`
        );
    }
    console.log('\n   A doc.role of admin with claim.admin=false can no longer do anything:');
    console.log('   the rules check the claim. Grant it with:');
    console.log('     node scripts/grantAdminClaim.js <email>\n');
}

async function apply() {
    const user = await auth.getUserByEmail(email);
    const nextClaims = { ...(user.customClaims || {}) };

    if (REVOKE) delete nextClaims.admin;
    else nextClaims.admin = true;

    await auth.setCustomUserClaims(user.uid, nextClaims);

    // Keep the Firestore mirror in step so the UI shows the right thing.
    await db.collection('users').doc(user.uid).set(
        { role: REVOKE ? 'student' : 'admin', updatedAt: new Date().toISOString() },
        { merge: true }
    );

    console.log(`\n✅ ${REVOKE ? 'Revoked' : 'Granted'} admin for ${email} (uid ${user.uid}).`);
    console.log('   They must sign out and back in for the new token to take effect.\n');
}

(async () => {
    try {
        if (LIST || !email) {
            await list();
        } else {
            await apply();
        }
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Failed:', err.message);
        process.exit(1);
    }
})();
