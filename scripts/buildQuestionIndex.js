/**
 * Builds (or repairs) the question index: question_index/<SUBJECT> = { ids: [...] }
 * plus question_index/_meta saying it is complete.
 *
 * With the index, a test paper reads about 120 documents instead of the whole
 * question bank. The app uses the index only once _meta.built is true; until
 * then it falls back to reading the whole bank, so running this is what switches
 * the fast path on.
 *
 * Reads every question once (one read each — that is the one-time cost) but only
 * its subject field. Safe to re-run: it recomputes the index from the questions
 * and replaces it, so it also clears any stale entries.
 *
 * Run it again after importing questions by any route that does not go through
 * the admin screen (for example scripts/importMasterCSV.js), since those writes
 * do not update the index.
 *
 *   node scripts/buildQuestionIndex.js            # dry run: shows what it would write
 *   node scripts/buildQuestionIndex.js --commit   # write the index
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { INDEX_COLLECTION, INDEX_META_ID, indexKey } from '../src/utils/questionIndex.js';

const COMMIT = process.argv.includes('--commit');

const saPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) { console.error('serviceAccountKey.json not found at project root.'); process.exit(1); }
if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(fs.readFileSync(saPath, 'utf-8'))) });
const db = getFirestore();

async function run() {
    console.log(COMMIT ? '\nCOMMIT MODE - will write the index' : '\nDRY RUN - nothing is written (pass --commit)');

    const bank = await db.collection('questions').select('subjectCode').get();
    const byKey = {};
    bank.docs.forEach(d => {
        const key = indexKey(d.get('subjectCode'));
        (byKey[key] ||= []).push(d.id);
    });

    const existing = await db.collection(INDEX_COLLECTION).get();
    const stale = existing.docs.filter(d => d.id !== INDEX_META_ID && !byKey[d.id]).map(d => d.id);

    console.log(`\n   questions read      : ${bank.size}`);
    console.log(`   subjects            : ${Object.keys(byKey).length}`);
    Object.keys(byKey).sort().forEach(k => {
        const before = existing.docs.find(d => d.id === k);
        const was = before ? (before.data().ids || []).length : 0;
        console.log(`     ${k.padEnd(8)} ${String(byKey[k].length).padStart(6)} ids${before ? `   (index had ${was})` : '   (new)'}`);
    });
    if (stale.length) console.log(`   stale index docs to remove: ${stale.join(', ')}`);

    if (!COMMIT) { console.log('\n   Re-run with --commit to write.\n'); process.exit(0); }

    const now = new Date().toISOString();
    const batch = db.batch();
    Object.entries(byKey).forEach(([key, ids]) => {
        batch.set(db.collection(INDEX_COLLECTION).doc(key), { subjectCode: key, ids, updatedAt: now });
    });
    stale.forEach(id => batch.delete(db.collection(INDEX_COLLECTION).doc(id)));
    batch.set(db.collection(INDEX_COLLECTION).doc(INDEX_META_ID), {
        built: true, version: 1, builtAt: now, totalQuestions: bank.size, subjects: Object.keys(byKey).length
    });
    await batch.commit();

    console.log(`\nIndex written: ${bank.size} questions across ${Object.keys(byKey).length} subjects. The app will now use it.\n`);
    process.exit(0);
}

run().catch(err => { console.error('\nFailed:', err.message); process.exit(1); });
