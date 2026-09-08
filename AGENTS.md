# AGENTS.md

Reference for AI coding agents working in this repository. `/CLAUDE.md` points here.
For human collaborators, see the per-folder READMEs and `docs/`.

---

## Interaction Style

- **Ask before acting.** Confirm scope, approach, and intent before writing code,
  editing files, or running commands. A question is not optional groundwork — it is
  a hard gate. Tasks that *look* obvious are not exempt.
- **Confirm the blast radius first.** If a request is ambiguous about *who* it
  affects (this branch only, a shared branch, the local database, real S3/R2
  buckets, a deployed worker), ask. Do not assume.
- **Never act on a conflicted working tree.** If `git status` shows unstaged
  changes you did not make, stop and surface them before doing anything else.
- **Read the repo before guessing.** Design intent lives in `docs/`
  (`docs/backend/01-scaffold.md` … `05-open-questions.md`,
  `docs/frontend/api-reference.md`), and the running contract lives in
  `api/swagger.yaml`. Read those before changing routes, schemas, or models.
  When the repo is silent, see **Source Preferences** below.

## Source Preferences

- **Tied first-tier sources** (use whichever is more specific to the question):
  1. **This repo's own `docs/` and code** — design intent, the actual contract
     in `api/swagger.yaml`, models in `supabase/migrations/`, behavior in
     `api/src/`, the running config in `wrangler.jsonc` and `package.json`
     files. Read the file at the version actually checked in, not what you
     remember about it.
  2. **Official framework / CLI docs via WebFetch** — the authoritative source
     for any framework or CLI named in the repo, including but not limited to
     Next.js 16, React 19, OpenNext 1.19, Cloudflare Workers + Wrangler,
     Supabase CLI, Sequelize 6, Express 4, Pino, zod, openapi-fetch,
     openapi-typescript. These versions are pinned in this repo and post-date
     much of the training data, so **always verify against the official doc
     before recommending an API, flag, config option, or version.**
- **Proactive fetching:** any time a named framework or CLI shows up in the
  prompt or in a file you're about to change, fetch the relevant official doc
  before answering. Don't wait until you've guessed wrong once.
- **Training data is a fallback only.** If neither the repo nor an official
  doc covers the question, you may answer from training data, but you **must
  say so** in the response — e.g. "Answered from training data; verify against
  the official doc before relying on it." Do not present training-data answers
  with the same confidence as sourced ones.
- **Cite the web sources you used.** When a response draws on WebFetch /
  WebSearch results, end the response with a `Sources:` list of markdown links,
  one per URL consulted. Repo-internal answers don't need citations — the
  file paths are the citations.

## Session Memory

- When you learn something durable about this project — conventions, gotchas,
  working/non-working commands, architectural decisions — add a short bullet to
  **Project-Specific Notes** below. Future sessions run by different agents (or
  different humans) need that context, not the conversation that produced it.
- State facts plainly. No "as I mentioned" or first-person continuity. Bullets,
  not prose.
- Prune entries that are no longer true rather than letting this file grow.
- **Drift rule:** if you change a build command, an env var name, a route path,
  a model, a schema, or a convention documented here, update the matching
  bullet in the same change. Stale memory is worse than no memory — agents
  will follow it.
- If a future session's notes conflict with the current ones, flag the conflict
  in place rather than silently picking a side. A human will resolve it.

## Git Workflow

- At the start of a session, run `git branch --show-current`, `git status`, and
  `git fetch` to see whether the branch is behind remote or has incoming
  teammate changes.
- **Never** switch branches, create branches, or commit to a branch you did not
  create this session without explicit confirmation.
- Before committing, ask whether the target branch is a personal/feature branch
  or a shared one (e.g. `main`, `develop`). The bar for auto-committing on a
  shared branch is higher. The branch name convention is `nickname/feature-implemented`.
- One logical change per commit. Clear, descriptive message. No unrelated
  changes bundled together.
- **Never** push, force-push, merge, or rebase without explicit confirmation.
  These affect collaborators directly.
