/**
 * POST /api/admin/credit-payment      (administrators only)
 * Body: { paymentId, uid }
 *
 * Gives a student the package a captured Razorpay payment paid for. Used when
 * the payment went through but the package never reached the profile, or when
 * a payment has to be assigned to a different student than the buyer's email
 * suggests.
 *
 * Nothing about the payment is taken from the browser: Razorpay is asked for
 * the payment itself (captured? refunded? how much?), and the package and its
 * quota come from the order notes and the package document. The admin chooses
 * only WHICH student receives it.
 *
 * Safe to repeat: a payment is credited at most once (see creditPurchase).
 */
import { adminDb, requireAdmin } from '../../../lib/firebaseAdmin.js';
import { razorpayGet } from '../../../lib/razorpay.js';
import { creditPurchase } from '../../../lib/creditPurchase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const caller = await requireAdmin(req, res);
    if (!caller) return;

    const { paymentId, uid } = req.body || {};
    if (!paymentId || !uid || typeof paymentId !== 'string' || typeof uid !== 'string') {
        res.status(400).json({ error: 'A payment and a student are required.' });
        return;
    }

    try {
        let payment;
        try {
            payment = await razorpayGet(`payments/${encodeURIComponent(paymentId)}`);
        } catch (err) {
            // Razorpay answers 4xx for an id it does not know. That is the
            // admin's input, not a server fault.
            if (err.httpStatus >= 400 && err.httpStatus < 500) {
                res.status(404).json({ error: 'Razorpay has no payment with that ID.' });
                return;
            }
            throw err;
        }

        if (payment.status !== 'captured') {
            res.status(400).json({ error: `This payment was not completed (status: ${payment.status}), so nothing was paid for.` });
            return;
        }
        if ((payment.amount_refunded || 0) > 0) {
            res.status(400).json({ error: 'This payment was refunded, so it cannot be credited.' });
            return;
        }

        const packageId = payment.notes && payment.notes.packageId;
        if (!packageId) {
            res.status(400).json({ error: 'This payment has no package recorded on it.' });
            return;
        }
        const pkgSnap = await adminDb.collection('packages').doc(packageId).get();
        if (!pkgSnap.exists) {
            res.status(400).json({ error: `The package for this payment (${packageId}) no longer exists.` });
            return;
        }
        const pkg = pkgSnap.data();

        const expectedPaise = Math.round(Number(pkg.discountPrice || pkg.price || 0) * 100);
        if (!expectedPaise || payment.amount < expectedPaise) {
            res.status(400).json({ error: `Paid ₹${payment.amount / 100}, which is less than the package price ₹${expectedPaise / 100}.` });
            return;
        }

        const result = await creditPurchase(adminDb, { payment, pkg, packageId, uid, actorUid: caller.uid });

        if (result.status === 'already-credited') {
            res.status(200).json({ success: true, alreadyCredited: true, message: 'This payment had already been credited.' });
            return;
        }
        res.status(200).json({ success: true, message: `Credited ${result.quota} tests.` });
    } catch (err) {
        if (err.message === 'STUDENT_NOT_FOUND') {
            res.status(404).json({ error: 'That student could not be found.' });
            return;
        }
        if (err.message === 'PACKAGE_HAS_NO_QUOTA') {
            res.status(400).json({ error: 'The package has no test quota configured.' });
            return;
        }
        console.error('[admin/credit-payment] Failed:', err);
        res.status(500).json({ error: 'Could not credit this payment.' });
    }
}
