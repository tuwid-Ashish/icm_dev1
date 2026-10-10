/**
 * Builds the `student_stats` ranking documents from existing test_attempts.
 *
 * New attempts update these automatically (/api/submit-attempt). This is for
 * the history that exists before that route did — and it is safe to re-run at
 * any time: it recomputes every student from ALL their attempts and overwrites,
 * so it can never double count.
 *
 * Counted: full papers only (attempts saved before `paperType` existed are
 * classed by the "(… Practice)" in their exam name). Attempts whose studentId
 * has no user profile (seeded demo data such as std_101) are left out.
 *
 *   node scripts/backfillStudentStats.js            # dry run, shows standings
 *   node scripts/backfillStudentStats.js --commit   # write student_stats
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildStatsFromAttempts } from '../lib/ranking.js';

const COMMIT = process.argv.includes('--commit');

const saPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(saPath)) { console.error('❌ serviceAccountKey.json not found at project root.'); process.exit(1); }
if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(fs.readFileSync(saPath, 'utf-8'))) });
const db = getFirestore();

const mask = (s) => (!s ? '-' : String(s).slice(0, 4) + '***' + String(s).slice(-3));

async function run() {
    console.log(COMMIT ? '\n✍️  COMMIT MODE — will write student_stats' : '\n🔎 DRY RUN — nothing is written (pass --commit)');

    const [attemptsSnap, usersSnap, examsSnap] = await Promise.all([
        db.collection('test_attempts').get(),
        db.collection('users').get(),
        db.collection('exams').get()
    ]);

    const nameByUid = Object.fromEntries(usersSnap.docs.map(d => [d.id, d.data().name || '']));
    const isFreeTestByExam = Object.fromEntries(examsSnap.docs.map(d => [d.id, !!d.data().isFreeTest]));

    const all = attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const real = all.filter(a => nameByUid[a.studentId] !== undefined);
    const demo = all.length - real.length;

    const stats = buildStatsFromAttempts(real, { isFreeTestByExam, nameByUid });
    const students = Object.values(stats);

    console.log(`\n   attempts read            : ${all.length}`);
    console.log(`   left out (no such user)  : ${demo}   (seeded/demo data)`);
    console.log(`   students with standings  : ${students.filter(s => s.overall.count || Object.values(s.exams).some(b => b.count)).length}`);

    const perExam = {};
    students.forEach(s => Object.entries(s.exams).forEach(([exam, b]) => {
        (perExam[exam] ||= []).push({ uid: s.uid, name: s.name, ...b });
    }));

    for (const [exam, rows] of Object.entries(perExam)) {
        rows.sort((a, b) => b.rankPct - a.rankPct);
        console.log(`\n── ${exam}${isFreeTestByExam[exam] ? ' (free test)' : ''} — ${rows.length} student(s) ranked ──`);
        let lastPct = null, lastRank = 0;
        rows.slice(0, 10).forEach((r, i) => {
            const rank = r.rankPct === lastPct ? lastRank : i + 1;
            lastPct = r.rankPct; lastRank = rank;
            console.log(`   #${String(rank).padEnd(3)} ${mask(r.uid).padEnd(11)} avg ${String(r.avgPct).padStart(6)}%  best ${String(r.bestPct).padStart(6)}%  papers ${r.count}`);
        });
    }

    const overall = students.filter(s => s.overall.count).sort((a, b) => b.overall.rankPct - a.overall.rankPct);
    console.log(`\n── OVERALL (paid exams) — ${overall.length} student(s) ──`);
    overall.slice(0, 10).forEach((s, i) => console.log(`   #${String(i + 1).padEnd(3)} ${mask(s.uid).padEnd(11)} avg ${String(s.overall.avgPct).padStart(6)}%  papers ${s.overall.count}`));

    if (!COMMIT) { console.log('\n   Re-run with --commit to write.\n'); process.exit(0); }

    let batch = db.batch(), n = 0, written = 0;
    for (const s of students) {
        batch.set(db.collection('student_stats').doc(s.uid), { ...s, updatedAt: new Date().toISOString() });
        written++;
        if (++n === 400) { await batch.commit(); batch = db.batch(); n = 0; }
    }
    if (n) await batch.commit();
    console.log(`\n✅ Wrote ${written} student_stats document(s).\n`);
    process.exit(0);
}

run().catch(err => { console.error('\n❌ Failed:', err.message); process.exit(1); });