- If a command needs network or destructive effect (`supabase db reset`,
  `wrangler deploy`, R2 writes against a real bucket, `npm install` on a fresh
  clone), confirm before running.

## Project-Specific Notes

### Repo shape

- Monorepo with four top-level subprojects: **`api/`** (Express + Sequelize
  backend), **`web/`** (Next.js 16 + React 19 on Cloudflare Workers via
  OpenNext), **`supabase/`** (local Supabase stack — Postgres in schema
  `finance`, auth, storage, realtime), **`docs/`** (design + reference prose
  in Thai and English; `docs/exports/` holds the rendered `.docx` snapshots).
- Root `package.json` is orchestration only — `concurrently` runs api+web,
  and the `install:all` / `supabase:*` scripts proxy into the subprojects.
  Do not add real dependencies to the root.
- `.gitignore` already covers `node_modules`, `.next`, `.open-next`, `.env*`,
  `.wrangler`, `.claude/`, `.obsidian/`. Do not commit any of those.

### Quick start (for the agent that needs to boot the stack)

- First time: `npm install` (root, pins the `supabase` CLI), then
  `npm run install:all` to install api/ and web/ deps.
- **Two env files**: `api/.env` (Express server **and** the Supabase CLI's
  `env()` substitutions) and `web/.env` (`NEXT_PUBLIC_*` only). There is
  deliberately no root `.env`. Both are ignored by `.gitignore:34-35`, as are
  their `.env.example` templates — `web/.env.example` is in git only because it
  was force-added (`git add -f`); `api/.env.example` is **not tracked at all**.
- Before the first `supabase start`: fill
  `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` in `api/.env`, or the
  "Continue with Google" button 400s with `provider is not enabled`.
- Start Supabase: `npm run supabase:start` (first run pulls ~1.5 GB of Docker
  images; on Linux the user must be in the `docker` group).
- Copy the keys from `supabase start` output into `api/.env` (template:
  `api/.env.example`). `web/` needs only `NEXT_PUBLIC_SUPABASE_URL` — no
  Supabase key at all — in `web/.env` (template: `web/.env.example`).
  <!-- Corrected 2026-08-07: this bullet used to say the keys go in `web/.dev.vars`
       (template `web/.dev.vars.example`, per `supabase/doc/SUPABASE.md`). Neither
       `web/.dev.vars.example` nor `supabase/doc/` exists. `web/.dev.vars` does exist
       but holds only `NEXTJS_ENV`; it is for real Cloudflare bindings (R2/KV/D1),
       not plain strings — see the header comment in `web/.env.example`. -->
- Start both apps: `npm run dev` (concurrently). Or individually:
  `npm run dev:api`, `npm run dev:web`.

### api/ — Express backend

- **Runs without a database by default.** `MOCK_MODE=true` is the default in
  `api/.env.example`; controllers/routes serve realistic fixture data from
  `api/src/mocks/fixtures.js`. Auth is real (genuinely signed/verified JWT —
  ephemeral RSA keypair generated on boot in mock mode via
  `app/src/app/config/app.keys.js`). 401s, refresh, and step-up reauth all
  behave like production. Only the data behind the helpers is fake.
- **What is real even in MOCK_MODE:** app structure, routing, auth/JWT/step-up,
  all 12 Sequelize models (which match `supabase/migrations/20260101000000_init.sql`
  exactly), request validation shape, error envelope, file upload handling,
  and **Cloudflare R2 storage** for receipts and signatures. Verify R2
  connectivity any time with `node api/scripts/check-r2.js`.
- **What is still mocked:** helpers that still contain `TODO(mock)` return
  fixture data. Reporting endpoints #50–#52 and #55–#56 use parameterized
  Sequelize queries; #53 remains fixture-backed and #54 remains blocked.
- **What is deferred entirely:** Puppeteer/Handlebars PDF rendering
  (`api/src/app/utils/PDF.util.js` returns a placeholder PDF), real XLSX export
  (`Report.helper.js` returns CSV), Jest test suite, `eslint.config.js`.
