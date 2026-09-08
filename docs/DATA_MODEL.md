# Data Model — join on ids, never on names

The one rule this codebase keeps breaking, and the target shape for the four
things that matter: **packages, questions, subject codes, payments.**

---

## The rule

> Every relationship is expressed by exactly one opaque, stable id.
> A human-readable label may be stored alongside it for display, but **nothing
> may ever match, filter, or resolve on that label.** If the id does not
> resolve, that is an error to surface — never a reason to guess.

Three corollaries, each earned from a real bug in this repo:

**1. Never derive an id from a name.** `police_bharti` became `pb`, and ten
purchases silently stopped unlocking anything (issue A1). An id that encodes a
name will be rewritten when the name changes. Ids are arbitrary and permanent.

**2. Never fall back from an id to a name.** `getExamAccess` did exactly this:

```js
return p.exam === exam.name || (exam.name || '').includes(p.exam || ' ');
```

When `p.exam` is missing that becomes `name.includes(' ')` — a space — which
matches any exam name containing a space and unlocks *everything*. A fallback
turns a data error into a silent wrong answer. Remove it; let the id fail loudly.

**3. A stored label is a cache, and must look like one.** `exam`, `examName`,
`subject`, `packageName` are denormalised copies. Name them so nobody is
tempted to join on them (`examLabel`), and treat them as refreshable.

---

## Where the model is already correct

Worth saying plainly, because it changes what needs doing:

**Every one of the 2143 questions already carries a valid subject code.**
M1×246 · M2×242 · M3×49 · M4×6 · M5×5 · M6×612 · M7×981 · M9×2 — summing to
exactly 2143, with no `OTHER` and no missing values. `subjectCode` and the
`subject` label agree on every single row.

So the model you described — *tag each question with a subject code, then do all
identification, filtering and random paper generation off that code alone,
without caring what is inside the question* — **already works in the data.**

What doesn't work is the code, which refuses to trust it. `resolveSubjectCode`
ends in a substring alias match:

```js
if (aliasList.some(a => lower === a || lower.includes(a) || a.includes(lower)))
```

and `isQuestionMatchingSubject` ends in:

```js
if (qSub === bpSub || qSub.includes(bpSub) || bpSub.includes(qSub)) return true;
```

So a question whose `subjectCode` is a correct `M4` can still be pulled into an
`M6` bucket because "GK" is a substring of something in M6's alias list. The fix
is subtraction, not addition: **match on `subjectCode` equality and stop there.**
Aliases stay, but only for resolving *free-text input* at import time — never
for matching an already-coded question.

---

## Target shape

`→` = id join. `~` = display cache, never matched on.

```
subject_codes/{code}          M1, M2, … M10          ← the code IS the id
  code, name, name_mr, aliases[], color, order

questions/{questionId}
  → subjectCode               "M4"                   the only subject link
  ~ subject                   "GK 1"                 display cache
  text, text_mr, options[4], correctIndex 0..3, explanation, marks

exams/{examId}                pb, gd, vr, free_test_2026
  name, totalQuestions, durationMinutes, negativeMarkingRate, isFreeTest
  blueprint[]:
    → subjectCode             "M1"     (currently misnamed `subjects[].name`)
      questionsCount, marksPerQuestion

packages/{packageId}          pkg_1787218557394
  → examId                    "pb"                   what this package unlocks
  ~ exam                      "महाराष्ट्र पोलीस भरती"  display cache
  name, price, discountPrice, totalTests, status

users/{uid}                   ← doc id is the identity; drop `id` and `uid`
  name, email, mobile, role, status
  allowedTests, remainingTests, completedTests    ← server-writable only
  purchasedPackages[]:
    → packageId               which product was bought
    → examId                  which exam it unlocks  ← snapshot at purchase time
    → paymentId               the receipt
    ~ packageName, exam       display cache
    totalTests, amountPaid, purchaseDate

payments/{razorpayPaymentId}  ← the payment id IS the doc id = idempotency
  → uid, → packageId, amount, quotaCredited, orderId

test_attempts/{attemptId}
  → studentId (uid), → examId
  ~ examName, studentName
  scores…, detailedReview[]
```

### Why `purchasedPackages[].examId` is snapshotted, not looked up

A purchase must keep working if the package is later edited or deleted. Storing
`examId` on the purchase at the moment of sale is a deliberate snapshot of *what
was actually bought* — not denormalisation for speed. `packageId` records which
product; `examId` records the entitlement it granted. Both are needed.

This is also why A1 was repairable at all: `packageId` was intact, so the
correct `examId` could be recovered from the package.

---

## What changes, concretely

| # | Change | Effect |
|---|--------|--------|
| 1 | `getExamAccess`: match `p.examId === exam.id` only; delete the name fallback | Closes the `includes(' ')` universal unlock |
| 2 | ✅ **DONE** `isQuestionMatchingSubject` is now `q.subjectCode === blueprint.subjectCode`; substring matching deleted | Subject-wise papers are exact. Verified a no-op on live data by `scripts/compareSubjectMatching.js` — identical pool for all 9 codes, 0 questions matching multiple codes |
| 3 | ✅ **DONE** `resolveSubjectCode`: exact code → code-with-separator prefix → exact name → **exact** alias. `includes()` removed; returns `resolved: true/false` | Import stops mis-filing. Free-text CSV subjects that only worked by substring (`"Elementary Mathematics"`, `"Intelligence Test"`) now fail loudly — the bulk-import preview lists every unresolved row and blocks the import instead of filing them under OTHER |
| 4 | ✅ **DONE** Blueprint `subjects[].name` → `subjects[].subjectCode`; both blueprint editors now use a dropdown of real codes; exam ids no longer derived from the display code | The coupling stops being a lie |
| 5 | Drop `batch` (keep `batches[]`), `correctOption` (keep `correctIndex`), `users.id`/`uid` | One representation per fact |
| 6 | Rename display caches: `exam` → `examLabel`, `subject` → `subjectLabel` | Makes misuse obvious in review |

Changes 1–3 are pure deletion of fallbacks and are safe **because the data is
already clean** — verified by `scripts/auditDb.js` before each one.

---

## Preventing regression

Four separate paths write questions (admin form, CSV import, two seed scripts),
each with its own shape and its own defaults. That is how `batch` *and*
`batches[]`, `correctIndex` *and* `correctOption` both came to exist.

- **One normaliser per entity** — `normalizeQuestion(raw, refData) →
  { ok, value, errors[] }` — that every writer must call.
- **Reject loudly.** An unresolvable subject becomes an error row in the import
  preview, not a silent `OTHER`. An empty batch cell is not silently
  `'Police Bharti'` (csvParserService.js:15).
- **Validate against live reference data** (the `subject_codes` collection), not
  a hardcoded array.
- **`auditDb.js` before each release.** It already detects dangling ids, mixed
  types, quota drift and blueprint shortfalls.
