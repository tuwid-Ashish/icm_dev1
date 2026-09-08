# Database Issue Register — project `competitive-tester`

Source: `node scripts/auditDb.js` (read-only, re-runnable). Snapshot: 2143
questions · 9 users · 4 exams · 3 packages · 9 purchase requests · 69 attempts.

**All existing data is client-generated and must be preserved.** Everything
below is a repair or a normalisation, never a wipe.

Severity: 🔴 costs money or blocks a paying user · 🟠 corrupts results ·
🟡 latent / cleanup

---

## A. Identity & access

| # | Sev | Issue | Evidence | Fix |
|---|-----|-------|----------|-----|
| A1 | ✅ | ~~10 of 13 purchases carry an `examId` from a dead scheme~~ **FIXED** — `scripts/fixDanglingExamIds.js --commit` remapped 10 entries across 4 users to `pb`/`gd`/`vr`, stamping `examIdRepairedFrom` for auditability. Quota untouched. Verified: 13/13 now resolve. | — | done |
| A2 | 🟠 | `getExamAccess` legacy fallback is `name.includes(p.exam \|\| ' ')` — a purchase with no `exam` label matches any name containing a space and unlocks **everything** | src/utils/examAccess.js:36 | Delete the fallback once A1 lands |
| A3 | 🟡 | `priya@sigma.com` has a `users` document but no Firebase Auth account | orphan record | Delete, or create the auth account |
| A4 | 🟡 | 1 user doc stores a 7-character **plaintext** `password` | not a hash | Delete the field — Firebase Auth holds the credential |
| A5 | 🟡 | 1 user doc missing both `uid` and `id` | 89% coverage | Backfill from the document id |
| A6 | 🟡 | 2 users have `remainingTests > 500` | packages grant 500 each | Verify legitimate (multiple purchases) vs tampering |
| A7 | 🟡 | Every user stores identity 3× — document id, `id`, `uid` — all equal | 100% | Keep the doc id as truth; treat the others as legacy mirrors |

## B. Question bank (2143 docs)

| # | Sev | Issue | Evidence | Fix |
|---|-----|-------|----------|-----|
| B1 | ⏸️ | **Batch tagging is inert** — every question is `All Batches` (2126) or `ALL` (17). **DROPPED by decision:** the batch dimension is not in use and the product is not live. Exam scoping will be done by subject code via the blueprint instead. Revisit only if per-board question pools become a real requirement. | 2143/2143 | not doing |
| B2 | 🟠 | **Subject supply is lopsided.** M7=981, M6=612 (74% of the bank); M8=**0**, M9=2, M5=5, M4=6 | see §C | Author questions for M4/M5/M8/M9, or shrink the blueprints |
| B3 | 🟡 | Same fact stored twice: `batches[]` **and** `batch` string (100% of docs); `correctIndex` **and** `correctOption` (agree today — 0 disagreements — but two fields will drift) | 100% | Keep `batches[]` + `correctIndex`; drop the duplicates by migration |
| B4 | 🟡 | `options_mr` present on 17 docs (1%) and is a verbatim copy of `options` | admin-form rows only | Drop it, or populate it properly |
| B5 | 🟡 | `questionType` present on 17 docs (1%) | admin-form rows only | Backfill from `looksLikeMathContent`, then make it required |
| B6 | 🟡 | `imageUrl` is `string` on 2126 and `null` on 17 | mixed types | Normalise to `''` or `null`, pick one |
| B7 | 🟡 | `testType` / `language` / `correctAnswerLetter` missing on 4 docs | 2139/2143 | Backfill defaults |

**Healthy:** all 2143 have exactly 4 options, `correctIndex` is an integer 0–3
everywhere, and `subjectCode`/`subject` agree on every row. The answer key is
sound — the *classification* around it is what's weak.

## C. Exams & blueprints

