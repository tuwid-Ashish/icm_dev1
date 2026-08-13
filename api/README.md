# Razorpay Serverless Functions

Server-side endpoints under `/api/razorpay/` — deployed automatically by Vercel
as serverless functions (zero config, works on the free Hobby plan). The
Razorpay Key Secret lives only here, never in the client bundle.

## One-time setup (only you can do this — never paste secrets to an AI assistant)

1. **Set environment variables** in the Vercel dashboard → your project →
   Settings → Environment Variables (apply to Production **and** Preview):
   - `RAZORPAY_KEY_ID` — same value as the Key ID already used client-side
     (e.g. `rzp_live_xxxxxxxxxx`)
   - `RAZORPAY_KEY_SECRET` — from Razorpay Dashboard → Settings → API Keys.
     **Never** prefix this with `VITE_` — that would bundle it into the
     browser build, which is exactly what this setup avoids.
   - `FIREBASE_SERVICE_ACCOUNT_KEY` — the full contents of a Firebase service
     account JSON (Firebase Console → Project Settings → Service Accounts →
     Generate new private key), pasted as **one single-line JSON string**.
     Same credential shape as the existing `serviceAccountKey.json` used by
     `scripts/seedFirestoreAdmin.js`.

2. **Deploy**: push to the branch Vercel is watching, or run `vercel --prod`
   if you deploy manually.

## Local testing

Plain `npm run dev` (Vite) does **not** serve `/api/*` — those routes only
run under Vercel's own dev server:

```bash
npm i -g vercel      # once
vercel dev
```

`vercel dev` reads a local `.env` file for the three variables above (or
falls back to a local `serviceAccountKey.json` in the repo root for
`FIREBASE_SERVICE_ACCOUNT_KEY`, matching the existing scripts/ convention).

## Endpoints

- `POST /api/razorpay/create-order` — `{ amount, packageId }` → `{ orderId, amount, currency, keyId }`
- `POST /api/razorpay/verify-payment` — `{ orderId, paymentId, signature, student, pkg, amount }` → `{ success, user? }`

Quota is only credited by `verify-payment`, and only after it recomputes the
HMAC-SHA256 signature itself using the secret and confirms it matches what
Razorpay's checkout returned to the browser — the client can no longer credit
itself by calling a Firestore write directly with a made-up payment id.
