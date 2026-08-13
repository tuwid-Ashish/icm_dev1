/**
 * POST /api/razorpay/verify-payment
 * Body: { orderId, paymentId, signature, student: {uid|id, name, email, mobile},
 *         pkg: {id, name, exam, totalTests, price, discountPrice}, amount }
 *
 * Recomputes the HMAC-SHA256 signature of "orderId|paymentId" using the
 * Razorpay Key Secret (server-side only) and compares it to what the
 * browser received from Razorpay's checkout handler. Quota is only
 * credited here, server-side with firebase-admin, if that signature is
 * genuine — the client can no longer credit itself by calling a Firestore
 * write directly with a made-up paymentId.
 */
import crypto from 'crypto';
import { getAdminDb } from '../_lib/firebaseAdmin.js';

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

    const { orderId, paymentId, signature, student, pkg, amount } = req.body || {};

    if (!orderId || !paymentId || !signature || !student || !pkg) {
        res.status(400).json({ error: 'Missing required verification fields.' });
        return;
    }

    const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

    const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf8'),
        Buffer.from(String(signature), 'utf8')
    );

    if (!isValid) {
        console.warn('[verify-payment] Signature mismatch for order', orderId);
        res.status(400).json({ success: false, error: 'Payment signature verification failed.' });
        return;
    }

    try {
        const db = getAdminDb();
        const studentId = student.uid || student.id;

        const profileSnap = await db.collection('users').doc(studentId).get();
        const profile = profileSnap.exists ? profileSnap.data() : null;

        const currentRemaining = Number(profile?.remainingTests || student.remainingTests || 0);
        const currentAllowed = Number(profile?.allowedTests || student.allowedTests || 0);
        const addedQuota = Number(pkg.totalTests || 10);

        const newPurchasedPackage = {
            id: 'pkg_purch_' + Date.now(),
            packageId: pkg.id,
            packageName: pkg.name,
            exam: pkg.exam,
            totalTests: addedQuota,
            amountPaid: amount || pkg.discountPrice || pkg.price,
            paymentMethod: 'Razorpay',
            razorpayPaymentId: paymentId,
            razorpayOrderId: orderId,
            paymentStatus: 'COMPLETED',
            purchaseDate: new Date().toISOString()
        };

        const updatedStudent = {
            ...(profile || student),
            uid: studentId,
            id: studentId,
            remainingTests: currentRemaining + addedQuota,
            allowedTests: currentAllowed + addedQuota,
            purchasedPackages: [...((profile?.purchasedPackages || student.purchasedPackages) || []), newPurchasedPackage],
            updatedAt: new Date().toISOString()
        };

        const requestData = {
            id: 'req_rzp_' + Date.now(),
            studentId,
            studentName: student.name,
            studentEmail: student.email,
            studentMobile: student.mobile || '9876543210',
            packageId: pkg.id,
            packageName: pkg.name,
            targetExam: pkg.exam,
            testQuota: addedQuota,
            amount: amount || pkg.discountPrice || pkg.price,
            paymentMethod: 'Razorpay',
            utrNumber: paymentId,
            razorpayPaymentId: paymentId,
            razorpayOrderId: orderId,
            status: 'approved',
            createdAt: new Date().toISOString(),
            approvedAt: new Date().toISOString()
        };

        await db.collection('users').doc(studentId).set(updatedStudent, { merge: true });
        await db.collection('package_requests').doc(requestData.id).set(requestData);

        res.status(200).json({
            success: true,
            user: updatedStudent,
            message: `Payment Verified! ${addedQuota} Tests credited to your account.`
        });
    } catch (err) {
        console.error('[verify-payment] Firestore credit error:', err);
        res.status(500).json({ success: false, error: 'Payment verified but crediting quota failed. Contact support.' });
    }
}
