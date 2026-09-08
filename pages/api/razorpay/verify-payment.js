/**
 * POST /api/razorpay/verify-payment
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body:    { orderId, paymentId, signature, packageId }
 *
 * Verifies a Razorpay payment AND performs the quota credit, in one place the
 * browser cannot reach.
 *
 * Previously this route only returned {verified:true} and the browser then
 * wrote the quota to Firestore itself — so the signature check gated nothing:
 * a student could call the client-side credit helper directly, or simply edit
 * their own user document. Everything that decides what was paid for is now
 * read server-side from trusted sources:
 *
 *   who    ← the verified Firebase ID token, never a uid in the body
 *   what   ← the package document in Firestore, never a price in the body
 *   paid   ← the Razorpay API, never the amount in the body
 *
 * Crediting is idempotent on the Razorpay payment id: a replayed or
 * double-fired request finds the marker document and credits nothing.
 */
import crypto from 'crypto';
import { adminDb, verifyCaller } from '../../../lib/firebaseAdmin.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || !keyId) {
        res.status(500).json({ error: 'Razorpay credentials are not configured on the server.' });
        return;
    }

    // --- 1. Who is calling? ------------------------------------------------
    const caller = await verifyCaller(req);
    if (!caller) {
        res.status(401).json({ verified: false, error: 'You must be signed in to complete a purchase.' });
        return;
    }
    const uid = caller.uid;

    const { orderId, paymentId, signature, packageId } = req.body || {};
    if (!orderId || !paymentId || !signature || !packageId) {
        res.status(400).json({ verified: false, error: 'Missing required verification fields.' });
        return;
    }

    // --- 2. Is the signature genuine? --------------------------------------
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
    const signatureValid =
        expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!signatureValid) {
        console.warn('[verify-payment] Signature mismatch for order', orderId, 'uid', uid);
        res.status(400).json({ verified: false, error: 'Payment signature verification failed.' });
        return;
    }

    try {
        // --- 3. What does Razorpay say was actually paid? ------------------
        // A valid signature proves the ids came from Razorpay; it does not
        // prove the payment succeeded or how much it was for. Ask Razorpay.
        const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
            headers: { Authorization: authHeader }
        });
        const payment = await rzpRes.json();

        if (!rzpRes.ok) {
            console.error('[verify-payment] Razorpay lookup failed:', payment);
            res.status(502).json({ verified: false, error: 'Could not confirm the payment with Razorpay.' });
            return;
        }
        if (payment.order_id !== orderId) {
            res.status(400).json({ verified: false, error: 'Payment does not belong to this order.' });
            return;
        }
        if (payment.status !== 'captured' && payment.status !== 'authorized') {
            res.status(400).json({ verified: false, error: `Payment is not complete (status: ${payment.status}).` });
            return;
        }

        // --- 4. What was bought? (price comes from Firestore, not the body) -
        const pkgSnap = await adminDb.collection('packages').doc(String(packageId)).get();
        if (!pkgSnap.exists) {
            res.status(400).json({ verified: false, error: 'Unknown package.' });
            return;
        }
        const pkg = pkgSnap.data();
        const expectedPaise = Math.round(Number(pkg.discountPrice || pkg.price || 0) * 100);
        const paidPaise = Number(payment.amount || 0);

        if (!expectedPaise || paidPaise < expectedPaise) {
            console.warn('[verify-payment] Amount mismatch', { packageId, expectedPaise, paidPaise, uid });
            res.status(400).json({ verified: false, error: 'Paid amount does not match the package price.' });
            return;
        }

        const addedQuota = Number(pkg.totalTests || 0);
        if (!addedQuota) {
            res.status(500).json({ verified: false, error: 'Package has no test quota configured.' });
            return;
        }

        // --- 5. Credit, exactly once ---------------------------------------
        const paymentRef = adminDb.collection('payments').doc(String(paymentId));
        const userRef = adminDb.collection('users').doc(uid);

        const outcome = await adminDb.runTransaction(async (tx) => {
            const already = await tx.get(paymentRef);
            if (already.exists) return { alreadyCredited: true };

            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) throw new Error('USER_PROFILE_MISSING');
            const user = userSnap.data();

            const purchase = {
                id: 'pkg_purch_' + paymentId,
                packageId: String(packageId),
                examId: pkg.examId || null,
                packageName: pkg.name || '',
                exam: pkg.exam || '',
                totalTests: addedQuota,
                amountPaid: paidPaise / 100,
                paymentMethod: 'Razorpay',
                paymentReference: paymentId,
                paymentStatus: 'COMPLETED',
                purchaseDate: new Date().toISOString()
            };

            tx.update(userRef, {
                allowedTests: Number(user.allowedTests || 0) + addedQuota,
                remainingTests: Number(user.remainingTests || 0) + addedQuota,
                purchasedPackages: [...(user.purchasedPackages || []), purchase],
                updatedAt: new Date().toISOString()
            });

            // Marker doc — the idempotency key. Its existence is what makes a
            // replay a no-op, so it must be written in the same transaction.
            tx.set(paymentRef, {
                paymentId,
                orderId,
                uid,
                packageId: String(packageId),
                amount: paidPaise / 100,
                quotaCredited: addedQuota,
                createdAt: new Date().toISOString()
            });

            tx.set(adminDb.collection('package_requests').doc('req_rzp_' + paymentId), {
                id: 'req_rzp_' + paymentId,
                studentId: uid,
                studentName: user.name || '',
                studentEmail: user.email || '',
                studentMobile: user.mobile || '',
                packageId: String(packageId),
                packageName: pkg.name || '',
                targetExam: pkg.exam || '',
                testQuota: addedQuota,
                amount: paidPaise / 100,
                paymentMethod: 'Razorpay',
                utrNumber: paymentId,
                razorpayPaymentId: paymentId,
                status: 'approved',
                createdAt: new Date().toISOString(),
                approvedAt: new Date().toISOString()
            });

            return { alreadyCredited: false };
        });

        if (outcome.alreadyCredited) {
            res.status(200).json({
                verified: true,
                success: true,
                alreadyCredited: true,
                message: 'This payment has already been credited to your account.'
            });
            return;
        }

        res.status(200).json({
            verified: true,
            success: true,
            creditedTests: addedQuota,
            message: `Payment successful! ${addedQuota} tests credited to your account.`
        });
    } catch (err) {
        if (err.message === 'USER_PROFILE_MISSING') {
            console.error('[verify-payment] No user profile for uid', uid);
            res.status(409).json({
                verified: true,
                success: false,
                error: 'Payment succeeded but your profile could not be found. Contact support with your payment id.'
            });
            return;
        }
        console.error('[verify-payment] Credit failed:', err);
        res.status(500).json({
            verified: true,
            success: false,
            error: 'Payment succeeded but crediting failed. Contact support with your payment id — you will not be charged twice.'
        });
    }
}
