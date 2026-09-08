/**
 * Deploys firestore.rules via the Firebase Rules REST API.
 *
 * `firebase deploy --only firestore:rules` first calls serviceusage.googleapis
 * .com to confirm the Firestore API is enabled, and the firebase-adminsdk
 * service account does not hold serviceusage.services.get — so the CLI fails
 * on a pre-flight check rather than on the deploy itself. This performs the
 * same two operations the CLI would (create a ruleset, point the
 * cloud.firestore release at it) using the same credentials.
 *
 *   node scripts/deployFirestoreRules.js            # validate + show diff, no deploy
 *   node scripts/deployFirestoreRules.js --commit   # deploy
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

const COMMIT = process.argv.includes('--commit');

const root = process.cwd();
const rulesPath = path.resolve(root, 'firestore.rules');
const saPath = path.resolve(root, 'serviceAccountKey.json');

for (const [label, p] of [['firestore.rules', rulesPath], ['serviceAccountKey.json', saPath]]) {
    if (!fs.existsSync(p)) {
        console.error(`❌ ${label} not found at project root.`);
        process.exit(1);
    }
}

const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
const projectId = serviceAccount.project_id;
const rulesSource = fs.readFileSync(rulesPath, 'utf-8');

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });

async function token() {
    const t = await app.options.credential.getAccessToken();
    return t.access_token;
}

async function api(method, url, body, accessToken) {
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!res.ok) {
        const err = new Error(json?.error?.message || `HTTP ${res.status}`);
        err.detail = json;
        throw err;
    }
    return json;
}

async function run() {
    console.log(COMMIT ? '\n✍️  DEPLOY MODE' : '\n🔎 VALIDATE ONLY — nothing will be deployed (pass --commit)');
    console.log('   project :', projectId);
    console.log('   rules   :', rulesPath);
    console.log('   size    :', rulesSource.length, 'bytes\n');

    const accessToken = await token();
    const base = `https://firebaserules.googleapis.com/v1/projects/${projectId}`;

    // What is live right now, so the change is visible before it is made.
    let currentName = null;
    try {
        const release = await api('GET', `${base}/releases/cloud.firestore`, null, accessToken);
        currentName = release.rulesetName;
        console.log('   currently released ruleset:', currentName);
    } catch (e) {
        console.log('   currently released ruleset: (none readable —', e.message + ')');
    }

    // Creating a ruleset validates the source server-side; a syntax error fails
    // here, before anything is released.
    const ruleset = await api('POST', `${base}/rulesets`, {
        source: { files: [{ name: 'firestore.rules', content: rulesSource }] }
    }, accessToken);

    console.log('   ✅ rules compiled and uploaded as:', ruleset.name);

    if (!COMMIT) {
        console.log('\n   Not released — the ruleset above is uploaded but nothing points at it yet.');
        console.log('   Re-run with --commit to make it live.\n');
        process.exit(0);
    }

    await api('PATCH',
        `${base}/releases/cloud.firestore?updateMask=rulesetName`,
        { release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: ruleset.name } },
        accessToken
    );

    console.log('\n✅ Released. firestore.rules is now live on', projectId);
    if (currentName) console.log('   previous ruleset (for rollback):', currentName);
    console.log('');
    process.exit(0);
}

run().catch(err => {
    console.error('\n❌ Failed:', err.message);
    if (err.detail) console.error(JSON.stringify(err.detail, null, 2).slice(0, 1500));
    process.exit(1);
});
