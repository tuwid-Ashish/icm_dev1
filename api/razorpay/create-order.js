/**
 * POST /api/razorpay/create-order
 * Body: { amount: number (INR, rupees), packageId: string }
 *
 * Creates a real Razorpay order using the Key Secret, which lives only in
 * this server-side function's environment (Vercel dashboard env var) — it
 * is never sent to, or readable by, the browser. Returns the public Key ID
 * and order id needed to open the Razorpay checkout on the client.
 */
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

    const { amount, packageId } = req.body || {};
    const amountRupees = Number(amount);

    if (!amountRupees || amountRupees <= 0) {
        res.status(400).json({ error: 'A valid positive amount is required.' });
        return;
    }

    try {
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
                receipt: `pkg_${packageId || 'unknown'}_${Date.now()}`,
                notes: { packageId: packageId || '' }
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
