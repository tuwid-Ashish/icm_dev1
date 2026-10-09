/**
 * POST /api/razorpay/create-order
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body:    { packageId }
 *
 * Creates a Razorpay order for one package, on behalf of the signed-in student.
 *
 * Three things are decided HERE rather than trusted from the browser:
 *
 *   who    ← the verified ID token. It is stamped on the order (notes.uid), so a
 *            captured payment can always be traced to a student without
 *            matching on email or phone.
 *   what   ← packageId, which must exist in Firestore.
 *   price  ← the package document. The body used to carry `amount`, which meant
 *            checkout could charge one price while verify-payment (which reads
 *            the same package) demanded another — a mismatch that takes the
 *            student's money and credits nothing.
 *
 * This route deliberately depends on the Firebase Admin SDK, the same as
 * /api/razorpay/verify-payment. If the server cannot credit a purchase it must
 * also refuse to start one: failing here costs the student nothing, whereas
 * failing after checkout takes their money and leaves them with no package.
 *
 * Razorpay Key Secret lives only in this server-side environment and is never
 * sent to the browser. Returns the public Key ID and order id for checkout.
 */
import { adminDb, verifyCaller } from '../../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        res.status(500).json({ error: 'Razorpay credentials are not configured on the server.' });
        return;
    }

    const caller = await verifyCaller(req);
    if (!caller) {
        res.status(401).json({ error: 'Please sign in to purchase a package.' });
        return;
    }

    const { packageId } = req.body || {};
    if (!packageId || typeof packageId !== 'string') {
        res.status(400).json({ error: 'A package is required.' });
        return;
    }

    try {
        const pkgSnap = await adminDb.collection('packages').doc(packageId).get();
        if (!pkgSnap.exists) {
            res.status(400).json({ error: 'Unknown package.' });
            return;
        }
        const pkg = pkgSnap.data();
        const amountRupees = Number(pkg.discountPrice || pkg.price || 0);
        if (!amountRupees || amountRupees <= 0) {
            res.status(400).json({ error: 'This package has no price configured.' });
            return;
        }

        const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

        const razorpayRes = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader
            },
            body: JSON.stringify({
                amount: Math.round(amountRupees * 100), // paise
                currency: 'INR',
                receipt: `pkg_${packageId}_${Date.now()}`,
                notes: { packageId, uid: caller.uid }
            })
        });

        const order = await razorpayRes.json();

        if (!razorpayRes.ok) {
            console.error('[create-order] Razorpay API error:', order);
            res.status(502).json({ error: order?.error?.description || 'Razorpay order creation failed.' });
            return;
        }

        res.status(200).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId
        });
    } catch (err) {
        console.error('[create-order] Unexpected error:', err);
        res.status(500).json({ error: 'Could not create Razorpay order.' });
    }
}