- **Mock-only debugging helper (must be removed when MOCK_MODE goes away):**
  `?as_head=true` on `POST /reimbursements` simulates the requester being head
  of the target department, to exercise the auto-verify path from doc 04 §4.
- **Layout:** `api/src/app/{config,controllers,database,helpers,middleware,models,routes,schemas,utils}/`.
  Conventional MVC-ish split. `api/src/app/middleware/Transaction.middleware.js`
  provides the per-request DB transaction wrapper.
- **Auth model:** JWT access token (TTL 900s by default), refresh token
  (TTL 604800s), step-up reauth (TTL 300s), password reset (TTL 900s), HMAC
  secret, plus two service tokens (`SERVICE_TOKEN_ENROLL`, `SERVICE_TOKEN_MERCH`).
  See `api/src/app/config/app.keys.js` for the full list of env vars.
- **Aggregate columns must be maintained in app code.** No rollup triggers
  exist yet (`docs/backend/02-database.md` §6). Real (non-mock)
  `Payment.helper.js`, `Reimbursement.helper.js`, and `Approval.helper.js`
  must keep `actual_amount` / `total_income` / `total_expense` correct inside
  their own transactions.
- **FE client generation:** `npm run gen:client` (in `api/`) runs
  `openapi-typescript` against `api/swagger.yaml` and writes
  `web/src/lib/api/types.gen.ts`. **Do not hand-edit `types.gen.ts`.** Regenerate
  after every `swagger.yaml` change. Nothing enforces this in CI yet, so treat
  "did you run `npm run gen:client`" as part of any route-change PR.
- **Available scripts:** `npm run dev` (node --watch), `npm run start`,
  `npm run lint`, `npm run test` (Jest, scaffold only — see `api/tests/`).

### web/ — Next.js frontend on Cloudflare

- Next.js 16 + React 19, deployed via `@opennextjs/cloudflare` to Cloudflare
  Workers (see `web/wrangler.jsonc` — worker name `finance-tracking-web`,
  compatibility date `2026-07-18`, `nodejs_compat` + `global_fetch_strictly_public`).
- `web/next.config.ts` calls `initOpenNextCloudflareForDev()` so
  `getCloudflareContext()` works under `next dev` — bindings are available
  locally, not just in preview.
- **API client is hand-maintained wrapper + generated types.** The
  hand-written `web/src/lib/api/client.ts` wraps `openapi-fetch` and exposes
  `api` + `setAccessToken()`. **Important:** `setAccessToken` calls
  `api.eject(prev)` before re-registering middleware, because `api.use()`
  accumulates indefinitely. Do not "fix" that — the eject is intentional.
- The default `web/src/app/page.tsx` is the real dashboard (StatCards +
  ActiveProjectsWidget + RecentReimbursementsTable), served behind the auth
  layout at `/`. Reads `getSummaryApi` / `getProjectsApi` /
  `getReimbursementsApi` and falls back to hardcoded defaults while in
  flight.
- `web/src/lib/api/types.gen.ts` is generated; do not hand-edit.
- **Shared formatters live in `web/src/lib/format.ts`.** `formatCurrencyTH`,
  `formatIntegerTH`, and `formatDateTH` accept `number | string | null |
  undefined` and coerce missing/garbage values to `0` / `"-"` instead of
  throwing on `.toLocaleString`. All dashboard and reimburse components
  import from here — do not reintroduce per-component `formatCurrency`
  helpers. Adding a new dashboard widget? Route money/dates through this
  module, even if your data looks clean.
- **Post-login routing lives only in `web/src/app/login/page.tsx`.**
  `AuthCallbackPage` (`app/auth/callback/page.tsx`) deliberately
  `router.replace("/login")` after both successful exchange and
  `ACCOUNT_NOT_CLAIMED` — `/login` owns the "open signature modal if
  missing, otherwise `router.push("/")`" decision via its `useEffect`
  on `[user, isLoading, router]`. The `ClaimAccountForm.onSuccess`
  callback only switches the tab back to login; it does NOT navigate.
  If a user "lands back on the login page after setting a password",
  that is the design — not a bug. Do not add parallel `router.push("/")`
  calls in `LoginForm.onSuccess` or `ClaimAccountForm.onSuccess`.
