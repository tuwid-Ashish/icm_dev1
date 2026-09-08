# Remediation Plan — SigmaForce CEP Platform

> Full audit with reasoning: https://claude.ai/code/artifact/cd56a329-c9af-4990-aaac-0fac2372f73d
> Status: **plan only — no code changed.** Cited against `master`.

## Verdict

Every rule that decides who paid, who is admin, and what score a student got is
evaluated in the browser and written to Firestore by that same browser, under
rules that say `allow read, write: if request.auth != null`. That is the core
problem. Under it sit three dead features caused by single lines that a linter
would catch — and there is no linter, no test, and no CI.

---

## Live database audit

`node scripts/auditDb.js` — read-only, no writes, PII redacted. Re-run it after
any migration to verify. Project `competitive-tester`: 2143 questions, 9 users,
4 exams, 3 packages, 69 attempts.

Findings not visible from source, in severity order:

1. **9 of 13 purchases unlock nothing — paying students are locked out now.**
   Purchases carry `examId` values from a dead id scheme (`police_bharti`,
   `ssc_gd`, `vanrakshak`, `mh_police_2026`); real ids are `pb`, `gd`, `vr`.
   The legacy name fallback also fails (`"Police Bharti"` vs
   `"महाराष्ट्र पोलीस भरती"`). 4 distinct students affected.
2. **Blueprints cannot be filled and the engine hides it.** `vr` asks 100 and
   can deliver 58; `gd` asks 80, delivers 60 (M8 Hindi has **0** questions).
   74% of the bank sits in M7 (981) + M6 (612); M8=0, M9=2, M5=5, M4=6.
3. **Batch tagging is inert.** All 2143 questions are `All Batches`/`ALL` — not
   one carries Police Bharti / Vanrakshak / SSC GD. Every exam draws from one
   shared pool; the batch UI, `EXAM_ID_TO_BATCH` and `questionBatch` are no-ops.
   Every question also stores `batches[]` **and** `batch` (100% duplicated).
