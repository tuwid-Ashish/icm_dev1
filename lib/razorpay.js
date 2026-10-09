/**
 * Minimal server-side Razorpay reads for the admin payment tools.
 * Uses the Key Secret, so it must only ever be imported from pages/api.
 */
function authHeader() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error('Razorpay credentials are not configured on the server.');
    return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
}

export async function razorpayGet(path) {
    const res = await fetch(`https://api.razorpay.com/v1/${path}`, { headers: { Authorization: authHeader() } });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.description || `Razorpay request failed (${res.status})`);
    return json;
}

/** Latest payments first, up to `limit`. Razorpay returns at most 100 per call. */
export async function listRazorpayPayments(limit = 200) {
    const out = [];
    for (let skip = 0; out.length < limit; skip += 100) {
        const page = await razorpayGet(`payments?count=100&skip=${skip}`);
        out.push(...page.items);
        if (page.items.length < 100) break;
    }
    return out.slice(0, limit);
}
