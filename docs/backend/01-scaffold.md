# 01 — Repo Scaffold

[← Index](README.md)

## Target layout

```
finance-tracking/
├── package.json                     — workspace root, pins the Supabase CLI
├── supabase/
│   ├── config.toml
│   ├── seed.sql          — still a placeholder (`select now()`), no fixtures yet
│   └── migrations/
│       └── 20260101000000_init.sql   — SHIPPED (ขัตมอส, 2026-07-22). Everything in one file:
│                                        extensions, uuid_generate_v7(), all 5 enums, all 12
│                                        tables, indexes, updated_at triggers, the
│                                        latest_status sync trigger. See doc 02 for the full
│                                        content and doc 02 §6 for what it's still missing —
│                                        rollup triggers, a total_amount cache, several unique
│                                        constraints. Follow-up migrations (numbered after this
│                                        one) are where those land, whenever they're written —
│                                        none exist yet, and per team decision (2026-07-22)
│                                        this repo isn't the place to draft them speculatively.
│
├── web/                          — Next.js on Cloudflare Workers (frontend team)
│
└── api/
    ├── package.json
    ├── .env.example
    ├── swagger.yaml                 — OpenAPI 3.1, hand-maintained
    ├── src/
    │   ├── index.js        — bootstrap: config → db → middleware → routers → listen
    │   ├── app/
    │   │   ├── config/
    │   │   │   ├── app.conf.js  — port,cors origins,log level,pdf options,base url
    │   │   │   ├── app.keys.js     — JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, HMAC_SECRET,
    │   │   │   │                      SERVICE_TOKEN (enroll/merch ingress)
    │   │   │   ├── db.conf.js      — host, port, database, pool { min, max, idle }
    │   │   │   ├── db.keys.js      — DB_PASSWORD, SUPABASE_SERVICE_ROLE_KEY
    │   │   │   ├── r2.conf.js      — R2_ENDPOINT, bucket names, region="auto"
    │   │   │   ├── r2.keys.js      — R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
    │   │   │   └── init.js    — loads dotenv, validates with zod, throws onmissing
    │   │   ├── database/
    │   │   │   ├── Postgres.database.js — Sequelize instance,singleton, sync:false
    │   │   │   └── init.js     — connect(), registerModels(), associate(), close()
    │   │   ├── models/      — one Sequelize model class per table
    │   │   │   ├── index.js    — imports all, wires associations, exports registry
    │   │   │   ├── Project.model.js
    │   │   │   ├── ProjectTag.model.js
    │   │   │   ├── Department.model.js
    │   │   │   ├── Staff.model.js
    │   │   │   ├── BankAccount.model.js
    │   │   │   ├── StaffDept.model.js
    │   │   │   ├── Source.model.js
    │   │   │   ├── Payment.model.js
    │   │   │   ├── PaymentStatus.model.js
    │   │   │   ├── Reimbursement.model.js
    │   │   │   ├── ReimbursementDetail.model.js
    │   │   │   └── ReimbursementStatus.model.js
    │   │   ├── helpers/             — business logic, one class per domain
    │   │   │   ├── Auth.helper.js
    │   │   │   ├── Staff.helper.js
    │   │   │   ├── Project.helper.js
    │   │   │   ├── Source.helper.js
    │   │   │   ├── Payment.helper.js
    │   │   │   ├── Reimbursement.helper.js
    │   │   │   ├── Approval.helper.js     — the state machine (doc 04)
    │   │   │   ├── Report.helper.js       — summary / cashflow / journal / ledger
    │   │   │   └── Document.helper.js     — ใบเบิกเงิน + ใบสำคัญจ่าย rendering
    │   │   ├── controllers/         — thin HTTP layer, one class per domain
    │   │   │   ├── Auth.controller.js         Staff.controller.js
    │   │   │   ├── Project.controller.js      Source.controller.js
    │   │   │   ├── Payment.controller.js      Reimbursement.controller.js
    │   │   │   ├── Report.controller.js       Document.controller.js
    │   │   ├── routes/              — Express routers, one file per domain
    │   │   │   ├── Auth.routes.js             Staff.routes.js
    │   │   │   ├── Project.routes.js          Source.routes.js
    │   │   │   ├── Payment.routes.js          Reimbursement.routes.js
    │   │   │   ├── Report.routes.js
    │   │   │   └── init.js             — mounts every router under /v1
    │   │   ├── middleware/
    │   │   │   ├── Auth.middleware.js    — verifyJWT, resolveScope, requireRole
    │   │   │   ├── ServiceAuth.middleware.js  — X-Service-Token for enroll/merch
    │   │   │   ├── Validate.middleware.js     — zod schema per route
    │   │   │   ├── Upload.middleware.js       — multer memory, 10MB, pdf/png/jpg
    │   │   │   ├── Transaction.middleware.js —opens a Sequelize tx,binds to req.tx
    │   │   │   ├── RateLimit.middleware.js
    │   │   │   ├── ErrorHandler.middleware.js —ApiError →envelope;unknown→500+log
    │   │   │   └── init.js
    │   │   └── utils/
    │   │       ├── JWT.util.js       — sign/verify RS256, access + refresh
    │   │       ├── Logger.util.js    — pino, request id correlation
    │   │       ├── QR.util.js     — generate verification QR (reimburse deep link)
    │   │       ├── R2.util.js   — Cloudflare R2 client,upload/delete/presign
    │   │       ├── PDF.util.js       — puppeteer browser pool, html → A4 pdf
    │   │       ├── CSV.util.js       — Google Form export parser
    │   │       ├── Money.util.js     — satang↔baht, Thai baht text (บาทถ้วน)
    │   │       ├── ApiError.util.js  — { code, status, message, field }
    │   │       └── Response.util.js  — ok() / fail() envelope builders
    │   └── templates/
    │       ├── reimbursement-request.hbs      — ใบเบิกเงิน
    │       ├── payment-voucher.hbs            — ใบสำคัญจ่าย
    │       └── journal.hbs                    — สมุดรายวัน
    └── tests/
        ├── helpers/app.js — buildApp(): same Express app minus DB connect + listen
        ├── helpers/factories.js     — fixture builders per model
        ├── helpers/db.js            — transaction-per-test rollback harness
        ├── auth.test.js             staff.test.js         project.test.js
        ├── source.test.js           payment.test.js       reimbursement.test.js
        ├── approval.test.js         report.test.js        document.test.js
```