| # | Sev | Issue | Evidence | Fix |
|---|-----|-------|----------|-----|
| C1 | ✅ | ~~Blueprints demand more than the bank can supply, silently~~ **FIXED** — `examEngine` now records every unfillable section on `session.shortfalls` (`{subjectCode, wanted, available}`) plus `session.requestedQuestions`. Both blueprint editors show live per-subject availability under each dropdown and a red "this paper cannot be filled" banner with the exact gap. Counts use Firestore count aggregation, not a full collection read. | — | done |
| C2 | ✅ | ~~`vr` configured for 120 but hard-capped to 100~~ **FIXED** — `Math.min(…, 100)` removed; the admin's configured total is authoritative. The cap also fed `scaleRatio`, so it was shrinking every section proportionally (4×30 served as 4×25), not just trimming the total. | — | done |
| C3 | 🟡 | 3 of 4 exams have no `questionBatch`, relying on `EXAM_ID_TO_BATCH` | 25% coverage | Set it explicitly on every exam |
| C4 | ✅ | ~~Blueprint `name` holds a subject **code**~~ **FIXED** — `scripts/migrateBlueprintSubjectCodes.js --commit` added `subjectCode` to all 17 rows across 4 exams (0 unresolved, exact-match only). Both blueprint editors now use a dropdown of live subject codes; exam ids are no longer derived from the display code. `name` retained as a fallback until `--drop-name`. | done | run `--drop-name` after deploy |

## D. Test attempts (69 docs)

| # | Sev | Issue | Evidence | Fix |
|---|-----|-------|----------|-----|
| D1 | 🟡 | Some `studentId` are seed ids (`std_101`), not Firebase uids — they match no real user and pollute reports and leaderboards | demo rows | Tag or delete the demo attempts |
| D2 | 🟡 | `studentName`/`studentEmail` missing on 1 of 69 | 99% | Backfill from `users` |
| D3 | 🟡 | `detailedReview` embeds full question text, options and the answer key per attempt — documents grow without bound | 69 docs today | Store question ids + the given answer; join at render time |

## E. Packages

| # | Sev | Issue | Evidence | Fix |
|---|-----|-------|----------|-----|
| E1 | 🔴 | A ₹299 package has `discountPrice: 1` — students are charged **₹1** | pkg_1787218557394 | Confirm intentional; the server now validates paid ≥ this value, so it is live |
| E2 | 🟡 | All three packages grant `totalTests: 500` | likely unintended | Confirm |
| E3 | 🟡 | `exam` display name duplicates `examId` — the same dual-representation trap that caused A1 | all 3 | Treat `examId` as truth, `exam` as a cached label |

## F. Cross-cutting

| # | Sev | Issue | Fix |
|---|-----|-------|-----|
| F1 | 🟠 | No write path validates shape. Every collection is written by client `setDoc(..., {merge:true})` with whatever object the caller built. | One normaliser per entity, used by every writer |
| F2 | 🟡 | All timestamps are ISO **strings**, not Firestore `Timestamp` — can't be range-queried or ordered server-side, so every list is sorted in JS after a full read | Migrate to `Timestamp`, or accept and document it |

---

## Repair order

Each step gets a dry-run script (`--commit` to apply), like
`scripts/seedSubjectCodes.js`. Re-run `auditDb.js` after each to verify.

1. **A1 + A2** — unblocks 4 paying students. Highest value, smallest change.
2. **A3–A5** — delete the plaintext password, fix the orphans.
3. **E1/E2** — confirm ₹1 and 500 tests are intentional before more sales.
4. **B1** — decide the batch strategy. Blocks nothing until you add a second
   board's worth of questions, then it blocks everything.
5. **C1/C2** — make shortfalls visible; stop shipping short papers silently.
6. **B3–B7, C3, C4, D1–D3** — normalisation, safe to batch together.

## Prevention — stop bad data entering again

The reason all of the above accumulated is that **there is no single place a
question, exam or purchase is validated before it is written.** Four different
paths write questions (admin form, CSV import, two seed scripts) and each
invents its own shape and its own defaults.

1. **One normaliser per entity.** `src/domain/question.js` exporting
   `normalizeQuestion(raw, refData) → { ok, value, errors[] }`. Every writer
   calls it — admin form, CSV import, seed scripts, migrations. No exceptions.
2. **Reject loudly, never default silently.** Today an unresolvable subject
   becomes `OTHER` and an empty batch cell becomes `'Police Bharti'`
   (csvParserService.js:15). Both should be errors surfaced in the import
   preview, with a row-by-row report before anything is written.
3. **Validate against live reference data**, not hardcoded arrays — the subject
   codes and batches now in Firestore. An unknown code is a rejected row.
4. **One representation per fact.** Drop `batch`, `correctOption`,
   `options_mr`, and the `exam` display duplication. Two fields for one fact
   is how A1 happened.
5. **Shape checks in `firestore.rules`.** Rules can assert types and required
   fields on write — a cheap last line of defence that applies to every client.
6. **`auditDb.js` in CI**, or run before each release. It already flags
   dangling ids, mixed types, quota drift and blueprint shortfalls; a health
   check nobody runs is not a health check.
