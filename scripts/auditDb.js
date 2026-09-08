/**
 * READ-ONLY Firestore structural audit (Firebase Admin SDK).
 *
 * Answers the questions the code review could not answer from source alone:
 *   - which collections actually exist, and how many docs each holds
 *   - what shape the documents really are (field presence + JS types)
 *   - whether subject_codes exists as real data or only as a hardcoded default
 *   - how questions are tagged (subjectCode / subject / batches / batch)
 *   - whether purchasedPackages entries carry examId (the paywall's join key)
 *   - type inconsistencies that break strict comparison (e.g. correctIndex)
 *
 * Performs NO writes. PII (email / mobile / name) is redacted in output.
 *
 *   node scripts/auditDb.js
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found at project root.');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
if (getApps().length === 0) {
    initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

// ---------- helpers ----------

const line = (c = '─') => console.log(c.repeat(74));

function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (v && typeof v.toDate === 'function') return 'timestamp';
    return typeof v;
}

const SENSITIVE = /email|mobile|phone|name|utr|paymentreference|razorpay/i;

function redact(key, value) {
    if (!SENSITIVE.test(key)) return value;
    if (typeof value !== 'string' || !value) return value;
    return value.length <= 3 ? '***' : value.slice(0, 2) + '***(' + value.length + ')';
}

function preview(data, maxFields = 8) {
    const out = {};
    Object.keys(data).slice(0, maxFields).forEach(k => {
        let v = data[k];
        if (Array.isArray(v)) v = `[${v.length} items]`;
        else if (v && typeof v === 'object') v = '{…}';
        else v = redact(k, v);
        out[k] = v;
    });
    return out;
}

/** Field presence + type distribution across a set of docs. */
function profileFields(docs) {
    const fields = new Map();
    docs.forEach(d => {
        const data = d.data();
        Object.keys(data).forEach(k => {
            if (!fields.has(k)) fields.set(k, { count: 0, types: new Map() });
            const f = fields.get(k);
            f.count++;
            const t = typeOf(data[k]);
            f.types.set(t, (f.types.get(t) || 0) + 1);
        });
    });
    return [...fields.entries()].sort((a, b) => b[1].count - a[1].count);
}

