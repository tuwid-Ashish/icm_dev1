/**
 * Step 2 safety check — read-only, writes nothing.
 *
 * Compares the question pool each blueprint section draws from under:
 *
 *   OLD  examEngine.isQuestionMatchingSubject — resolveSubjectCode on both
 *        sides, then a substring fallback:
 *          qSub === bpSub || qSub.includes(bpSub) || bpSub.includes(qSub)
 *        plus resolveSubjectCode's own alias rule, which matches on
 *          lower.includes(alias) || alias.includes(lower)
 *
 *   NEW  q.subjectCode === blueprint.subjectCode
 *
 * Any section whose pool changes is a section the old matcher was mis-filing.
 * A pool that SHRINKS means questions were being pulled in that did not belong;
 * a pool that GROWS would mean the strict rule is catching something the fuzzy
 * one missed (unexpected — worth investigating before committing).
 *
 *   node scripts/compareSubjectMatching.js
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { resolveSubjectCode, setDynamicSubjectCodes } from '../src/constants/subjectCodes.js';

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found at project root.');
    process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

/** Verbatim copy of the current examEngine.isQuestionMatchingSubject. */
function oldMatch(q, bpSubjectName) {
    if (!q || !bpSubjectName) return false;

    const bpResolved = resolveSubjectCode(bpSubjectName);
    const qResolved = resolveSubjectCode(q.subjectCode || q.subject);

    if (bpResolved.code !== 'OTHER' && qResolved.code !== 'OTHER' && bpResolved.code === qResolved.code) {
        return true;
    }

    const bpCode = bpSubjectName.trim().toUpperCase();
    const qCode = (q.subjectCode || qResolved.code || '').trim().toUpperCase();
    if (bpCode === qCode && bpCode.startsWith('M')) {
        return true;
    }

    const qSub = (q.subject || qResolved.name || '').toLowerCase();
    const bpSub = String(bpSubjectName || '').toLowerCase();
    if (qSub === bpSub || qSub.includes(bpSub) || bpSub.includes(qSub)) return true;

    return false;
}

/** The replacement. */
function newMatch(q, blueprintCode) {
    if (!q || !blueprintCode) return false;
    return String(q.subjectCode || '').toUpperCase() === String(blueprintCode).toUpperCase();
}

async function run() {
    console.log('\n🔬 SUBJECT MATCHING — old (fuzzy) vs new (exact subjectCode)\n');

    const codes = (await db.collection('subject_codes').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    // The engine resolves against the live registry, so mirror that here or the
    // "old" side of this comparison would not be the code that is running.
    setDynamicSubjectCodes(codes);

    const questions = (await db.collection('questions').get()).docs.map(d => d.data());
    const exams = (await db.collection('exams').get()).docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`   ${questions.length} questions · ${exams.length} exams · ${codes.length} subject codes\n`);

    // Whole-bank view first: for each code, how big is the pool either way?
    console.log('── Pool size per subject code, across the whole bank ' + '─'.repeat(18));
    console.log('   code   old(fuzzy)   new(exact)   delta');
    let anyDelta = false;
    codes.forEach(c => {
        const oldN = questions.filter(q => oldMatch(q, c.code)).length;
        const newN = questions.filter(q => newMatch(q, c.code)).length;
        const delta = newN - oldN;
        if (delta !== 0) anyDelta = true;
        console.log(
            `   ${c.code.padEnd(6)} ${String(oldN).padStart(9)} ${String(newN).padStart(12)} ` +
            `${delta === 0 ? '        —' : String(delta > 0 ? '+' + delta : delta).padStart(9)}` +
            `${delta !== 0 ? '  ⚠️' : ''}`
        );
    });

    // Questions the fuzzy matcher would place in more than one section — the
    // concrete symptom of substring matching.
    const multi = questions.filter(q => codes.filter(c => oldMatch(q, c.code)).length > 1);
    console.log(`\n   questions matching MORE THAN ONE code under the old matcher: ${multi.length}`);
    if (multi.length) {
        const sample = multi.slice(0, 5);
        sample.forEach(q => {
            const hits = codes.filter(c => oldMatch(q, c.code)).map(c => c.code);
            console.log(`     ${String(q.subjectCode).padEnd(4)} "${String(q.subject).slice(0, 24).padEnd(24)}" → matches ${hits.join(', ')}`);
        });
        if (multi.length > 5) console.log(`     … and ${multi.length - 5} more`);
    }

    // Now per exam section, which is what actually reaches a student.
    console.log('\n── Per blueprint section ' + '─'.repeat(46));
    exams.forEach(exam => {
        const subs = Array.isArray(exam.subjects) ? exam.subjects : [];
        if (!subs.length) return;
        console.log(`\n   ▸ ${exam.id}  "${String(exam.name || '').slice(0, 34)}"`);
        subs.forEach(s => {
            const code = s.subjectCode || s.name;
            const oldN = questions.filter(q => oldMatch(q, code)).length;
            const newN = questions.filter(q => newMatch(q, code)).length;
            const want = parseInt(s.questionsCount, 10) || 0;
            const delta = newN - oldN;
            console.log(
                `     ${String(code).padEnd(5)} wants ${String(want).padStart(3)}  ` +
                `pool old=${String(oldN).padStart(5)}  new=${String(newN).padStart(5)}  ` +
                `${delta === 0 ? 'unchanged' : (delta > 0 ? '+' + delta : String(delta))}` +
                `${newN < want ? `   ⚠️ still short by ${want - newN}` : ''}`
            );
        });
    });

    console.log('\n' + '─'.repeat(70));
    console.log(anyDelta
        ? '   Pools change — read the deltas above before committing step 2.'
        : '   No pool changes anywhere: the strict matcher is a pure no-op on this data.');
    console.log('─'.repeat(70) + '\n');
    process.exit(0);
}

run().catch(err => {
    console.error('\n❌ Failed:', err.message);
    process.exit(1);
});
