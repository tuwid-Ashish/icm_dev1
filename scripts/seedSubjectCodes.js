/**
 * Creates the `subject_codes` collection from DEFAULT_SUBJECT_CODES (M1-M9).
 *
 * The audit confirmed this collection has never existed: firestore.rules had no
 * match block for it, so the client's own first-load seed (firestoreEngine
 * .getSubjectCodes) was denied every time. M1-M9 have therefore only ever been
 * a hardcoded array the admin UI pretended to manage — which is why "deleting"
 * a default silently did nothing and adding M10 appeared to erase the rest.
 *
 * Seeding them as real documents makes the subject master actual data: editable,
 * deletable, and the single source every consumer resolves against.
 *
 * Existing documents are never overwritten — only missing codes are created.
 *
 *   node scripts/seedSubjectCodes.js            # dry run, writes nothing
 *   node scripts/seedSubjectCodes.js --commit   # actually write
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_SUBJECT_CODES } from '../src/constants/subjectCodes.js';

const COMMIT = process.argv.includes('--commit');

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found at project root.');
    process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
    console.log(COMMIT ? '\n✍️  COMMIT MODE — will write' : '\n🔎 DRY RUN — no writes (pass --commit to apply)');
    console.log('   project:', serviceAccount.project_id, '\n');

    const existing = new Set((await db.collection('subject_codes').get()).docs.map(d => d.id));
    console.log(`   subject_codes currently holds ${existing.size} document(s).\n`);

    const toCreate = DEFAULT_SUBJECT_CODES.filter(s => !existing.has(s.code));
    const skipped = DEFAULT_SUBJECT_CODES.filter(s => existing.has(s.code));

    skipped.forEach(s => console.log(`   = ${s.code.padEnd(5)} already exists — left untouched`));
    toCreate.forEach(s => console.log(`   + ${s.code.padEnd(5)} ${s.name} / ${s.name_mr}`));

    if (!toCreate.length) {
        console.log('\n   Nothing to create.');
        process.exit(0);
    }

    if (!COMMIT) {
        console.log(`\n   Would create ${toCreate.length} document(s). Re-run with --commit to apply.`);
        process.exit(0);
    }

    const batch = db.batch();
    toCreate.forEach((s, idx) => {
        batch.set(db.collection('subject_codes').doc(s.code), {
            ...s,
            id: s.code,
            order: s.order || idx + 1,
            updatedAt: new Date().toISOString()
        });
    });
    await batch.commit();
    console.log(`\n✅ Created ${toCreate.length} subject code document(s).`);
    process.exit(0);
}

run().catch(err => {
    console.error('\n❌ Seed failed:', err.message);
    process.exit(1);
});