function tally(list) {
    const m = new Map();
    list.forEach(v => m.set(v, (m.get(v) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

// ---------- main ----------

async function run() {
    console.log('\n🔍 FIRESTORE STRUCTURAL AUDIT (read-only)');
    console.log('   project:', serviceAccount.project_id);
    console.log('   run at :', new Date().toISOString());

    // 1. What collections actually exist?
    line('=');
    console.log('1. COLLECTIONS PRESENT');
    line('=');
    const cols = await db.listCollections();
    const names = cols.map(c => c.id).sort();

    const snapshots = {};
    for (const name of names) {
        const snap = await db.collection(name).get();
        snapshots[name] = snap;
        console.log(`   ${name.padEnd(24)} ${String(snap.size).padStart(6)} docs`);
    }

    const EXPECTED = ['users', 'exams', 'questions', 'test_attempts', 'packages',
                      'package_requests', 'settings', 'subject_codes'];
    const missing = EXPECTED.filter(e => !names.includes(e));
    if (missing.length) {
        console.log('\n   ⚠️  referenced in code but NOT present:', missing.join(', '));
    }
    const unexpected = names.filter(n => !EXPECTED.includes(n));
    if (unexpected.length) {
        console.log('   ℹ️  present but not referenced in src/:', unexpected.join(', '));
    }

    // 2. Document shape per collection
    line('=');
    console.log('2. DOCUMENT SHAPE  (field → % of docs carrying it → types seen)');
    line('=');
    for (const name of names) {
        const snap = snapshots[name];
        if (snap.empty) { console.log(`\n▸ ${name}: empty\n`); continue; }
        console.log(`\n▸ ${name}  (${snap.size} docs)`);
        profileFields(snap.docs).forEach(([field, info]) => {
            const pct = Math.round((info.count / snap.size) * 100);
            const types = [...info.types.entries()].map(([t, c]) => `${t}×${c}`).join(', ');
            const flag = info.types.size > 1 ? '  ⚠️ MIXED TYPES' : (pct < 100 ? '  ← partial' : '');
            console.log(`    ${field.padEnd(24)} ${String(pct).padStart(3)}%  ${types}${flag}`);
        });
        console.log('    sample:', JSON.stringify(preview(snap.docs[0].data())));
    }

    // 3. Subject codes — the reported bug
    line('=');
    console.log('3. SUBJECT CODES');
    line('=');
    const subSnap = snapshots['subject_codes'];
    if (!subSnap) {
        console.log('   ❌ subject_codes collection DOES NOT EXIST.');
        console.log('      → M1–M9 have never been persisted; the UI is showing the');
        console.log('        hardcoded DEFAULT_SUBJECT_CODES array only.');
    } else {
        console.log(`   ${subSnap.size} documents:`);
        subSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.order || 99) - (b.order || 99))
            .forEach(s => console.log(`     ${String(s.code || s.id).padEnd(8)} order=${String(s.order).padEnd(4)} ${s.name || '(no name)'}`));
    }

    // 4. How questions are actually tagged
    line('=');
    console.log('4. QUESTION TAGGING');
    line('=');
    const qSnap = snapshots['questions'];
    if (!qSnap || qSnap.empty) {
        console.log('   (no questions)');
    } else {
        const qs = qSnap.docs.map(d => d.data());

        console.log('\n   subjectCode distribution:');
        tally(qs.map(q => q.subjectCode || '(absent)')).forEach(([k, c]) =>
            console.log(`     ${String(k).padEnd(14)} ${c}`));

        console.log('\n   subject (display name) distribution:');
        tally(qs.map(q => q.subject || '(absent)')).forEach(([k, c]) =>
            console.log(`     ${String(k).slice(0, 40).padEnd(42)} ${c}`));

        console.log('\n   batch tagging:');
        const hasArr = qs.filter(q => Array.isArray(q.batches)).length;
        const hasStr = qs.filter(q => typeof q.batch === 'string' && q.batch).length;
        const hasBoth = qs.filter(q => Array.isArray(q.batches) && typeof q.batch === 'string' && q.batch).length;
        const hasNeither = qs.filter(q => !Array.isArray(q.batches) && !q.batch).length;
        console.log(`     batches[] present : ${hasArr}`);
        console.log(`     batch string      : ${hasStr}`);
        console.log(`     both (duplicated) : ${hasBoth}`);
        console.log(`     NEITHER           : ${hasNeither}${hasNeither ? '  ⚠️ invisible to every batch filter' : ''}`);
        console.log('\n   distinct batch tags in batches[]:');
        tally(qs.flatMap(q => Array.isArray(q.batches) ? q.batches : [])).forEach(([k, c]) =>
            console.log(`     ${String(k).padEnd(24)} ${c}`));

        console.log('\n   answer-key field types:');
        console.log('     correctIndex :', tally(qs.map(q => typeOf(q.correctIndex))).map(([t, c]) => `${t}×${c}`).join(', '));
        console.log('     correctOption:', tally(qs.map(q => typeOf(q.correctOption))).map(([t, c]) => `${t}×${c}`).join(', '));
        const disagree = qs.filter(q =>
            q.correctIndex !== undefined && q.correctOption !== undefined &&
            Number(q.correctIndex) !== Number(q.correctOption)).length;
        console.log(`     rows where the two DISAGREE: ${disagree}${disagree ? '  ⚠️ scoring is ambiguous' : ''}`);
        const badOpts = qs.filter(q => !Array.isArray(q.options) || q.options.length !== 4).length;
        console.log(`     rows without exactly 4 options: ${badOpts}`);
        const outOfRange = qs.filter(q => {
            const i = Number(q.correctIndex);
            return !Number.isInteger(i) || i < 0 || i > 3;
        }).length;
        console.log(`     rows with correctIndex outside 0–3: ${outOfRange}`);
    }

    // 5. Exams & blueprint subject naming
    line('=');
    console.log('5. EXAMS / BLUEPRINTS');
    line('=');
    const eSnap = snapshots['exams'];
    if (!eSnap || eSnap.empty) {
        console.log('   (no exams)');
    } else {
        eSnap.docs.forEach(d => {
            const e = d.data();
            const subs = Array.isArray(e.subjects) ? e.subjects : [];
            console.log(`\n   ${d.id}  "${e.name || ''}"`);
            console.log(`     free=${!!e.isFreeTest}  totalQuestions=${e.totalQuestions}  questionBatch=${e.questionBatch || '(unset)'}`);
            if (!subs.length) console.log('     blueprint subjects: (none)');
            else subs.forEach(s => console.log(
                `       • subjectCode=${String(s.subjectCode || '(MISSING)').padEnd(10)}` +
                `count=${String(s.questionsCount).padEnd(5)}` +
                `legacy name=${s.name === undefined ? '(dropped)' : `"${s.name}"`}` +
                `${!s.subjectCode ? '  ⚠️ not migrated' : ''}`
            ));
        });
    }

    // 6. Users: roles, quota, and the paywall join key
    line('=');
    console.log('6. USERS / ACCESS');
    line('=');
    const uSnap = snapshots['users'];
    if (!uSnap || uSnap.empty) {
        console.log('   (no users)');
    } else {
        const us = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('   roles:', tally(us.map(u => u.role || '(absent)')).map(([k, c]) => `${k}=${c}`).join('  '));

        const admins = us.filter(u => u.role === 'admin');
        console.log(`\n   admin accounts: ${admins.length}`);
        admins.forEach(a => console.log(`     uid=${a.id}  email=${redact('email', a.email)}`));

        const purchases = us.flatMap(u => (u.purchasedPackages || []).map(p => ({ uid: u.id, p })));
        console.log(`\n   purchasedPackages entries: ${purchases.length}`);
        const withExamId = purchases.filter(x => x.p.examId).length;
        console.log(`     carrying examId : ${withExamId}`);
        console.log(`     MISSING examId  : ${purchases.length - withExamId}${purchases.length - withExamId ? '  ⚠️ falls back to fuzzy name match in getExamAccess' : ''}`);
        const examIds = new Set((eSnap ? eSnap.docs : []).map(d => d.id));
        const dangling = purchases.filter(x => x.p.examId && !examIds.has(x.p.examId));
        if (dangling.length) {
            console.log(`     examId pointing at a NON-EXISTENT exam: ${dangling.length}  ⚠️`);
            dangling.slice(0, 5).forEach(x => console.log(`       uid=${x.uid} examId=${x.p.examId}`));
        }

        const quotaMismatch = us.filter(u =>
            typeof u.allowedTests === 'number' && typeof u.remainingTests === 'number' &&
            typeof u.completedTests === 'number' &&
            u.remainingTests !== Math.max(0, u.allowedTests - u.completedTests));
        console.log(`\n   users where remaining ≠ allowed − completed: ${quotaMismatch.length}${quotaMismatch.length ? '  ⚠️ quota drifted' : ''}`);
        const suspicious = us.filter(u => (u.remainingTests || 0) > 500);
        if (suspicious.length) console.log(`   users with remainingTests > 500: ${suspicious.length}  ⚠️ check for tampering`);
    }

    // 7. Packages
    line('=');
    console.log('7. PACKAGES');
    line('=');
    const pSnap = snapshots['packages'];
    if (!pSnap || pSnap.empty) console.log('   (no packages)');
    else pSnap.docs.forEach(d => {
        const p = d.data();
        const examIds = new Set((eSnap ? eSnap.docs : []).map(x => x.id));
        const flag = !p.examId ? '  ⚠️ no examId — purchases from this package cannot unlock an exam by id'
                   : (!examIds.has(p.examId) ? '  ⚠️ examId does not match any exam' : '');
        console.log(`   ${d.id.padEnd(22)} exam=${String(p.examId || '(unset)').padEnd(16)} tests=${p.totalTests}${flag}`);
    });

    // 8. Access-integrity deep dive
    line('=');
    console.log('8. ACCESS INTEGRITY');
    line('=');
    if (uSnap && eSnap) {
        const exams = eSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const examIds = new Set(exams.map(e => e.id));
        const us = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        console.log('   dangling purchase entries, and what the legacy name fallback does:');
        us.forEach(u => (u.purchasedPackages || []).forEach(p => {
            if (p.examId && examIds.has(p.examId)) return;
            const unlocks = exams.filter(e =>
                p.exam === e.name || (e.name || '').includes(p.exam || ' '));
            const verdict = unlocks.length === 0
                ? '❌ UNLOCKS NOTHING — paying student is locked out'
                : (unlocks.length > 1 ? `⚠️ unlocks ${unlocks.length} exams: ${unlocks.map(e => e.id).join(',')}` : `→ ${unlocks[0].id}`);
            console.log(`     uid=${u.id.slice(0, 8)}… examId="${p.examId}" exam="${p.exam}"  ${verdict}`);
        }));

        const noExamField = us.flatMap(u => (u.purchasedPackages || []))
            .filter(p => !p.exam && (!p.examId || !examIds.has(p.examId))).length;
        if (noExamField) {
            console.log(`\n   ⚠️ ${noExamField} entries have NO exam label and a dead examId.`);
            console.log('      getExamAccess falls back to name.includes(p.exam || \' \') — a space,');
            console.log('      which matches any exam name containing a space: unlocks EVERYTHING.');
        }

        const withPassword = us.filter(u => u.password !== undefined);
        console.log(`\n   user docs carrying a "password" field: ${withPassword.length}`);
        withPassword.forEach(u => console.log(
            `     uid=${u.id.slice(0, 8)}…  role=${u.role}  type=${typeOf(u.password)}  length=${String(u.password || '').length}  looksHashed=${/^\$2[aby]\$|^[a-f0-9]{60,}$/.test(String(u.password))}`));

        const noUid = us.filter(u => !u.uid || !u.id);
        console.log(`\n   user docs missing uid/id field: ${noUid.length}`);
    }

    // 9. Blueprint supply check — can each exam actually be built?
    line('=');
    console.log('9. BLUEPRINT vs QUESTION SUPPLY');
    line('=');
    if (eSnap && qSnap) {
        const bank = qSnap.docs.map(d => d.data());
        const supply = new Map();
        bank.forEach(q => {
            const c = (q.subjectCode || 'OTHER').toUpperCase();
            supply.set(c, (supply.get(c) || 0) + 1);
        });
        eSnap.docs.forEach(d => {
            const e = d.data();
            const subs = Array.isArray(e.subjects) ? e.subjects : [];
            if (!subs.length) return;
            const bpTotal = subs.reduce((s, x) => s + (parseInt(x.questionsCount, 10) || 0), 0);
            const target = Math.min(e.totalQuestions || bpTotal || 20, 100);
            const ratio = bpTotal > 0 ? target / bpTotal : 1;
            let deliverable = 0;
            const shortfalls = [];
            subs.forEach(s => {
                const code = String(s.subjectCode || s.name || '').toUpperCase();
                const want = Math.max(1, Math.round((parseInt(s.questionsCount, 10) || 1) * ratio));
                const have = supply.get(code) || 0;
                deliverable += Math.min(want, have);
                if (have < want) shortfalls.push(`${code}: want ${want}, have ${have}`);
            });
            const flag = deliverable < target ? `  ⚠️ SHORT BY ${target - deliverable}` : '  ✓';
            console.log(`\n   ${d.id} "${(e.name || '').slice(0, 30)}"  asks ${target}, can deliver ${deliverable}${flag}`);
            shortfalls.forEach(s => console.log(`     ✗ ${s}`));
        });
    }

    line('=');
    console.log('AUDIT COMPLETE — no writes were performed.');
    line('=');
    process.exit(0);
}

run().catch(err => {
    console.error('\n❌ Audit failed:', err.message);
    process.exit(1);
});