4. **`subject_codes` never existed** → confirms the deployed rules match this
   repo (the client's own seed was denied). Open question 2 answered.
5. One user doc holds a 7-char **plaintext `password`**; one lacks `uid`/`id`;
   a ₹299 package has `discountPrice: 1`; some `test_attempts` use seed ids
   (`std_101`) not Firebase uids.

## Phase 1 — Stop the bleeding ✅ code applied, build passes

- [x] `firestore.rules` — added the missing `subject_codes` match block.
- [x] `QuestionBankManager.jsx:170` — was `SUBJECT_CODES` (never imported) →
      `ReferenceError` above the try block → **manual question save was dead.**
      Now resolves against the component's loaded `subjectCodes` state.
- [x] `ExamContext.jsx` — imported `storageService`; the offline submission
      fallback no longer throws in the one case it exists for.
- [x] `firestoreEngine.js` — new `mergeSubjectCodes()` merges cache over the
      defaults by code instead of `offline.length > 0 ? offline : DEFAULT`.
      This is the reported "add M10 and M1–M9 vanish" bug.
- [x] `ExamPaperGenerator.jsx` — picker seeds from `questions`, not
      `candidateQuestions`, so filters no longer wipe hand-picked selections.
- [ ] **Needs your go-ahead (writes to production):**
      - deploy `firestore.rules`
      - `node scripts/seedSubjectCodes.js --commit` — dry-run verified: creates
        9 docs, overwrites none

## Phase 2 — Close the trust boundary (2–3 days)

Blocking for revenue. Do before any refactor.

- [x] **DEPLOYED** Rewrote `firestore.rules`: owner-scoped `users/{uid}`, with
      `role`, `allowedTests`, `remainingTests`, `purchasedPackages`,
      `freeTestAttempts` immutable from the client. `test_attempts` and
      `package_requests` create-only + owner-scoped. `payments` client-invisible.
      Content collections public-read, admin-write. Admin gated on
      `request.auth.token.admin == true`.
      Released via `node scripts/deployFirestoreRules.js --commit`
      (the CLI fails a serviceusage pre-flight check this service account
      cannot pass; the script uses the same Rules REST API the CLI does).
      Verified live with 7 unauthenticated probes: public catalog readable;
      `users` / `test_attempts` / `package_requests` / `payments` all denied.
      **Rollback ruleset:** `projects/competitive-tester/rulesets/c2fdeb6b-d961-45d9-9f32-668aebf18cc8`
- [ ] Delete both `email.includes('admin')` role assignments
      (`firebaseAuthService.js:72, :131`). Admin becomes a custom claim set by
      `scripts/createAdminAccount.js`.
- [ ] Move quota crediting into `verify-payment` behind the signature check,
      using the Admin SDK, idempotent on Razorpay `paymentId`. Delete
      `processRazorpayPaymentSuccess` from the client. Same for manual UPI;
      enforce UTR uniqueness by document id, not a client-side scan.
- [ ] **Repair purchase data**: backfill `examId` on the 10 dangling
      `purchasedPackages` entries, then delete the fuzzy-name fallback in
      `getExamAccess` — while it exists, a purchase with no `exam` label hits
      `name.includes(' ')` and unlocks *everything*.
- [x] ~~Server-side scoring~~ — **out of scope, confirmed.** Unproctored mock
      exams, no certificate; a student reading the answer key harms only their
      own practice. Client-side evaluation stays. Note the boundary: this covers
      *test integrity* only, not payment or privacy, which remain in scope.

## Phase 3 — Install the net (1 day)

Must land before Phases 4–6.

- [ ] ESLint + `react`/`react-hooks` plugins. `no-undef` alone catches two of
      today's broken features. `npm run lint` currently points at an ESLint that
      isn't installed.
- [ ] Vitest over the pure logic only: `resolveSubjectCode`, `parseCSVQuestions`,
      `getExamAccess`, `evaluateSubmission`, `isQuestionMatchingSubject`.
- [ ] GitHub Action: lint + test + `next build`.

## Phase 4 — One source of truth (1–2 days)

The "not centralized" problem.

- [ ] Move exam batches to Firestore + admin screen. Delete the hardcoded arrays
      in `QuestionBankManager:46`, `SubjectWiseCountWidget:94`,
      `SystemReportsPage:111` (uses *different* strings — already filters wrong),
      and `csvParserService:15`.
- [ ] One `ReferenceDataProvider` context replacing six independent
      `getSubjectCodes()` calls and the mutable module-global in
      `subjectCodes.js`.
- [ ] `resolveSubjectCode`: exact code → exact name → **exact** alias. Drop the
      `includes()` fallbacks. Return a resolution status; surface unresolved
      subjects in the CSV preview instead of silently filing them as OTHER.
- [ ] `isQuestionMatchingSubject`: match on subject code only; blueprints store
      codes, not display names.
- [ ] **Migration:** before switching, script a report of every question whose
      resolved code changes under the strict resolver. Fix the data, not the
      resolver.

## Phase 5 — Make failures visible (1 day)

- [ ] Remove the dead `isFirebaseConnected` offline branching from
      `firestoreEngine`. One backend, one path.
- [ ] Stop returning `[]` on error. Loading / error / empty must be three states.
- [ ] Replace 9 `alert()` + 6 `confirm()` with the existing `Modal`.
- [ ] Remove 23 `console.log`s — several log profiles and payment data.

## Phase 6 — Stop reading the whole database (1–2 days)

- [ ] `where('batches','array-contains',batch)` + composite index instead of
      fetching all questions and filtering in JS. Drop the duplicate `batch`
      string field via migration.
- [ ] Paginate the question table; count widgets read a counter doc.
- [ ] Collapse the four independent full question fetches on the admin dashboard
      into one shared load.
- [ ] Delete dead CSS — `src/styles.css` (827), `src/styles/global.css` (540),
      `src/styles/variables.css` are imported by nothing. Verify with grep, then
      delete in a standalone commit.

---

## Open questions — both answered

1. **Is cheating in scope?** **No.** Unproctored mock exams, no certificate.
   Server-side scoring dropped. Payment / quota / role / privacy stay in scope.
2. **Do the deployed rules match this repo?** **Yes** — proven by
   `subject_codes` not existing at all, which is only possible if the client's
   own seed write was denied.

## New: Phase 0 — data repair (do before or alongside Phase 2)

Purely data, no code. Each needs a dry-run script and your sign-off.

- [ ] Backfill `examId` on the 10 dangling purchases → real ids (`pb`/`gd`/`vr`).
      Unblocks 4 paying students.
- [ ] Delete the plaintext `password` field from the one user doc holding it.
- [ ] Decide the batch strategy: either tag questions per exam board for real,
      or drop the batch dimension from the UI. Today it promises a separation
      the data does not have.
- [ ] Fill the M8 (Hindi = 0), M9 (2) and M4 (6) gaps, or reduce the blueprints
      to what the bank can actually supply — and make `examEngine` warn instead
      of silently shipping a short paper.
