/**
 * Step 1 of the blueprint/subject-code work.
 *
 * Blueprint rows currently store the subject in a field called `name`, which in
 * the live data actually holds a subject CODE ("M1", "M6"), while the admin
 * editor's own defaults put display text there ("General Knowledge & Current
 * Affairs"). Two formats in one field is why examEngine had to fall back to
 * fuzzy substring matching to pair a blueprint row with a question.
 *
 * This renames the field to what it really is: `subjectCode`.
 *
 *   node scripts/migrateBlueprintSubjectCodes.js            # report only
 *   node scripts/migrateBlueprintSubjectCodes.js --commit   # apply
 *
 * Resolution is STRICT — exact code, then exact name, then exact alias. No
 * substring guessing. Anything that does not resolve is reported and the exam
 * is left untouched, so a bad row can never be silently mis-filed.
 *
 * `name` is kept on each row as a display label during the transition and is
 * removed by --drop-name once the app has been deployed reading `subjectCode`.
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COMMIT = process.argv.includes('--commit');
const DROP_NAME = process.argv.includes('--drop-name');

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found at project root.');
    process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

/** Exact-match resolver. Deliberately has no substring fallback. */
function strictResolve(raw, codes) {
    const value = String(raw || '').trim();
    if (!value) return null;
    const upper = value.toUpperCase();
    const lower = value.toLowerCase();

    const byCode = codes.find(c => (c.code || '').toUpperCase() === upper);
    if (byCode) return { entry: byCode, via: 'code' };

    const byName = codes.find(c =>
        (c.name || '').toLowerCase() === lower || (c.name_mr || '').toLowerCase() === lower);
    if (byName) return { entry: byName, via: 'name' };

    const byAlias = codes.find(c => {
        const list = Array.isArray(c.aliases)
            ? c.aliases
            : String(c.aliases || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
        return list.includes(lower);
    });
    if (byAlias) return { entry: byAlias, via: 'alias' };

    return null;
}

async function run() {
    console.log(COMMIT ? '\n✍️  COMMIT MODE — will write' : '\n🔎 REPORT ONLY — no writes (pass --commit to apply)');
    if (DROP_NAME) console.log('   --drop-name: the legacy `name` field will be removed from each row');

    const codes = (await db.collection('subject_codes').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    if (!codes.length) {
        console.error('\n❌ subject_codes is empty. Run: node scripts/seedSubjectCodes.js --commit');
        process.exit(1);
    }
    console.log(`   ${codes.length} subject codes available: ${codes.map(c => c.code).join(', ')}\n`);

    const examsSnap = await db.collection('exams').get();
    const updates = [];
    let unresolved = 0;

    for (const examDoc of examsSnap.docs) {
        const exam = examDoc.data();
        const subjects = Array.isArray(exam.subjects) ? exam.subjects : [];
        if (!subjects.length) {
            console.log(`▸ ${examDoc.id}  — no blueprint rows, skipped\n`);
            continue;
        }

        console.log(`▸ ${examDoc.id}  "${(exam.name || '').slice(0, 40)}"  totalQuestions=${exam.totalQuestions}`);

        let examHasProblem = false;
        const nextSubjects = subjects.map(s => {
            const source = s.subjectCode || s.name;
            const hit = strictResolve(source, codes);

            if (!hit) {
                examHasProblem = true;
                unresolved++;
                console.log(`    ❌ "${source}" — does not resolve to any subject code (exam left untouched)`);
                return s;
            }

            const row = {
                ...s,
                subjectCode: hit.entry.code,
                name: DROP_NAME ? undefined : (s.name ?? hit.entry.name),
                questionsCount: parseInt(s.questionsCount, 10) || 0,
                marksPerQuestion: s.marksPerQuestion || 1
            };
            if (DROP_NAME) delete row.name;

            const already = s.subjectCode === hit.entry.code;
            console.log(
                `    ${already ? '=' : '→'} "${source}"`.padEnd(28) +
                `subjectCode="${hit.entry.code}" (${hit.entry.name})  via ${hit.via}  count=${row.questionsCount}`
            );
            return row;
        });

        if (examHasProblem) {
            console.log('    ⚠️ skipping this exam — fix the unresolved row first\n');
            continue;
        }

        updates.push({ ref: examDoc.ref, id: examDoc.id, nextSubjects });
        console.log('');
    }

    console.log('─'.repeat(70));
    console.log(`   exams ready to migrate : ${updates.length}`);
    console.log(`   unresolved rows        : ${unresolved}`);
    console.log('─'.repeat(70));

    if (!updates.length) {
        console.log('\n   Nothing to do.\n');
        process.exit(0);
    }
    if (!COMMIT) {
        console.log('\n   Re-run with --commit to apply.\n');
        process.exit(0);
    }

    const batch = db.batch();
    updates.forEach(u => batch.update(u.ref, {
        subjects: u.nextSubjects,
        updatedAt: new Date().toISOString()
    }));
    await batch.commit();

    console.log(`\n✅ Migrated ${updates.length} exam blueprint(s).`);
    console.log('   Verify with: node scripts/auditDb.js\n');
    process.exit(0);
}

run().catch(err => {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
});
