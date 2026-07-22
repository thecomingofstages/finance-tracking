# TCOS Finance Tracking — API

Design docs: [`../docs/backend/`](../docs/backend/README.md) (implementation reference) ·
[`../docs/frontend/api-reference.md`](../docs/frontend/api-reference.md) (FE contract) ·
[`swagger.yaml`](swagger.yaml) (OpenAPI 3.1, hand-maintained — keep it in step with doc 03).

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Boots on `http://localhost:4000` with **no database required** — `MOCK_MODE=true` (the default)
serves every one of the 58 documented endpoints with realistic fixture data from
`src/mocks/fixtures.js`. Auth is real: `/auth/login` issues a genuinely signed, genuinely
verified JWT (an ephemeral RSA keypair is generated on boot in mock mode — see
`src/app/config/app.keys.js`), so the whole session lifecycle (401s, refresh, step-up reauth)
works exactly like production, just without a real `staff` table behind it yet.

```bash
curl -s http://localhost:4000/v1/health
curl -s -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" -d '{"email":"golf@tcos.app","password":"anything"}'
```

## Status

This is a **scaffold + working mock server**, not the real implementation:

- **Real**: app structure, routing, auth/JWT/step-up, all 12 Sequelize models (matching the
  actual shipped schema in `supabase/migrations/20260101000000_init.sql` exactly), request
  validation shape, error envelope, file upload handling.
- **Mocked**: every helper method returns fixture data instead of querying Postgres. Each one
  has a `// TODO: real implementation —` comment describing what it should do instead, usually
  copied near-verbatim from the matching flow in `docs/backend/03-api-spec.md`.
- **Deferred entirely**: Puppeteer/Handlebars PDF rendering (returns a placeholder PDF instead —
  see `src/app/utils/PDF.util.js`), real XLSX export (returns CSV — see `Report.helper.js`),
  Jest test suite, `eslint.config.js`.

Flip `MOCK_MODE=false` in `.env` once a domain's helpers are wired to real models — nothing else
needs to change, since controllers/routes don't know which mode they're in.

### Mock-only debugging helpers (remove when MOCK_MODE goes away)

- `?mock_status=waiting|head_approve|fin_approve|transfer|rejected` on the reimbursement detail
  routes — simulates "what if this record were currently in state X," since there's no real DB
  holding state between calls yet.
- `?as_head=true` on `POST /reimbursements` — simulates the requester being head of the target
  department, to exercise the auto-verify path from doc 04 §4.

## FE client

```bash
npm run gen:client
```

Runs `openapi-typescript` against `swagger.yaml` and writes
[`../web/src/lib/api/types.gen.ts`](../web/src/lib/api/types.gen.ts) — full request/response
types for every endpoint, regenerated straight from the spec. Don't hand-edit that file.
[`../web/src/lib/api/client.ts`](../web/src/lib/api/client.ts) is the hand-written
[`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) wrapper FE actually imports; it doesn't
change when routes do. Regenerate after every `swagger.yaml` change — nothing currently enforces
this in CI, so treat "did you run `npm run gen:client`" as part of the PR checklist for any route
change until that's automated.

## Known gaps carried over from the schema

See [`docs/backend/02-database.md` §6](../docs/backend/02-database.md#6-gaps-between-the-2026-07-20-decisions-and-the-shipped-migration)
— no rollup triggers exist yet, so real (non-mock) `Payment.helper.js` and
`Reimbursement.helper.js`/`Approval.helper.js` implementations must maintain
`actual_amount`/`total_income`/`total_expense` explicitly inside their own transactions.
