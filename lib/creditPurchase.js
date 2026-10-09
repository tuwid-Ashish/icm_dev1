/**
 * Credits one captured Razorpay payment to one student, exactly once.
 *
 * Used by the admin "Payments" screen to hand out a package that a payment paid
 * for but that never reached the student's profile (and to assign a payment to
 * a different student when the buyer can't be matched automatically).
 *
 * Everything happens in one transaction, mirroring /api/razorpay/verify-payment:
 *   - appends the purchase to the student's purchasedPackages
 *   - adds the package's tests to their quota
 *   - writes payments/{paymentId}, the marker that makes a second attempt a no-op
 *   - writes a package_requests record so the existing admin queue shows it
 *
 * Idempotent on the Razorpay payment id: a payment already credited — whether
 * through the marker, or by an older purchase on the profile that carries the
 * same paymentReference — is left alone.
 */
export async function creditPurchase(db, { payment, pkg, packageId, uid, actorUid }) {
    const paymentId = payment.id;
    const quota = Number(pkg.totalTests || 0);
    if (!quota) throw new Error('PACKAGE_HAS_NO_QUOTA');

    const paymentRef = db.collection('payments').doc(paymentId);
    const userRef = db.collection('users').doc(uid);
    const requestRef = db.collection('package_requests').doc('req_rzp_' + paymentId);
    const when = new Date(payment.created_at * 1000).toISOString();
    const now = new Date().toISOString();

    return db.runTransaction(async (tx) => {
        const [marker, userSnap] = await Promise.all([tx.get(paymentRef), tx.get(userRef)]);
        if (!userSnap.exists) throw new Error('STUDENT_NOT_FOUND');
        if (marker.exists) return { status: 'already-credited', creditedTo: marker.data().uid };

        const user = userSnap.data();
        if ((user.purchasedPackages || []).some(p => p.paymentReference === paymentId)) {
            return { status: 'already-credited', creditedTo: uid };
        }

        tx.update(userRef, {
            allowedTests: Number(user.allowedTests || 0) + quota,
            remainingTests: Number(user.remainingTests || 0) + quota,
            purchasedPackages: [...(user.purchasedPackages || []), {
                id: 'pkg_purch_' + paymentId,
                packageId,
                examId: pkg.examId || null,
                packageName: pkg.name || '',
                exam: pkg.exam || '',
                totalTests: quota,
                amountPaid: payment.amount / 100,
                paymentMethod: 'Razorpay',
                paymentReference: paymentId,
                paymentStatus: 'COMPLETED',
                purchaseDate: when,
                assignedByAdmin: actorUid || null,
                assignedAt: now
            }],
            updatedAt: now
        });

        tx.set(paymentRef, {
            paymentId, orderId: payment.order_id, uid, packageId,
            amount: payment.amount / 100, quotaCredited: quota, createdAt: when,
            assignedByAdmin: actorUid || null, assignedAt: now
        });

        tx.set(requestRef, {
            id: 'req_rzp_' + paymentId, studentId: uid, studentName: user.name || '',
            studentEmail: user.email || '', studentMobile: user.mobile || '',
            packageId, packageName: pkg.name || '', targetExam: pkg.exam || '',
            testQuota: quota, amount: payment.amount / 100, paymentMethod: 'Razorpay',
            utrNumber: paymentId, razorpayPaymentId: paymentId, status: 'approved',
            createdAt: when, approvedAt: now, assignedByAdmin: actorUid || null
        });

        return { status: 'credited', quota };
    });
}