## Layer responsibilities

Strict, one-directional. A layer may only call the layer directly beneath it.

```
routes → controllers → helpers → models → database
```

| Layer | Does | Never does |
| --- | --- | --- |
| `routes/` | Path + verb, attaches middleware chain, points at one controller method | Contain logic |
| `controllers/` | Reads `req`, calls **one** helper, wraps the result in the envelope | Touch models, build SQL, know business rules |
| `helpers/` | All business rules, transactions, cross-model orchestration. Throws `ApiError` | Know about `req`/`res`, set status codes |
| `models/` | Sequelize class per table: columns, associations, scopes, instance methods | Contain business rules, call other helpers |
| `database/` | Postgres connection lifecycle, pool | Know about domains |
| `middleware/` | Cross-cutting: auth, validation, upload, tx, errors | Contain domain logic |
| `utils/` | Pure-ish, self-contained clients and helpers (JWT, R2, PDF, QR…) | Import models or helpers |

**Why controllers stay thin:** they are the layer we cannot unit-test cheaply. Every rule
living in a helper is a rule testable without HTTP.

## Model class shape

Sequelize v6 class style — one class per table, matching the `PascalCase.model.js` convention.
Updated 2026-07-22 to match the shipped schema — table is `reimbursement` (singular), the status
column is `latest_status`, there's no `total_amount` cache yet, and `tag_id` is nullable:

```js
// src/app/models/Reimbursement.model.js
const { Model, DataTypes } = require("sequelize");
const { REIMBURSEMENT_STATUSES } = require("../utils/enums.util");

class Reimbursement extends Model {
  static initModel(sequelize) {
    Reimbursement.init(
      {
        _id:            { type: DataTypes.UUID, primaryKey: true,
                          defaultValue: sequelize.literal("uuid_generate_v7()") },
        staff_dept_id:  { type: DataTypes.UUID, allowNull: false },
        tag_id:         { type: DataTypes.UUID, allowNull: true },   // optional, as shipped
        purpose:        { type: DataTypes.TEXT, allowNull: false },
        tracking_id:    { type: DataTypes.TEXT },
        banking_id:     { type: DataTypes.UUID },      // null → prefers cash
        receipt_link:   { type: DataTypes.TEXT },
        latest_status:  { type: DataTypes.ENUM(...REIMBURSEMENT_STATUSES),  // trigger-synced
                          allowNull: false, defaultValue: "waiting" },
        // No total_amount column — not shipped yet (doc 02 §6, gap #2). Compute via the
        // `totalAmount` getter below until a cached column exists.
      },
      {
        sequelize,
        modelName:  "Reimbursement",
        tableName:  "reimbursement",   // singular, matches the shipped table name exactly
        underscored: true,
        paranoid:   true,            // soft delete via deleted_at
        deletedAt:  "deleted_at",
        createdAt:  "created_at",
        updatedAt:  "updated_at",    // trigger-touched, see doc 02
      }
    );
    return Reimbursement;
  }

  static associate({ StaffDept, ProjectTag, BankAccount,
                     ReimbursementDetail, ReimbursementStatus }) {
    Reimbursement.belongsTo(StaffDept,   { foreignKey: "staff_dept_id", as: "staffDept" });
    Reimbursement.belongsTo(ProjectTag,  { foreignKey: "tag_id",        as: "tag" });
    Reimbursement.belongsTo(BankAccount, { foreignKey: "banking_id",    as: "bankAccount" });
    Reimbursement.hasMany(ReimbursementDetail, { foreignKey: "reimbursement_id", as: "details" });
    Reimbursement.hasMany(ReimbursementStatus, { foreignKey: "reimbursement_id", as: "history" });
  }

  /** No cached column for this yet (doc 02 §6, gap #2) — sum on demand until one exists.
   *  Requires `details` to be eager-loaded; don't call this from a list endpoint. */
  get totalAmount() {
    return (this.details ?? []).reduce((sum, d) => sum + Number(d.amount), 0);
  }

  // No currentStatus getter — latest_status is a real, trigger-synced column
  // (trg_sync_reimbursement_latest_status, see doc 02). Read it straight off the row.
}

module.exports = Reimbursement;
```