- **API summary compatibility:** `Report.summary` returns dashboard-facing
  `net_cashflow` and `pending_count` aliases alongside the documented
  `net_income` and `pending_slips.count` fields.
- **Google sign-in does not create a Supabase-backed session.** Supabase Auth is
  only an identity handshake: `web/src/lib/auth/supabaseOAuth.ts` redirects to
  `/auth/v1/authorize`, `web/src/app/auth/callback/page.tsx` reads the token out
  of the URL fragment (implicit flow) and trades it at
  `POST /auth/login/supabase` for one of the API's own RS256 sessions. A 404
  `ACCOUNT_NOT_CLAIMED` routes to `/login?mode=claim`, where `ClaimAccountForm`
  picks the token back up from `sessionStorage` (never a query param) and calls
  `POST /auth/claim`. Deliberately **no `@supabase/supabase-js` in `web/`** — it
  would persist a second session nothing reads, and require an anon key.
- **Frontend env vars are build-time, not runtime.** `NEXT_PUBLIC_*` is inlined
  by `next build`, so `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SUPABASE_URL` must
  be set wherever `opennextjs-cloudflare build` runs. Setting them as Worker
  vars in the Cloudflare dashboard has no effect on browser code. Template:
  `web/.env.example` (which, unlike `api/.env.example`, is force-added to git —
  `.gitignore:35` ignores `.env.example`).
- **Available scripts:** `npm run dev`, `npm run build`, `npm run start`,
  `npm run lint`, `npm run preview` (builds + OpenNext preview on the
  Cloudflare runtime), `npm run deploy`, `npm run upload`,
  `npm run cf-typegen` (regenerates `cloudflare-env.d.ts` from wrangler).

### supabase/ — local Postgres + Auth + Storage + Realtime

- Single migration `supabase/migrations/20260101000000_init.sql` defines
  every table under schema `finance` (not `public` — see header comment in
  the SQL file for why). `supabase/config.toml` lists `["finance", "public",
  "graphql_public"]` in that order, so PostgREST treats `finance` as the
  default profile.
- `supabase/seed.sql` seeds 6 staff rows; 4 of them have a real bcrypt
  (cost 12) password hash for the shared test password **`Passw0rd!2026`**.
  Use any of `chompoo / mark / golf / beam` for login tests via
  `POST /v1/auth/login`. The other 2 rows have `password_hash = NULL` to
  exercise `POST /v1/auth/claim`.
- Enum types live in the `finance` schema and include Thai title prefixes
  (`titles` = เด็กชาย / เด็กหญิง / นาย / นาง / นางสาว), `roles`
  (`user / staff / finance / it / hr / owner / admin`), and `source_types`.
- `uuid_generate_v7()` is defined here, not in an extension — so PKs are
  time-sortable. The `finance` schema's own migration owns it; do not
  duplicate it in api/.
- **Google OAuth is enabled in `config.toml` (`[auth.external.google]`) but needs
  two secrets from the environment**: `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`
  and `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`, resolved via `env()`. They
  live in **`api/.env`**, even though the Express app never reads them — one file
  for all Supabase secrets. The CLI has no `--env-file` flag and only auto-loads
  a `.env` from its own cwd, so the root `supabase:*` scripts pass the file
  explicitly with `node --env-file-if-exists=api/.env node_modules/.bin/supabase …`.
  **Consequence: a bare `npx supabase start` does not see these vars** — use
  `npm run supabase:start`. `npm run supabase:status` prints
  `WARN: environment variable is unset: …` for each one it can't resolve, which
  is the quickest check that the file is wired up.
  <!-- Do not "simplify" this to `set -a; . ./api/.env; set +a`. Verified
       2026-08-08: api/.env holds an unquoted multi-word PEM in JWT_PRIVATE_KEY,
       which shell sourcing would try to execute as commands. node's dotenv
       parser handles it, and does no $-expansion or backtick evaluation. -->
  The Google client's authorized redirect URI for local dev is
  `http://127.0.0.1:54321/auth/v1/callback` — GoTrue's callback, *not* the app's.
