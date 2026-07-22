# Finance Tracking — Backend Plan

Last updated: 2026-07-22

Planning documents for the TCOS Finance Tracking backend. Nothing here is implemented yet —
this is the design we agree on *before* writing code.

## Source documents

| Document                          | What it gives us                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `IT - 12 _ Development Plan.docx` | Objective, page list, **table-by-table DB design**, API wishlist                      |
| `website requirement (1).pdf`     | Finance's own requirements (Thai) + samples of the accounting documents               |


## Index

| # | Document | Contents |
| --- | --- | --- |
| 01 | [Repo scaffold](01-scaffold.md) | Directory layout, layer responsibilities, dependencies |
| 02 | [Database](02-database.md) | Mermaid ER diagram, SQL DDL, triggers, indexes, Sequelize mapping |
| 03 | [API spec](03-api-spec.md) | Route table, conventions, worked endpoint examples, error codes |
| 04 | [Authorization](04-authorization.md) | Scope model, reimbursement state machine, RLS posture |
| 05 | [Open questions](05-open-questions.md) | Decisions blocking implementation, ranked by rework cost |

---

## Stack decisions

| Concern          | Decision                                                                                                                                             | Rationale                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database         | **PostgreSQL via Supabase**                                                                                                                          | Development Plan states it outright; repo already has `supabase/config.toml` + migrations dir. The design leans on Postgres-only features (enums, triggers, FK cascades, RLS) |
| ORM              | **Sequelize v6**, class-per-model                                                                                                                    | `api/` is plain JS; `class X extends Model` maps 1:1 onto our `PascalCase.model.js` convention with no TypeScript migration. See note below                                   |
| Schema ownership | **Supabase CLI SQL migrations**                                                                                                                      | Enums, triggers and RLS are SQL-native. Sequelize runs with `sync: false` and only *maps* the schema — it never defines it                                                    |
| Primary keys     | **UUIDv7**, `uuid_generate_v7()` as column default                                                                                                   | Time-sorted, index-friendly, consistent with Enroll. API may also generate client-side and pass in                                                                            |
| Auth             | **Own RS256 JWT** for sessions; **Supabase Auth** for first-time claim + alternate login; a step-up reauth endpoint gates money-moving actions       | Specified directly in the plan's API section, not a choice — see [open question 4](05-open-questions.md#4-auth-own-jwt-vs-supabase-auth--resolved)                            |
| File storage     | **Cloudflare R2** (S3-compatible), private bucket + presigned URLs                                                                                   | Receipts and signature images. Confirmed 2026-07-22 — matches the original scaffold, which already listed `R2` under `utils/`                                                |
| PDF generation   | **Puppeteer** + Handlebars templates, adapting the existing [`finance-pdfgenerator`](https://github.com/thecomingofstages/finance-pdfgenerator) repo | Recommended in the Development Plan; a starting template already exists for ใบเบิกเงิน                                                                                        |
| API style        | REST, `/v1` prefix, Enroll's response envelope                                                                                                       | One mental model across both TCOS backends                                                                                                                                    |

> **On the ORM choice.** The alternative is TypeORM, which is more idiomatically OO (decorator
> entities, repository pattern) but wants TypeScript. If we migrate `api/` to TS anyway — and
> `web/` is already TS — TypeORM becomes the better pick. This is cheap to revisit *before*
> sprint 1 and expensive after. Decide in sprint 0.

## Conventions inherited from the Enroll backend

Keep these byte-identical so engineers moving between the two repos don't have to re-learn anything:

- Base path `/v1`, HTTPS only, JSON except multipart uploads
- Response envelope: `{ success, data, meta }` / `{ success, error: { code, message, field } }`
- HTTP status semantics: `200` GET/PATCH · `201` POST · `204` DELETE · `400` validation ·
  `401` unauthenticated · `403` wrong role · `404` missing · `409` duplicate · `422` business
  rule · `500` unexpected
- UUIDv7 primary keys everywhere
- Machine-readable `error.code` strings, `error.field` on validation failures
- Hand-maintained `swagger.yaml`

## Scope warning

The requirement PDF asks for four accounting artefacts. Only some are reachable from the
designed schema:

| Artefact | Reachable? |
| --- | --- |
| สมุดรายวัน (Journal) | ✅ derivable from `SOURCES` + `REIMBURSEMENT_DETAILS` |
| ใบเบิกเงิน / ใบสำคัญจ่าย | ✅ rendered from `REIMBURSEMENTS` |
| บัญชีแยกประเภท (Ledger) | ❌ needs a chart of accounts |
| งบกำไรขาดทุน / งบฐานะการเงิน | ❌ needs double-entry bookkeeping |

See [open question #1](05-open-questions.md#1-ledger-and-financial-statements-are-not-reachable-from-this-schema).
This is the single largest scope risk in the project and needs a Finance decision early.