`REIMBURSEMENT_STATUSES = ['waiting', 'head_approve', 'fin_approve', 'transfer', 'rejected',
'delete']` — a shared constant mirroring the real `reimbursement_available_status` Postgres enum,
defined once and imported by both the model and `Approval.helper.js`, so the two never drift
apart.

**Every model needs an explicit `tableName`.** Sequelize's default naming convention pluralizes
and snake-cases the model name (`Reimbursement` → `reimbursements`) — the shipped schema is
singular (`reimbursement`) and inconsistent about it (`project_tag`, `staff_dept`, `bankaccount`
keep compound/irregular names). Relying on Sequelize's default here silently points every model
at a table that doesn't exist. Set `tableName` on all twelve models explicitly; consider a
sprint-0 CI check that fails if a model's resolved table isn't in the actual schema.

`models/index.js` calls every `initModel(sequelize)` then every `associate(registry)` in two
passes, so circular references resolve cleanly.

**Sequelize is configured with `sync: false` and never runs `sync()`.** The Supabase CLI owns
the schema. Model definitions that drift from the migrations are a bug caught in sprint-0 CI by
a schema-diff check.

**Money columns map to `DataTypes.INTEGER`, not `DataTypes.BIGINT`.** This is a side effect worth
knowing about: `pg` returns `BIGINT` as a JS string (it doesn't fit safely in a JS number), which
would have meant every money field needed `parseInt()` at the boundary. `int4` → `INTEGER` stays
a native JS number straight out of the driver.

## Dependencies to add

```jsonc
// api/package.json — dependencies
{
  "express":              "^4.19",
  "sequelize":            "^6.37",   // ORM, class-per-model
  "pg":                   "^8.12",   // Postgres driver
  "pg-hstore":            "^2.3",
  "@supabase/supabase-js":"^2.45",   // Supabase Auth session verification only — not DB, not storage
  "@aws-sdk/client-s3":            "^3.6", // R2 is S3-compatible; upload/delete/head
  "@aws-sdk/s3-request-presigner": "^3.6", // presigned GET URLs for receipts/signatures
  "jsonwebtoken":         "^9.0",
  "bcrypt":               "^5.1",    // cost 12, same as Enroll
  "uuid":                 "^10.0",   // v7 generation API-side
  "zod":                  "^3.23",   // request validation
  "multer":               "^1.4",    // memory storage
  "puppeteer":            "^23.0",   // PDF
  "handlebars":           "^4.7",    // PDF templates
  "qrcode":               "^1.5",
  "papaparse":            "^5.4",    // CSV import
  "pino":                 "^9.0",
  "pino-http":            "^10.0",
  "cors":                 "^2.8",
  "helmet":               "^7.1",
  "cookie-parser":        "^1.4",
  "express-rate-limit":   "^7.4"
}
// devDependencies
{ "jest": "^29", "supertest": "^7", "eslint": "^9", "prettier": "^3" }
```

Dropped from the current `api/package.json`: `morgan` (replaced by `pino-http`), `debug`,
and the Jade/`public/` scaffolding.

**`@supabase/supabase-js` is scoped down, not removed.** Storage moved to R2 (confirmed
2026-07-22), so the only remaining use is server-side verification of a Supabase Auth session
during `POST /auth/claim` and `POST /auth/login/supabase` ([doc 03 §4](03-api-spec.md#4-domain-authentication--auth)).
It never touches Postgres (Sequelize/`pg` own that) and never touches file storage (R2 owns
that) — worth a comment at the import site so nobody reaches for `supabase.storage.*` out of
habit.

## Testing approach

Two tiers, both runnable in CI without Docker for tier 1:

1. **Unit / route tests** — `buildApp()` returns the same Express app minus DB connect and
   `listen()`. Models are replaced with `jest.mock()`, exactly as in Enroll. Fast, covers
   controllers, validation, authorization, and error mapping.
2. **Integration tests** — run against a real local Supabase (`npm run supabase:reset`), one
   transaction per test rolled back at teardown. Required for anything touching triggers: the
   `updated_at` touch triggers and `trg_sync_reimbursement_latest_status`, both real as of
   2026-07-22. The rollup logic (`actual_amount`, `total_income`/`total_expense`) has **no
   trigger yet** ([doc 02 §6](02-database.md#6-gaps-between-the-2026-07-20-decisions-and-the-shipped-migration))
   — until it does, that logic lives in `Payment.helper.js`/`Approval.helper.js` and needs the
   same real-Postgres integration coverage a trigger would have needed, just via a helper unit
   test with a real transaction instead.

Coverage gates worth enforcing: `helpers/` ≥ 85%, `Approval.helper.js` 100% branch (every
state transition, valid and invalid).