- `additional_redirect_urls` must contain the **exact** post-auth URL. It lists
  both `http://127.0.0.1:3000/auth/callback` and `http://localhost:3000/auth/callback`
  because `next dev` serves on `localhost` while `site_url` uses `127.0.0.1`; an
  unlisted `redirect_to` is silently rewritten to `site_url` and the session
  fragment is lost. The hosted project's equivalent list lives in the dashboard
  under Authentication → URL Configuration and is **not** managed by this file.
- `supabase/snippets/` is empty but reserved; the comment in `config.toml`
  about `auto_expose_new_tables` being removed `2026-10-30` is worth knowing
  before adding new tables.

### docs/ — design + reference

- `docs/backend/` is the implementation reference: 01 scaffold, 02 database,
  03 API spec, 04 authorization, 05 open questions. Diagrams in
  `docs/backend/diagrams/`.
- `docs/frontend/api-reference.md` is the FE contract view of the same API.
- `docs/exports/` holds rendered `.docx` snapshots of both references.
  Treat as read-only artifacts, not source.
- **Source of truth precedence when they disagree:** `api/swagger.yaml` is
  the running contract, `docs/backend/03-api-spec.md` is the design
  intent, and `docs/frontend/api-reference.md` is the FE-facing summary.
  When changing routes, update `swagger.yaml` first, then the backend
  doc, then the frontend doc, then regenerate the FE client.

### Cross-cutting gotchas

- `web/.dev.vars` (Worker-style) and `api/.env` (dotenv) are two different
  env files. Do not put web secrets in `api/.env` or vice versa.
- The api/ uses `SUPABASE_SECRET_KEY` server-side (bypasses RLS).
  The web/ uses `SUPABASE_PUBLISHABLE_KEY` in the browser. Never swap them.
- `api/src/mocks/fixtures.js` is large and is the only place fixture data
  should live. Helpers should never hardcode their own mock data — they
  import from fixtures.
- `api/scripts/check-r2.js`, `check-supabase.js`, `check-email.js` are
  connectivity smoke tests. Run them before assuming a service is broken
  in app code.
- `api/src/app/utils/Money.util.js` is the only correct way to do money
  math; never use raw `Number` for currency.

<!-- Agent: append new durable findings below this line. -->

- **`reimbursement_updatestatus.reason` exists now** (migration
  `20260907000000_add_reimbursement_status_reason.sql`). Before it, `reason` was required by
  swagger, the zod schema and `Approval.helper.js` TRANSITIONS on every `-> rejected`
  transition, and then thrown away — the table had no column. It is written only for
  rejections; approving transitions store NULL on purpose. **The migration must be applied to
  the hosted Supabase separately** — nothing in the deploy runs migrations.
- **Before trusting that an API field is stored, check for a column.** `note` (no such field
  anywhere) and `reason` (in the contract, no column) were both accepted and silently dropped.
  Worth a sweep of the rest of the contract.

### Reimbursement approval pass (2026-09-07, `kkattmos/fix-reimburse-approval`)

- **`POST /reimbursements/:id/status` takes `status`, `tracking_id`, `reason` — there is no
  `note`.** The web client used to send `note` (silently dropped) and packed the tracking id
  inside it as `[Tracking: X] …`, so finance approval 400'd every time. Which field is required
  is per-transition, in `Approval.helper.js` TRANSITIONS — mirror that table in the UI, don't
  invent fields.
- **`req.scope` is camelCase internally but MUST go on the wire snake_case** — swagger's Scope
  schema and the whole frontend are snake_case. `Auth.middleware.js#toPublicScope` converts at
  the boundary. Emitting camelCase made every `is_head`/`head_of` check in the UI silently
  `undefined`.
