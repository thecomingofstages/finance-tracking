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
- **What is still mocked:** every helper in `api/src/app/helpers/*.helper.js`
  returns fixture data. Each one has a `// TODO: real implementation —` comment
  near-verbatim from `docs/backend/03-api-spec.md`.
- **What is deferred entirely:** Puppeteer/Handlebars PDF rendering
  (`api/src/app/utils/PDF.util.js` returns a placeholder PDF), real XLSX export
  (`Report.helper.js` returns CSV), Jest test suite, `eslint.config.js`.
- **Mock-only debugging helpers (must be removed when MOCK_MODE goes away):**
  - `?mock_status=waiting|head_approve|fin_approve|transfer|rejected` on
    reimbursement detail routes — simulates "what if this record were
    currently in state X."
  - `?as_head=true` on `POST /reimbursements` — simulates the requester being
    head of the target department, to exercise the auto-verify path from
    doc 04 §4.
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
- The default `web/src/app/page.tsx` is still the `create-next-app` starter
  page. Treat it as unstarted UI work, not the real home page.
- `web/src/lib/api/types.gen.ts` is generated; do not hand-edit.
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

- **`resolveScope` and `requireScope` are both real as of 2026-08-08.** Both live in
  `api/src/app/middleware/Auth.middleware.js`. Before this, *both* did
  `return next(new Error("... not wired up yet"))` in the non-mock branch — which meant that
  the moment `MOCK_MODE=false` shipped to Render, every authenticated route returned 500,
  because all 7 route files mount `resolveScope`. `GET /auth/me` 500ing is what made login
  appear to silently fail in production. If you see a blanket 500 on authenticated routes
  again, check these two first.
- **`requireScope` takes an explicit target resolver at every call site** — all 28 of them, from
  `api/src/app/utils/ScopeTarget.util.js`. Do not "simplify" this by inferring the target inside
  the middleware: `req.params.id` is a project id on `/projects/:id` and a payment id on
  `/payments/:id`, so a convention that guesses wrong is a silent authorization hole rather than
  a visible error. An unknown flag name throws at **import time** — the server won't boot on a
  typo'd flag, which is deliberate.
- **`requireScope` gates, it does not filter.** Routes with no project context
  (`/reports/cashflow`, `/reports/ledger`, `GET /staff`, `GET /staff/:id`, `POST /payments/approve`)
  degrade to "does this flag hold for at least one of the caller's projects". They still return
  unfiltered rows, because `Report.helper.js` / `Staff.helper.js` / `Payment.helper.js` don't
  read `req.scope` yet. Real gap — see doc 04 §3.1.
- **`req.scope` key casing is snake_case for the arrays, camelCase for the scalars** —
  `staffId` / `role` / `isGlobal`, but `memberships[].is_head`, `head_of`, `finance_of`,
  `manager_of`, `departments`. Not a style choice: `GET /auth/me` returns `req.scope` verbatim
  to the browser and `web/src/context/AuthContext.tsx` reads the snake_case names. Mock and
  real mode emit the same shape — the real one adds `staff_dept_id`, `departments`, `staffId`,
  `role`, `isGlobal`. Doc 04 §2 used to specify camelCase; it was corrected to match, not the
  code.
- **`GLOBAL_ROLES` env var** (`api/src/app/config/app.conf.js`) controls which roles get
  `scope.isGlobal`. Defaults to `finance,owner,admin`. Exists because doc 04 §2 ("owner /
  admin") and §3's matrix (finance can create/delete projects) genuinely disagreed.
- **Scope is resolved per request and never cached or put in the JWT** (doc 04 §2) — a
  revocation has to take effect immediately, not at the 15-minute token expiry.
- **The session is memory + httpOnly cookie, by design.** The access token lives only in a
  module closure in `web/src/lib/api/client.ts` (never localStorage — XSS would read it); the
  durable half is the `refresh_token` cookie. `AuthContext` therefore *must* redeem that cookie
  via `POST /auth/refresh` on boot before calling `/auth/me`, and re-arms a timer to rotate 60s
  before the 900s expiry. Remove that boot call and every page reload becomes a logout.
- **`web/src/lib/api/client.ts` sets `credentials: "include"`.** Without it the browser never
  attaches the refresh cookie cross-origin and `/auth/refresh` always 401s. Pairs with the
  API's `cors({ credentials: true })` and a concrete `CORS_ORIGIN` — a credentialed request
  cannot use `Access-Control-Allow-Origin: *`.
- **Refresh-cookie `SameSite` is derived from config, not `NODE_ENV`** — see
  `resolveCrossSiteCookies()` in `api/src/app/config/app.conf.js`. Cross-site (Cloudflare ↔
  Render) needs `SameSite=None; Secure`; plain-http localhost needs `Lax`. It keys off
  `CORS_ORIGIN` vs `BASE_URL` because Render does not reliably set `NODE_ENV`, and the failure
  mode is silent — the browser just drops the cookie. Override with `CROSS_SITE_COOKIES`.
  `clearCookie` on logout must pass the *same* attributes or it won't match and won't clear.
- **`npm run lint` in `web/` is broken** — it calls `next lint`, removed in Next 16. The
  `eslint.config.mjs` also fails to load under eslint 9 (circular-structure error from the
  eslintrc compat layer). `npx tsc --noEmit` works and is the usable check today.
