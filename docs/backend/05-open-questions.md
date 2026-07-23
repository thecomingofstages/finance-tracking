# 05 — Open Questions

[← Index](README.md)

Ranked by how much rework a late answer causes. Each has a proposed default so we are never
blocked on a non-response — but the starred ones need a real decision.

> **Separate from this list:** [doc 02 §6](02-database.md#6-gaps-between-the-2026-07-20-decisions-and-the-shipped-migration)
> tracks gaps between what the team decided and what actually shipped in
> `supabase/migrations/20260101000000_init.sql` (missing rollup triggers, missing unique
> constraints, case-sensitive email, and so on) — found 2026-07-22. Those aren't open
> *questions*, they're known follow-up work items; kept in doc 02 since they're schema-specific.

| #   | Question                                  | Owner        | Needed by    | Cost if late                      |
| --- | ----------------------------------------- | ------------ | ------------ | --------------------------------- |
| 1 ★ | Ledger & financial statements — in scope? | Finance      | **Sprint 0** | Weeks                             |
| 2   | ~~Money unit + integer width~~            | —            | —            | **Resolved** — see below          |
| 3   | Who owns `tracking_id` numbering          | Finance      | Sprint 0     | One trigger                       |
| 4   | ~~Auth: own JWT vs Supabase Auth~~        | —            | —            | **Resolved** — see below          |
| 5   | ~~`source` has no `project_id`~~          | —            | —            | **Resolved** — shipped, see below |
| 6   | `staff_dept_id` orphaning on departure    |              | Sprint 0     | One migration                     |
| 7 ★ | Enroll / Merch integration contract       |              | Sprint 3     | Blocks sprint 3                   |
| 8   | Receipt storage limits & retention        | Finance + IT | Sprint 4     | Config                            |
| 9   | Slip amount-mismatch policy               | Finance      | Sprint 3     | Small logic change                |
| 10  | ~~Reimbursement status enum values~~      | —            | —            | **Resolved** — see below          |
| 11  | ~~Self-approval: hard block or flag~~     | —            | —            | **Resolved** — see below          |
| 12  | Budget change audit trail                 | Finance      | Sprint 2     | One table                         |
| 13  | Digital signature approach                | Finance + IT | Sprint 5     | Template scope reduced, see below |
| 14  | Notifications on approval steps           | Finance      | Sprint 4     | New integration                   |

---

## 1. Ledger and financial statements are not reachable from this schema ★

The requirement PDF asks for five accounting artefacts. The designed schema supports two.

| Artefact                      | Status                                                  |
| ----------------------------- | ------------------------------------------------------- |
| สมุดรายวัน (Journal)          | ✅ derivable — `SOURCES` + `REIMBURSEMENT_DETAILS` UNION |
| ใบเบิกเงิน / ใบสำคัญจ่าย      | ✅ rendered from `REIMBURSEMENTS`                        |
| บัญชีแยกประเภท (Ledger)       | ❌ needs a chart of accounts                             |
| งบกำไรขาดทุน (P&L)            | ❌ needs revenue/expense account classification          |
| งบฐานะการเงิน (Balance sheet) | ❌ needs assets, liabilities, equity — double-entry      |

A ledger groups transactions by **account** (เงินสด, ลูกหนี้, ค่าน้ำ, ค่าไฟ…). We have no
`ACCOUNTS` table and no debit/credit sides. The balance-sheet sample in the requirement PDF shows
ลูกหนี้, เจ้าหนี้การค้า, ค่าใช้จ่ายค้างจ่าย, เบี้ยประกันจ่ายล่วงหน้า, ทุน, กำไรสะสม — none of
which exist anywhere in this data model, and none of which are derivable from reimbursements and
payment slips.

The dashboard requirement also mentions **หนี้สิน (liabilities)** and **เงินทุน / ส่วนของ
sponsor (capital & sponsor equity)**. Sponsor income we have; liabilities and capital we do not.

**Three options:**

| Option | Scope | Recommendation |
| --- | --- | --- |
| **A** — Journal + cash flow only | As designed. Drop ledger, P&L, balance sheet from v1 | ✅ **Recommended for v1** |
| **B** — Add a chart of accounts | New `ACCOUNTS` table; every source and reimbursement detail maps to an account code. Gets Ledger and a cash-basis P&L. No balance sheet | Reasonable v1.5 |
| **C** — Full double-entry | `ACCOUNTS` + `JOURNAL_ENTRIES` + `JOURNAL_LINES` with balanced debits/credits. Gets everything | Real accounting-system scope. Not this timeline |

**Recommendation: ship A, design the schema so B is additive.** Keeping
`REIMBURSEMENT_DETAILS.title` as free text now and adding a nullable `account_code` later is a
non-breaking change. Committing to C now roughly doubles the backend.

**This needs a Finance conversation in week 1.** If they expect a งบฐานะการเงิน out of this
system, that has to surface before we build, not at demo.

---

## 2. Money unit: baht or satang — RESOLVED

Decided 2026-07-20 in `#IT` (ขัตมอส #CTO, ชมพู่ #IT): **`int4`, unit satang.** This settles two
things the Development Plan left ambiguous at once — the plan said `int8` but didn't fix the
unit; the team's own review flagged `int8` as unnecessary headroom and moved to `int4` while
settling satang in the same conversation.

- **Satang**, not baht: integer arithmetic, no float error, exact rollups. Format at the API
  boundary and in PDF templates only — `Money.util.js` owns every conversion.
- **`int4`**, not `int8`: caps a single column at ±21,474,836.47 บาท. Comfortably above any
  individual project's budget at TCOS's current scale. The real exposure is the
  **project-level rollups** (`project.total_income` / `total_expense`), which accumulate across a
  project's entire lifetime — worth a `CHECK` constraint or a monitoring alert well before a
  project's totals approach the ceiling, since overflow surfaces as a raw
  `integer out of range` error from the triggered `UPDATE`, not a handled one.

Applied throughout [doc 02](02-database.md) — every money column, the ER diagram, and the trigger
function bodies.

---

## 3. Who owns `tracking_id` numbering

The Development Plan: *"if Finance lets us run the number, then make sure to create a trigger for
that."*

- **Finance numbers manually** → `tracking_id` is a required field on finance approval,
  uniquely indexed, no trigger.
- **We number** → per-project sequence, format to agree (`TCOS3-0042`? year-prefixed? reset
  annually?), assigned in `trg_tracking_id`.

**Default if unanswered:** Finance-supplied, validated unique. Adding generation later is
additive; removing it is not.

---

## 4. Auth: own JWT vs Supabase Auth — RESOLVED

The API text (`IT - 12 _ Development Plan.txt`) settles this — it isn't a choice between the two,
it's both, in specific roles:

1. **Bootstrap.** Admin imports staff into Supabase by email only — no password yet.
2. **First-time login.** Staff authenticates via Supabase Auth's email flow. We verify that
   session, confirm the email exists in `staff`, let them set a password, bcrypt-hash it
   (cost 12, matching Enroll) into `staff.password_hash`. → `POST /auth/claim`.
3. **Regular login.** Either email+password against our own hash (→ our JWT), *or* a fresh
   Supabase Auth session exchanged directly for our JWT, skipping the password check since
   Supabase already vouched for them. Both paths must keep working — the plan lists them as
   parallel, not primary/fallback. → `POST /auth/login`, `POST /auth/login/supabase`.
4. **Step-up.** A third, distinct check — *"Verify the identity: inputs only the password (and
   checks from JWT)"* — gates reimbursement status changes and payment approval specifically.
   This is neither login flow; it's a reauth of an already-valid session.
   → `POST /auth/verify-password`. See [doc 04 §9](04-authorization.md#9-step-up-verification).

So: **our own RS256 JWT is still the only thing our routes check** — the scope model in
[doc 04](04-authorization.md) is unaffected. Supabase Auth's role is narrower than "the auth
system": it authenticates the *first* contact and offers an alternate login, and our system takes
over immediately after. Full design in [doc 03 §4](03-api-spec.md#4-domain-authentication--auth).

---

## ~~5. `source` has no `project_id`~~ — RESOLVED

Shipped in `supabase/migrations/20260101000000_init.sql`, and resolved cleaner than what this
document recommended: instead of adding `project_id` *alongside* a still-required `tag_id`, the
real schema made **`tag_id` optional** and **`project_id` the required anchor**. A source no
longer needs a tag to exist — untagged income (the exact gap this question raised) is now
representable, and "all sources for project X" is a direct indexed filter. Full detail in
[doc 02](02-database.md).

---

## 6. `staff_dept_id` orphaning

`REIMBURSEMENTS.staff_dept_id` points at a `STAFF_DEPT` row that gets `deleted_at` when someone
leaves. Historical reimbursements then reference a soft-deleted relation. The Development Plan
raises this itself: *"Or staff_id and department_id?"*

**Recommendation:** keep `staff_dept_id` — it captures "who, wearing which hat" in one column,
which is exactly what ใบเบิกเงิน prints — but:
- Never filter `staff_dept.deleted_at` when joining *from* a reimbursement.
- Add a `paranoid: false` Sequelize scope, `StaffDept.scope('withDeleted')`, and use it in
  `Reimbursement.helper.js`.
- Test explicitly: a reimbursement from someone who has since left the department must still
  render its document correctly.

---

## 7. Enroll / Merch integration contract is unwritten ★

`PAYMENTS._id` is the *external* `registration_id` / `purchase_id`. That means:

- Enroll and Merch must guarantee globally non-colliding UUIDv7s. Both use v7, so collision risk
  is negligible — but this must be stated, not assumed.
- Somebody must decide **push vs pull**. Recommendation: Enroll pushes to `POST /payments` on
  registration creation, with retries; our endpoint is idempotent on PK.
- Finance must create the `SOURCES` row (with `reference_id` = `activity_id`) *before* the first
  registration, or ingestion 404s. Needs an operational runbook, or an auto-create fallback.
- What happens when Enroll cancels a registration after we've approved the slip? Currently:
  nothing. Probably wrong.
- Who owns the service token, and how is it rotated?


---

## 8. Receipt storage limits and retention

Storage is **Cloudflare R2** (confirmed 2026-07-22), not Supabase Storage — applied throughout
[doc 01](01-scaffold.md) and [doc 03](03-api-spec.md). Doesn't resolve the questions below, just
the vendor:

- Expected volume? (reimbursements per project × receipt size) — sizes the bucket. R2's egress
  is free either way, which is one less reason to worry about download volume specifically.
- Retention: do receipts get deleted after the project closes, or kept for tax purposes? Thai
  tax record-keeping is typically 5 years — likely keep.
- The Development Plan asks about downscaling PDFs. Recommendation: cap at 10 MB upload,
  recompress over 2 MB, downscale images over 2000px long edge.
- Presigned URL TTL: recommend 5 minutes, generated per view via `R2.util.js`.

---

## 9. Slip amount-mismatch policy

When Finance reads a QR and the amount differs from `expected_amount`:

- **(a)** Hard-reject with `422 AMOUNT_MISMATCH` — participant resubmits.
- ==**(b)** Accept, record the real amount, flag for review — `actual_amount` reflects reality.== Flag as rejected, having problems.

Real underpayment happens (transfer fees, typos), and (b) keeps the books honest while surfacing
the discrepancy. But it's Finance's call, not ours. The route supports both; pick one.

**Default if unanswered:** (b), with the mismatch flagged in the `/checkslip` list.

---

## 10. Reimbursement status enum values — RESOLVED (shipped, not what was proposed)

`reimbursement_available_status` is real as of `supabase/migrations/20260101000000_init.sql`
(ขัตมอส, 2026-07-22) — this is no longer a question, it's documenting what exists. **It's not
what this document proposed**: 6 values, not 7, and **no separate draft state**:

```
waiting · head_approve · fin_approve · transfer · rejected · delete
```

A reimbursement is created straight into `waiting`; there's no "still editing, not submitted"
stage before it enters the approval queue. Every flow in [doc 03](03-api-spec.md) and the full
transition table in [doc 04](04-authorization.md#4-reimbursement-state-machine) are updated to
match. Worth a quick confirm with Finance on the one thing this doesn't answer: whether they're
fine with a reimbursement being visible to the head the instant it's created (no private
editing window), since the old draft-stage design existed specifically to give the requester one.

---

## 11. Self-approval: hard block or flag? — RESOLVED

The API text answers this directly: *"When the head makes the reimbursement, automatically verify
(as a head of the department) upon submit."* Not a block, not an escalation, not a flag — **an
auto-pass**. When a head files their own request, the head-approval step self-satisfies the
instant the reimbursement is created (`waiting → head_approve` fires immediately, in the real
6-state enum — see [open question 10](#10-reimbursement-status-enum-values--resolved-shipped-not-what-was-proposed)),
and the workflow proceeds straight to awaiting finance.

This resolves the "small department has no other head" deadlock concern by design — there was
never a second person expected at that specific step. It does **not** extend past the head
level: finance approval and the owner's transfer still each need a different, independent person.
Full transition table in [doc 04](04-authorization.md#4-reimbursement-state-machine).

---

## ~~12. Budget change audit trail~~

`allocated_budget` on project, tag, and department is mutable with no history. "Who raised
ฝ่ายเวที's budget by ฿50,000, and when?" is currently unanswerable.

**Recommendation:** small append-only `budget_changes` table (`entity_type`, `entity_id`,
`old_amount`, `new_amount`, `staff_id`, `reason`, `created_at`), written by trigger. Cheap, and
it's the kind of question that only gets asked after something has gone wrong.

---

## 13. Digital signature approach

The API text is more concrete than the docx: it separately lists *"Upload Digital signature —
verify the identity first, store the image in your desired bucket"* as its own endpoint
(`POST /staff/me/signature`, step-up gated — see [doc 03 §5](03-api-spec.md#5-domain-staff--staff)),
plus a template repo,
[`thecomingofstages/finance-pdfgenerator`](https://github.com/thecomingofstages/finance-pdfgenerator),
already built for ใบเบิกเงิน. That repo may already have made this call — check it in sprint 0
before re-deciding here.

Options, in ascending cost, if the repo doesn't already settle it:

1. ==**Image signature** — `STAFF.signature_image` inlined into the PDF. Not tamper-proof, but==
   ==matches current paper practice and is what the plan's endpoint literally describes. Combined==
   ==with the verification QR (which resolves to the live record), adequate for internal use.==
2. **HMAC verification stamp** — a signed hash printed on the document; the QR page shows the
   approval chain from the database. Detects tampering with the *printed* copy.
3. **Real PKI / PAdES** — certificate-based, legally recognised. Significant scope, needs a CA.

**Recommendation: 1 + 2 for v1** — matches what the plan actually specced (an uploaded image, not
a certificate). The QR already links to `/reimburse/<id>`, so the database is the source of truth
and the paper is a rendering of it.

---

## 14. Notifications

Nothing in the plan covers telling someone their approval is waiting. Without it, reimbursements
stall in `waiting` until someone remembers to look.

Options: ==in-app only== (no backend work beyond a badge count), email (needs a transactional
provider), or LINE Notify (`STAFF.line_id` is already collected — and it is where TCOS staff
actually are).

Worth asking Finance whether this is v1 or v2. If v1, it adds an integration and a queue.