- **`GET /reimbursements/:id` and `GET /reimbursements` must stay in step.** The detail response
  was missing `department_id` / `project_id` / `requester`, which the list already had — so the
  UI could not tell which department a request belonged to and fell back to "head of *any*
  department". Both shapes come from `detailJSON` / the list projection; change them together.
- **`openapi-fetch` returns the API envelope, not the payload.** `res.data` is
  `{ success, data }`; the reimbursement is `res.data.data`. The `[id]` page never unwrapped it,
  so every field read off `record` was `undefined` and `latestStatus` fell through to its
  `"waiting"` default.
- **`REQUIRE_SIGNATURE=false`** turns off the approval signature requirement while PDF rendering
  is unavailable. It is a *published policy* (`GET /auth/me` -> `features.require_signature`),
  not a server-side gate — the API never enforced signatures on approval. Default stays `true`.
- **`initOpenNextCloudflareForDev()` must stay guarded on `NODE_ENV === "development"`.**
  Unguarded it also runs under `next start`, which then resolves pages against `.next/dev/…`
  and dies with ENOENT, so `npm run start` could never serve a production build locally.
- **Killing a local dev server by pid file or `pkill -f` is unreliable and cost hours here.**
  A stale pid means the "restart" silently fails with EADDRINUSE and you keep testing the OLD
  build — this happened four times. Kill by port instead:
  `for p in $(ss -ltnpH "sport = :3000" | grep -oE 'pid=[0-9]+' | cut -d= -f2); do kill -9 $p; done`
  and always confirm the new process actually logged "listening" before trusting a result.
  `pkill -f "src/index.js"` additionally matches its own shell and kills the tool call.
- **`next dev` cannot exercise real auth**: `AuthContext` falls back to `MOCK_DEV_USER` whenever
  `/auth/me` fails, gated on `NODE_ENV === "development"`. Use a production build for any
  authorization testing.

### Backend fix pass (2026-09-06, `kkattmos/fix-backend`)

- **`npm test` in `api/` is unit-only again** — `api/jest.config.js` now ignores `tests/e2e/`.
  Without it the default run fired the deployed-stack suite at the live API and wrote rows to a
  shared database. Deployed E2E stays behind `npm run test:e2e`.
- **The unit suite under `api/tests/*.test.js` is pre-existing broken** (167 of 224 fail on a
  clean `main` too — its mocks drifted from the code). Don't read a red `npm test` as a
  regression; diff the failing test *names* against the baseline instead.
- **`FLAG_CHECKS` has a helper-level twin.** Fixing `isGlobal` in `Auth.middleware.js` is only
  half the job: `Staff.helper.js#managerProjectIds` gates `GET /staff` independently and needed
  the same treatment. When you widen a route guard, grep for a second check inside the helper.
