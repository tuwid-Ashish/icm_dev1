/**
 * Creates the composite indexes listed in firestore.indexes.json.
 *
 * Today that is one: test_attempts (examId, submittedAt desc), which the Reports
 * screen needs to filter by exam and sort by date. Everything else the app asks
 * Firestore for uses the single-field indexes it builds on its own.
 *
 * Uses the Firestore Admin REST API with the service account, the same way
 * scripts/deployFirestoreRules.js reaches the Rules API, because the firebase
 * CLI's own deploy stops on a permission check this key does not have.
 *
 * Skips an index that already exists. Building takes a few minutes; until it is
 * ready the exam filter on Reports shows a "not ready yet" message.
 *
 *   node scripts/createFirestoreIndexes.js            # show what would be created
 *   node scripts/createFirestoreIndexes.js --commit   # create
 *
 * If the key is not allowed to create indexes this prints the Firebase console
 * address to create it by hand instead.
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

const COMMIT = process.argv.includes('--commit');
const root = process.cwd();
const saPath = path.resolve(root, 'serviceAccountKey.json');
const defPath = path.resolve(root, 'firestore.indexes.json');
for (const p of [saPath, defPath]) {
    if (!fs.existsSync(p)) { console.error(`Not found: ${p}`); process.exit(1); }
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
const projectId = serviceAccount.project_id;
const wanted = JSON.parse(fs.readFileSync(defPath, 'utf-8')).indexes || [];
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;

async function api(method, url, body, token) {
    const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
}

const sameFields = (existing, def) =>
    def.every((f, i) => existing[i] && existing[i].fieldPath === f.fieldPath && existing[i].order === f.order);

async function run() {
    console.log(COMMIT ? '\nCOMMIT MODE - will create missing indexes' : '\nDRY RUN - nothing is created (pass --commit)');
    console.log('   project:', projectId, '\n');

    const token = (await app.options.credential.getAccessToken()).access_token;
    let failed = false;

    for (const def of wanted) {
        const label = `${def.collectionGroup}(${def.fields.map(f => f.fieldPath + ' ' + f.order[0]).join(', ')})`;
        const listed = await api('GET', `${base}/collectionGroups/${def.collectionGroup}/indexes`, null, token);
        if (!listed.ok) {
            console.log(`   ? ${label}: could not list existing indexes (HTTP ${listed.status}): ${listed.json?.error?.message || ''}`);
            failed = true;
            continue;
        }
        const have = (listed.json.indexes || []).find(ix => sameFields(ix.fields || [], def.fields));
        if (have) {
            console.log(`   = ${label}: already exists (state ${have.state})`);
            continue;
        }
        console.log(`   + ${label}: missing`);
        if (!COMMIT) continue;

        const created = await api('POST', `${base}/collectionGroups/${def.collectionGroup}/indexes`,
            { queryScope: def.queryScope, fields: def.fields }, token);
        if (created.ok) {
            console.log('     creation started - it takes a few minutes to build.');
        } else {
            failed = true;
            console.log(`     could not create it (HTTP ${created.status}): ${created.json?.error?.message || ''}`);
        }
    }

    if (failed) {
        console.log('\nCreate it by hand instead: open');
        console.log(`   https://console.firebase.google.com/project/${projectId}/firestore/indexes`);
        console.log('   -> Composite -> Add index -> Collection ID: test_attempts');
        console.log('   -> Fields: examId (Ascending), submittedAt (Descending) -> Collection scope -> Create.\n');
    } else if (!COMMIT) {
        console.log('\n   Re-run with --commit to create.\n');
    } else {
        console.log('');
    }
    process.exit(failed ? 1 : 0);
}

run().catch(err => { console.error('\nFailed:', err.message); process.exit(1); });
