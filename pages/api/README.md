# Razorpay API Routes

Server-side endpoints under `pages/api/razorpay/` — Next.js API routes,
deployed automatically by Vercel as serverless functions. The Razorpay Key
Secret lives only here, never in the client bundle.

Kept deliberately simple: no Firebase Admin SDK / service account, no
webhook. These routes only create the order and verify the payment
signature; the actual quota credit happens client-side afterwards (same
Firestore write path as the "Simulate Instant Quota Credit" test button),
which is enough for this app's risk profile.

## One-time setup (only you can do this — never paste secrets to an AI assistant)

1. **Set environment variables** in the Vercel dashboard → your project →
   Settings → Environment Variables (apply to Production **and** Preview):
   - `RAZORPAY_KEY_ID` — same value as the Key ID already used client-side
     (e.g. `rzp_live_xxxxxxxxxx`)
   - `RAZORPAY_KEY_SECRET` — from Razorpay Dashboard → Settings → API Keys.
     **Never** prefix this with `NEXT_PUBLIC_` — that would bundle it into
     the browser build, which is exactly what this setup avoids.

2. **Deploy**: push to the branch Vercel is watching, or run `vercel --prod`
   if you deploy manually.

## Local testing

`npm run dev` (`next dev`) serves `/api/*` routes directly. Populate a local
`.env` with the two variables above.

## Endpoints

- `POST /api/razorpay/create-order` — `{ amount, packageId }` → `{ orderId, amount, currency, keyId }`
- `POST /api/razorpay/verify-payment` — `{ orderId, paymentId, signature }` → `{ verified: true }` or `{ verified: false, error }`

`verify-payment` only confirms the payment is genuine (HMAC-SHA256 signature
check using the secret) — a forged/made-up payment id will fail this check.
The client then credits quota itself via `firestoreEngine.processRazorpayPaymentSuccess`,
same as the existing test button.
