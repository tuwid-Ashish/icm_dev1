/**
 * GET /api/admin/payments            (administrators only)
 *
 * Every recent Razorpay payment, matched against what the database knows, so an
 * admin can see who paid and whether the package actually reached them.
 *
 *   credited   a payments/{id} marker exists, or an approved package request
 *              names this payment (how purchases were recorded before markers)
 *   suggested  the student the payment most likely belongs to: the uid stamped
 *              on the order when there is one, otherwise the single student
 *              whose email matches the buyer's
 *
 * Razorpay is the source of truth for "was money taken"; Firestore for "was it
 * credited". Reads scale with the number of payments, not the number of
 * students — students are looked up one by one only where needed.
 */
import { adminDb, requireAdmin } from '../../../lib/firebaseAdmin.js';
import { listRazorpayPayments } from '../../../lib/razorpay.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const caller = await requireAdmin(req, res);
    if (!caller) return;

    try {
        const [payments, markersSnap, requestsSnap, packagesSnap] = await Promise.all([
            listRazorpayPayments(200),
            adminDb.collection('payments').get(),
            adminDb.collection('package_requests').get(),
            adminDb.collection('packages').get()
        ]);

        const markerUid = Object.fromEntries(markersSnap.docs.map(d => [d.id, d.data().uid]));
        const requestUid = {};
        requestsSnap.docs.forEach(d => {
            const r = d.data();
            if (r.status !== 'approved') return;
            [r.razorpayPaymentId, r.utrNumber].filter(Boolean).forEach(id => { requestUid[id] = r.studentId; });
        });
        const packages = Object.fromEntries(packagesSnap.docs.map(d => [d.id, d.data()]));

        const creditedUidOf = (id) => markerUid[id] || requestUid[id] || null;

        // Students to look up: whoever a payment was credited to, plus whoever an
        // order says it belongs to. One read each, not the whole user list.
        const wantedUids = new Set();
        payments.forEach(p => {
            const credited = creditedUidOf(p.id);
            if (credited) wantedUids.add(credited);
            if (p.notes && p.notes.uid) wantedUids.add(p.notes.uid);
        });
        const userDocs = wantedUids.size
            ? await adminDb.getAll(...[...wantedUids].map(u => adminDb.collection('users').doc(u)))
            : [];
        const users = {};
        userDocs.forEach(d => { if (d.exists) users[d.id] = { uid: d.id, ...d.data() }; });
        const brief = (u) => (u ? { uid: u.uid, name: u.name || '', email: u.email || '', mobile: u.mobile || '' } : null);

        const rows = [];
        for (const p of payments) {
            const creditedUid = p.status === 'captured' ? creditedUidOf(p.id) : null;
            const pkg = packages[p.notes && p.notes.packageId];

            let suggested = null;
            if (p.status === 'captured' && !creditedUid) {
                if (p.notes && p.notes.uid && users[p.notes.uid]) {
                    suggested = { ...brief(users[p.notes.uid]), reason: 'order' };
                } else if (p.email) {
                    const byEmail = await adminDb.collection('users')
                        .where('email', '==', String(p.email).toLowerCase()).limit(2).get();
                    if (byEmail.size === 1) {
                        suggested = { ...brief({ uid: byEmail.docs[0].id, ...byEmail.docs[0].data() }), reason: 'email' };
                    }
                }
            }

            rows.push({
                paymentId: p.id,
                orderId: p.order_id,
                status: p.status,
                refunded: (p.amount_refunded || 0) > 0,
                amount: p.amount / 100,
                method: p.method || '',
                paidAt: new Date(p.created_at * 1000).toISOString(),
                buyerEmail: p.email || '',
                buyerPhone: p.contact || '',
                packageId: (p.notes && p.notes.packageId) || '',
                packageName: pkg ? pkg.name : '',
                packageTests: pkg ? pkg.totalTests : null,
                credited: !!creditedUid,
                creditedTo: brief(users[creditedUid]) || (creditedUid ? { uid: creditedUid, name: '', email: '', mobile: '' } : null),
                suggested
            });
        }

        res.status(200).json({ payments: rows });
    } catch (err) {
        console.error('[admin/payments] Failed:', err);
        res.status(500).json({ error: err.message || 'Could not load payments.' });
    }
}