- **`GET /staff` (#7) had never worked for anyone** — `findAndCountAll` + `limit` + a nested
  required include makes Sequelize subquery the primary model and then emit the nested `where`
  against the outer query ("missing FROM-clause entry for table memberships"). Fixed with
  `subQuery: false`. It looked like an authorization bug only because the route 403'd everyone
  before the query ran.
- **`bankaccount.number` is `UNIQUE` across the whole table**, but the helper's duplicate check
  is scoped to the caller's own accounts — so two staff registering the same number reached
  Postgres. The error handler now maps `SequelizeUniqueConstraintError` to 409. Whether that
  constraint should instead be `UNIQUE (staff_id, number)` is an open schema question.
- **Cookie SameSite is derived, not hardcoded** (`app.conf.js` `isCrossSite`): `none` when the
  frontend and API are on different registrable domains, `lax` otherwise, both overridable via
  `COOKIE_SAMESITE` / `COOKIE_SECURE`. `logout` must clear with the same attributes or the
  browser keeps the cookie.
- **`api/Dockerfile` exists so Railway can render PDFs.** Nixpacks ships no Chromium, and Debian
  slim ships no Thai font — without `fonts-thai-tlwg` every rendered document is tofu boxes.
  The service must be pointed at the Dockerfile; `PUPPETEER_EXECUTABLE_PATH` selects the system
  Chromium over puppeteer's own download.
- **`signature_image` stores an R2 KEY, not a URL.** Readers presign on the way out via
  `R2.resolveUrl` (`/auth/me`, documents). Never persist a presigned URL — it expires.

### Deployed-stack E2E (added 2026-09-02)

- **Two E2E suites now exist, both pointed at the real deployment, both separate from the
  default `npm test`:** `api/tests/e2e/` (Jest, `cd api && npm run test:e2e`, config
  `api/jest.e2e.config.js`) and `web/tests/e2e/` (Playwright, `cd web && npm run test:e2e`,
  config `web/playwright.config.ts`). They assert the development plan's behaviour, so a red
  test is a product defect — never "fix" one by relaxing the assertion. Full findings and a
  ready-to-paste fix prompt: `docs/e2e-report.md`.
- **The backend is on Railway** (`finance-tracking-production-83ff.up.railway.app`), not
  Render. `web/.env.example` still names the retired Render URL — stale.
- **`npx jest` must be run from `api/`.** The repo root resolves a different (v30) jest whose
  `--testPathPattern` flag was renamed; running from the root fails confusingly.
- **`staff_dept` has no write API.** `is_head` / `is_finance` / `is_manager` are readable only.
  Approval-chain work therefore cannot provision its own actors — use the seeded accounts
  (`chompoo` head+finance, `mark` plain staff, `beam` owner, password `Passw0rd!2026`) which
  exist in the hosted database as well as locally.
- **`FLAG_CHECKS.isHead/isFinance/isManager/isMember` in `Auth.middleware.js` lack the
  `scope.isGlobal ||` bypass** their sibling predicates have. Consequence: a newly created
  project is unusable by anyone including its creator, and `role=admin` is refused most reads.
  Do not treat this as intended scoping.
- **Money convention is split.** The API is integer satang end to end
  (`Money.util.js`, `PDF.util.js#formatBaht` divides by 100) but `web/src/lib/format.ts`
  renders the raw integer, so the UI reads 100x the printed document. Check which side you are
  on before touching any amount.
- **`Upload.middleware.js` has no `fileFilter` on any route** — multer enforces size only.
- **Puppeteer does not run on Railway** (`PDF.util.js:160` launches with no `args` and no
  `executablePath`; there is no Dockerfile, so Nixpacks ships no Chromium). `format=html`
  works, `format=pdf` 500s.
- **`Auth.helper.js#forgotPassword` awaits `Email.sendMail` inline with no timeout**, so the
  request hangs whenever SMTP is unreachable — and the timing gap against the
  unknown-address path is an account-enumeration oracle.
- **Playwright lives in the ROOT package.json, not `web/`.** The specs stay at
  `web/tests/e2e/`, but the dependency and the runner are hoisted so the Cloudflare Workers
  build never installs or typechecks test tooling. Run it as `npm run test:e2e:web` from the
  repo root (`npm run test:e2e` runs both suites). `web/tsconfig.json` excludes `tests/e2e`
  and `playwright.config.ts` — its `include` is a broad `**/*.ts` and `next build` fails on any
  type error in what it matches, so putting the specs back into that graph breaks the deploy.
- **`web/package.json` pins `@opennextjs/cloudflare` to an exact version on purpose.** 1.20.6
  narrowed its peer to `next ">=15.5.24 <16 || >=16.3.3"`, and this app is on next 16.2.6 —
  inside that gap. A ranged `^1.19.9` therefore re-resolves to a version whose peer check fails
  and a plain `npm install` in `web/` dies with ERESOLVE. `npm ci` survives only because the
  committed lockfile happens to pin a compatible build. Do not restore a caret range without
  moving next to >=16.3.3 in the same change.
- **Cleanup:** `scripts/e2e-cleanup.sql` soft-deletes `E2E-%` / `@example.invalid` rows and
  recomputes the `total_expense` aggregates the `transfer` rollup wrote. It ends in `ROLLBACK`
  by design — inspect, then change to `COMMIT`.
