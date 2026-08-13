/**
 * POST /api/razorpay/verify-payment
 * Body: { orderId, paymentId, signature }
 *
 * Recomputes the HMAC-SHA256 signature of "orderId|paymentId" using the
 * Razorpay Key Secret (server-side only, never sent to the browser) and
 * compares it to what the browser received from Razorpay's checkout
 * handler. Only confirms the payment is genuine — crediting quota happens
 * client-side afterwards (firestoreEngine.processRazorpayPaymentSuccess),
 * same as the existing "simulate payment" path. Deliberately kept simple:
 * no Firebase Admin SDK / service account, no webhook — the app's actual
 * risk profile doesn't call for it.
 */
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        res.status(500).json({ error: 'Razorpay credentials are not configured on the server.' });
        return;
    }

    const { orderId, paymentId, signature } = req.body || {};

    if (!orderId || !paymentId || !signature) {
        res.status(400).json({ error: 'Missing required verification fields.' });
        return;
    }

    const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

    // timingSafeEqual throws (rather than returning false) on mismatched
    // buffer lengths — which any forged/malformed signature will have, so
    // that has to be checked first or every bad request 500s instead of
    // cleanly failing verification.
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const providedBuf = Buffer.from(String(signature), 'utf8');
    const isValid = expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!isValid) {
        console.warn('[verify-payment] Signature mismatch for order', orderId);
        res.status(400).json({ verified: false, error: 'Payment signature verification failed.' });
        return;
    }

    res.status(200).json({ verified: true });
}
