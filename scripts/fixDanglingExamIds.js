/**
 * A1 — repair purchasedPackages[].examId values that point at no exam.
 *
 * Purchases were written with an older exam id scheme (police_bharti, ssc_gd,
 * vanrakshak, mh_police_2026). The exams they refer to are now pb / gd / vr, so
 * getExamAccess finds no match, falls through to comparing display names
 * ("Police Bharti" vs "महाराष्ट्र पोलीस भरती"), fails there too, and reports
 * no_package — the student paid and cannot open the exam.
 *
 * This is the cost of joining on a display label instead of an id. The repair
 * re-points each purchase at the real exam document id.
 *
 *   node scripts/fixDanglingExamIds.js                    # report only
 *   node scripts/fixDanglingExamIds.js --commit           # remap to real ids
 *   node scripts/fixDanglingExamIds.js --commit --delete  # drop the entries instead
 *
 * --delete is for test transactions you would rather remove than keep. It
 * removes only the dangling purchase entries; it never touches the user, their
 * quota, or any entry that already resolves.
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COMMIT = process.argv.includes('--commit');
const DELETE = process.argv.includes('--delete');

// Old id -> current exam document id.
const ID_MAP = {
    police_bharti: 'pb',
    mh_police_2026: 'pb',
    ssc_gd: 'gd',
    vanrakshak: 'vr'
};

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found at project root.');
    process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const mask = (s) => (!s ? '(none)' : s.length <= 4 ? '***' : s.slice(0, 3) + '***' + s.slice(-4));

async function run() {
    console.log(COMMIT
        ? `\n✍️  COMMIT MODE — will ${DELETE ? 'DELETE dangling entries' : 'remap examIds'}`
        : '\n🔎 REPORT ONLY — no writes (pass --commit to apply)');

    const examIds = new Set((await db.collection('exams').get()).docs.map(d => d.id));
    console.log('   existing exams:', [...examIds].join(', '), '\n');

    const usersSnap = await db.collection('users').get();
    let totalDangling = 0;
    let totalFixable = 0;
    const plan = [];

    for (const userDoc of usersSnap.docs) {
        const user = userDoc.data();
        const purchases = user.purchasedPackages || [];
        if (!purchases.length) continue;

        const dangling = purchases.filter(p => !p.examId || !examIds.has(p.examId));
        if (!dangling.length) continue;

        console.log(`▸ ${mask(user.email)}  uid=${userDoc.id.slice(0, 10)}…  (${purchases.length} purchase(s))`);

        const next = purchases.map(p => {
            if (p.examId && examIds.has(p.examId)) {
                console.log(`    ok   examId="${p.examId}" — untouched`);
                return p;
            }
            totalDangling++;
            const target = ID_MAP[p.examId];
            const paid = p.amountPaid !== undefined ? `₹${p.amountPaid}` : '(no amount)';
            const ref = p.paymentReference || '(no ref)';

            if (DELETE) {
                console.log(`    DEL  examId="${p.examId}" exam="${p.exam}" ${paid} ref=${ref}`);
                return null;
            }
            if (target) {
                totalFixable++;
                console.log(`    FIX  examId="${p.examId}" → "${target}"   exam="${p.exam}" ${paid} ref=${ref}`);
                return { ...p, examId: target, examIdRepairedFrom: p.examId, repairedAt: new Date().toISOString() };
            }
            console.log(`    ??   examId="${p.examId}" — no mapping, LEFT AS IS   exam="${p.exam}" ${paid}`);
            return p;
        }).filter(Boolean);

        plan.push({ ref: userDoc.ref, uid: userDoc.id, next, before: purchases.length });
        console.log('');
    }

    if (!plan.length) {
        console.log('   Nothing dangling. All purchases resolve to a real exam.\n');
        process.exit(0);
    }

    console.log('─'.repeat(70));
    console.log(`   users affected      : ${plan.length}`);
    console.log(`   dangling entries    : ${totalDangling}`);
    console.log(DELETE ? `   entries to delete   : ${totalDangling}` : `   entries remappable  : ${totalFixable}`);
    console.log('─'.repeat(70));

    if (!COMMIT) {
        console.log('\n   Re-run with --commit to apply.\n');
        process.exit(0);
    }

    const batch = db.batch();
    plan.forEach(p => batch.update(p.ref, {
        purchasedPackages: p.next,
        updatedAt: new Date().toISOString()
    }));
    await batch.commit();

    console.log(`\n✅ Updated ${plan.length} user document(s). Quota fields were not touched.`);
    console.log('   Verify with: node scripts/auditDb.js\n');
    process.exit(0);
}

run().catch(err => {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
});
