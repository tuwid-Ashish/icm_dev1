/**
 * Credit Razorpay payments that were captured but never reached a student's
 * profile.
 *
 * Why this exists: /api/razorpay/verify-payment crashed on startup in
 * production (no FIREBASE_SERVICE_ACCOUNT), so checkout worked and Razorpay
 * took the money, but the credit step never ran. Razorpay is the only record.
 *
 * What it does, per payment, mirroring the credit in verify-payment.js:
 *   - confirms the payment is captured and not refunded
 *   - reads the package from the Razorpay ORDER notes, then from Firestore
 *   - confirms the amount paid covers the package price
 *   - finds the student: by the uid stamped on the order when present,
 *     otherwise by email (must be exactly one); cross-checks phone either way
 *   - in one transaction: appends the purchase, adds the quota, writes the
 *     payments/{paymentId} marker and a package_requests record
 *
 * Idempotent: a payment already in payments/ or already referenced by a
 * purchase on the profile is skipped, so re-running can never double-credit.
 *
 *   node scripts/recoverRazorpayPayments.js                      # dry run, all
 *   node scripts/recoverRazorpayPayments.js --min-amount=100     # only >= ₹100
 *   node scripts/recoverRazorpayPayments.js --only=EqL,Khx       # by id suffix
 *   node scripts/recoverRazorpayPayments.js --min-amount=100 --commit
 */
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const arg = (name) => (args.find(a => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=');
const MIN_AMOUNT = parseFloat(arg('min-amount')) || 0;
const ONLY = arg('only').split(',').map(s => s.trim()).filter(Boolean);

const root = process.cwd();
const saPath = path.resolve(root, 'serviceAccountKey.json');
const envPath = path.resolve(root, '.env');
for (const [label, p] of [['serviceAccountKey.json', saPath], ['.env', envPath]]) {
    if (!fs.existsSync(p)) { console.error(`❌ ${label} not found at project root.`); process.exit(1); }
}

const env = Object.fromEntries(
    fs.readFileSync(envPath, 'utf-8').split('\n')
        .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    console.error('❌ RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing from .env');
    process.exit(1);
}

if (getApps().length === 0) initializeApp({ credential: cert(JSON.parse(fs.readFileSync(saPath, 'utf-8'))) });
const db = getFirestore();
const RZP = { Authorization: 'Basic ' + Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64') };

const mask = (s) => (!s ? '-' : String(s).length <= 8 ? '***' : String(s).slice(0, 4) + '***' + String(s).slice(-3));
const maskEmail = (e) => (e || '').replace(/^(.{2}).*(@.*)$/, '$1***$2');
const last10 = (s) => String(s || '').replace(/\D/g, '').slice(-10);
const ist = (sec) => new Date(sec * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });

async function rzp(url) {
    const res = await fetch(`https://api.razorpay.com/v1/${url}`, { headers: RZP });
    const json = await res.json();
    if (!res.ok) throw new Error(`Razorpay ${url}: ${json?.error?.description || res.status}`);
    return json;
}

async function allPayments() {
    const out = [];
    for (let skip = 0; ; skip += 100) {
        const page = await rzp(`payments?count=100&skip=${skip}`);
        out.push(...page.items);
        if (page.items.length < 100) break;
    }
    return out;
}

async function run() {
    console.log(COMMIT ? '\n✍️  COMMIT MODE — will credit' : '\n🔎 DRY RUN — nothing is written (pass --commit to credit)');
    if (MIN_AMOUNT) console.log(`   filter: payments of ₹${MIN_AMOUNT} or more`);
    if (ONLY.length) console.log(`   filter: payment ids ending ${ONLY.join(', ')}`);

    const [payments, usersSnap, pkgsSnap, markersSnap] = await Promise.all([
        allPayments(),
        db.collection('users').get(),
        db.collection('packages').get(),
        db.collection('payments').get()
    ]);
    const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const pkgs = Object.fromEntries(pkgsSnap.docs.map(d => [d.id, d.data()]));
    const marked = new Set(markersSnap.docs.map(d => d.id));
    const referenced = new Set(users.flatMap(u => (u.purchasedPackages || []).map(p => p.paymentReference)).filter(Boolean));

    const captured = payments.filter(p => p.status === 'captured');
    console.log(`\n   Razorpay: ${payments.length} payments, ${captured.length} captured`);

    const plan = [];
    const skipped = [];

    for (const p of captured.sort((a, b) => a.created_at - b.created_at)) {
        if (marked.has(p.id) || referenced.has(p.id)) continue;               // already credited
        const label = `${mask(p.id)}  ${ist(p.created_at)}  ₹${p.amount / 100}`;

        if (MIN_AMOUNT && p.amount / 100 < MIN_AMOUNT) { skipped.push([label, `below --min-amount`]); continue; }
        if (ONLY.length && !ONLY.some(s => p.id.endsWith(s))) { skipped.push([label, 'not in --only']); continue; }
        if ((p.amount_refunded || 0) > 0) { skipped.push([label, 'refunded — not crediting']); continue; }

        const order = await rzp(`orders/${p.order_id}`);
        const packageId = order.notes?.packageId;
        const pkg = packageId ? pkgs[packageId] : null;
        if (!pkg) { skipped.push([label, `package "${packageId || '(none)'}" not found`]); continue; }

        const expectedPaise = Math.round(Number(pkg.discountPrice || pkg.price || 0) * 100);
        if (!expectedPaise || p.amount < expectedPaise) {
            skipped.push([label, `paid ₹${p.amount / 100} < package price ₹${expectedPaise / 100}`]); continue;
        }
        const quota = Number(pkg.totalTests || 0);
        if (!quota) { skipped.push([label, 'package has no totalTests']); continue; }

        // Orders created since create-order started stamping notes.uid carry the
        // student's id directly — use that, it is exact. Older orders only have
        // the buyer's email, so fall back to requiring exactly one email match.
        let user;
        if (order.notes?.uid) {
            user = users.find(u => u.uid === order.notes.uid);
            if (!user) { skipped.push([label, `order names student ${mask(order.notes.uid)} but no such profile exists`]); continue; }
        } else {
            const matches = users.filter(u => (u.email || '').toLowerCase() === (p.email || '').toLowerCase());
            if (matches.length !== 1) { skipped.push([label, `${matches.length} students match email ${maskEmail(p.email)} — need exactly 1`]); continue; }
            user = matches[0];
        }

        const phoneKnown = last10(user.mobile) && last10(p.contact);
        const phoneOk = phoneKnown ? last10(user.mobile) === last10(p.contact) : null;
        if (phoneOk === false) { skipped.push([label, 'email matches but phone does NOT — manual check']); continue; }

        plan.push({ p, pkg, packageId, quota, user, phoneOk, label });
    }

    console.log('\n── WOULD CREDIT ' + '─'.repeat(56));
    if (!plan.length) console.log('   (nothing)');
    const running = {}; // per-user running quota so the before→after is right when one student has several
    for (const x of plan) {
        const before = running[x.user.uid] ?? Number(x.user.remainingTests || 0);
        running[x.user.uid] = before + x.quota;
        console.log(`   ${x.label}`);
        console.log(`      student ${mask(x.user.uid)} (${maskEmail(x.user.email)})  phone ${x.phoneOk === null ? 'n/a' : x.phoneOk ? 'matches' : 'MISMATCH'}`);
        console.log(`      package ${x.packageId} → exam ${x.pkg.examId}, +${x.quota} tests   remaining ${before} → ${running[x.user.uid]}`);
    }

    if (skipped.length) {
        console.log('\n── SKIPPED ' + '─'.repeat(61));
        skipped.forEach(([l, why]) => console.log(`   ${l}\n      ↳ ${why}`));
    }

    console.log('\n' + '─'.repeat(70));
    console.log(`   would credit ${plan.length} payment(s), total ₹${plan.reduce((s, x) => s + x.p.amount / 100, 0)}`);
    console.log('─'.repeat(70));

    if (!COMMIT) { console.log('\n   Re-run with --commit to apply.\n'); process.exit(0); }
    if (!plan.length) process.exit(0);

    console.log('\n── CREDITING ' + '─'.repeat(59));
    let done = 0;
    for (const x of plan) {
        const paymentRef = db.collection('payments').doc(x.p.id);
        const userRef = db.collection('users').doc(x.user.uid);
        const when = new Date(x.p.created_at * 1000).toISOString();
        try {
            const result = await db.runTransaction(async (tx) => {
                const [marker, userSnap] = await Promise.all([tx.get(paymentRef), tx.get(userRef)]);
                if (marker.exists) return 'already-marked';
                const u = userSnap.data();
                if ((u.purchasedPackages || []).some(e => e.paymentReference === x.p.id)) return 'already-on-profile';

                tx.update(userRef, {
                    allowedTests: Number(u.allowedTests || 0) + x.quota,
                    remainingTests: Number(u.remainingTests || 0) + x.quota,
                    purchasedPackages: [...(u.purchasedPackages || []), {
                        id: 'pkg_purch_' + x.p.id,
                        packageId: x.packageId,
                        examId: x.pkg.examId || null,
                        packageName: x.pkg.name || '',
                        exam: x.pkg.exam || '',
                        totalTests: x.quota,
                        amountPaid: x.p.amount / 100,
                        paymentMethod: 'Razorpay',
                        paymentReference: x.p.id,
                        paymentStatus: 'COMPLETED',
                        purchaseDate: when,
                        recoveredAt: new Date().toISOString()
                    }],
                    updatedAt: new Date().toISOString()
                });
                tx.set(paymentRef, {
                    paymentId: x.p.id, orderId: x.p.order_id, uid: x.user.uid, packageId: x.packageId,
                    amount: x.p.amount / 100, quotaCredited: x.quota, createdAt: when,
                    recovered: true, recoveredAt: new Date().toISOString()
                });
                tx.set(db.collection('package_requests').doc('req_rzp_' + x.p.id), {
                    id: 'req_rzp_' + x.p.id, studentId: x.user.uid, studentName: x.user.name || '',
                    studentEmail: x.user.email || '', studentMobile: x.user.mobile || '',
                    packageId: x.packageId, packageName: x.pkg.name || '', targetExam: x.pkg.exam || '',
                    testQuota: x.quota, amount: x.p.amount / 100, paymentMethod: 'Razorpay',
                    utrNumber: x.p.id, razorpayPaymentId: x.p.id, status: 'approved',
                    createdAt: when, approvedAt: new Date().toISOString(), recovered: true
                });
                return 'credited';
            });
            if (result === 'credited') done++;
            console.log(`   ${result === 'credited' ? '✅' : '⏭️ '} ${x.label}  → ${result}`);
        } catch (err) {
            console.log(`   ❌ ${x.label}  → FAILED: ${err.message}`);
        }
    }
    console.log(`\n✅ Credited ${done} of ${plan.length}. Verify with: node scripts/auditDb.js\n`);
    process.exit(0);
}

run().catch(err => { console.error('\n❌ Failed:', err.message); process.exit(1); });
