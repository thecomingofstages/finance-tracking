# finance-tracking

TCOS's Financial Tracking System — a monorepo for an Express API, a Next.js
frontend on Cloudflare Workers, and a local Supabase stack. This README is the
human-facing entry point. AI coding agents: read [`AGENTS.md`](AGENTS.md) first
(it auto-loads via `CLAUDE.md`).

## What's in this repo

| Path | What it is |
| --- | --- |
| `api/` | Express 4 + Sequelize 6 backend. Runs **without a database by default** — `MOCK_MODE=true` serves realistic fixture data; auth and R2 storage are real even in mock mode. |
| `web/` | Next.js 16 + React 19 frontend, deployed to Cloudflare Workers via OpenNext 1.19. The home page is still the `create-next-app` starter; UI work is effectively unstarted. |
| `supabase/` | Local Supabase stack (Postgres in schema `finance`, Auth, Storage, Realtime) run via Docker. One migration, six seed staff rows. |
| `docs/` | Design and reference prose. `docs/backend/01..05-*.md` is the implementation reference, `docs/frontend/api-reference.md` is the FE-facing summary. Rendered `.docx` snapshots live in `docs/exports/`. |
| `AGENTS.md` | Reference for AI coding agents — interaction style, source preferences, git workflow, project-specific notes. |
| `CLAUDE.md` | One-line pointer to `AGENTS.md` so Claude Code auto-loads it. |

## How to run it

### Prerequisites

- **Node.js** — whatever `package.json` engines expect (not pinned in this README; check each subproject if you hit a version error).
- **Docker** — Docker Desktop (macOS / Windows) or Docker Engine + your user in the `docker` group on Linux.
- **npm** — comes with Node.

### One-time setup

```bash
# 1. Install the root orchestration deps (this also pins the Supabase CLI)
npm install

# 2. Install api/ and web/ dependencies
npm run install:all

# 3. Start the local Supabase stack (first run pulls ~1.5 GB of Docker images)
npm run supabase:start
```

When `supabase start` finishes it prints a JSON block with `API_URL`, `ANON_KEY`,
and `SERVICE_ROLE_KEY`. Copy them into the env files:

```bash
cp api/.env.example api/.env
$EDITOR api/.env          # fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

cp web/.dev.vars.example web/.dev.vars
$EDITOR web/.dev.vars     # fill in the same three keys
```

The `SUPABASE_SERVICE_ROLE_KEY` is server-side only (bypasses RLS). The
`SUPABASE_ANON_KEY` is what the browser sees. **Never swap them** — see
`AGENTS.md` for the full gotcha list.

### Running the apps

```bash
# Both at once (concurrently, blue + green prefix per process)
npm run dev

# Or one at a time
npm run dev:api           # Express on http://localhost:4000
npm run dev:web           # Next.js on http://localhost:3000
```

The API serves a 58-endpoint mock with real JWT auth out of the box:

```bash
curl -s http://localhost:4000/v1/health
curl -s -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"golf@tcos.app","password":"anything"}'
```

In `MOCK_MODE=true`, the password isn't checked against a real `staff` table —
any string works for the four seeded users (`chompoo / mark / golf / beam`, all
sharing test password `Passw0rd!2026` against the real DB when it's running).

### Useful one-off commands

```bash
# Regenerate the FE TypeScript client from api/swagger.yaml
cd api && npm run gen:client

# Connectivity smoke tests (run before assuming a service is broken)
node api/scripts/check-r2.js
node api/scripts/check-supabase.js
node api/scripts/check-email.js

# Regenerate Cloudflare env types for the web worker
cd web && npm run cf-typegen

# Wipe the local DB and re-run migrations + seed
npm run supabase:reset
```

### Stopping / resetting

```bash
npm run supabase:stop     # shut down the Docker stack
npm run supabase:reset    # drop & re-create the DB (destructive — confirm first)
```

---

## Appendix: notes for AI coding agents

This section captures a review of [`AGENTS.md`](AGENTS.md) done from inside an
agent session. It's here so the meta-information lives next to the README
humans read, but the source of truth for agents is still `AGENTS.md` itself.

### Which instructions are unclear

The list below is grouped by section. Each item names a place where a literal
reading of the rule leaves the agent guessing; "what to do about it" is left
for the next person to decide.

**Interaction Style**
- The "ask before acting" rule doesn't define what counts as a "task." A
  one-line README typo fix is presumably not a task; a one-line
  `swagger.yaml` parameter rename is. The threshold is implicit.
- "Read the repo before guessing" still says "before changing routes, schemas,
  or models," but other categories of change (env vars, helpers, fixtures,
  R2 bucket policy) fall outside that scope even though the broader section
  seems to cover them.
- "Never act on a conflicted working tree" doesn't define *conflicted* — `M`
  files? `??` files? untracked scratch from a teammate's merge?

**Source Preferences**
- "Always verify against the official doc" doesn't say **which** doc when more
  than one is authoritative (e.g. Cloudflare's Workers docs vs. OpenNext's
  docs for `getCloudflareContext()` behavior under `next dev`). No precedence
  between official sources.
- "Proactive fetching … any time a named framework or CLI shows up … in a
  file you're about to change" — the trigger is the agent predicting "about
  to," not observing it. Unclear when "about to" begins.
- The `Sources:` list rule says "one per URL consulted" but doesn't address
  de-duplication across multiple WebFetch calls in the same response, nor
  redirect URLs.

**Session Memory**
- The drift rule's example list (build command, env var name, route path,
  model, schema, convention) is not exhaustive. A new code path that doesn't
  match any of the five will be added without updating `AGENTS.md`.
- "Flag the conflict in place" doesn't specify format — comment block? HTML
  marker? new section?
- "Prune entries that are no longer true" is fine, but no rule about *who*
  prunes (only the agent? only humans?) or *when* (in the same PR? a
  separate cleanup commit?).

**Git Workflow**
- "Before committing, ask whether the target branch is a personal/feature
  branch or a shared one" — but the `nickname/feature-implemented` branch
  convention means the agent can recognize a feature branch by name pattern.
  The ask is redundant for the obvious case.
- "One logical change per commit" — a "fix a bug" task often touches
  `swagger.yaml` + a controller + a test + a docs file. Whether that's one
  logical change or four is undefined.
- "Never push, force-push, merge, or rebase without explicit confirmation" —
  no rule about *who* confirms. On a shared branch, presumably the human
  who owns the branch, but the rule doesn't name the principal.

**Project-Specific Notes**
- The "pinned versions" warning names Next.js 16, React 19, OpenNext 1.19,
  Wrangler, Supabase CLI, Sequelize 6, Express 4, Pino, zod, openapi-fetch,
  and openapi-typescript — but omits `bcrypt`, `multer`, `papaparse`,
  `nodemailer`, `helmet`, `cors`, `cookie-parser`, `express-rate-limit`,
  `qrcode`, `jsonwebtoken`, `pino-http`, `pg`, `pg-hstore`,
  `swagger-ui-express`, `tailwindcss` 4, `@tailwindcss/postcss`, and others.
  An agent touching any of those won't get the "verify against official doc"
  nudge.
- "MOCK_MODE=true is the default" is true of `api/.env.example` but not
  necessarily of a local checkout. The README can't tell whether
  `MOCK_MODE` has been overridden.
- `?mock_status=...` and `?as_head=true` are listed as "must be removed when
  MOCK_MODE goes away," but no test, lint rule, or grep-based check enforces
  that. It's a reminder without a hook.
- The "source of truth precedence" puts `api/swagger.yaml` first, but the
  **migration** `supabase/migrations/20260101000000_init.sql` is the
  actual ground truth for column names and enums, and it's not in the
  precedence list. If they disagree (e.g. someone adds a column to the
  migration and forgets to update swagger.yaml), the rule says trust
  swagger.yaml — but the migration is what Postgres actually has.
- "Money.util.js is the only correct way to do money math" doesn't say what
  it returns (Decimal? string? bigint? int minor-units?) or what the
  canonical input is. The rule points at the file but doesn't state the
  contract.

### Fetches I'd make in a typical "fix a bug" session

These are the sources an agent would touch, grouped by where they come from.
Token costs are rough heuristics from the sizes I've already read plus the
typical size of a single WebFetch result.

**Repo files (no network)**

| Source | Approx size | Tokens | Refetched how often | Reducible? |
| --- | --- | --- | --- | --- |
| `api/swagger.yaml` (925 lines) | ~33 KB | ~8–9k | Every route-touching change | Yes — read with line ranges |
| `api/src/app/helpers/<Bug>.helper.js` | ~2–4 KB | ~500–1k | Always (the bug lives here) | Already scoped |
| `api/src/app/middleware/*` (7 files) | ~10 KB | ~2.5k | When request flow is suspect | Yes — usually one file |
| `api/src/app/config/*` (10 files) | ~6 KB | ~1.5k | When env/auth/R2/email matters | Yes — usually one or two |
| `api/src/mocks/fixtures.js` | "large" per AGENTS.md | ~10–20k est. | When the helper reads from fixtures | Yes — grep, don't read whole |
| `supabase/migrations/20260101000000_init.sql` (296 lines) | ~10 KB | ~2.5k | When a column, enum, or FK matters | Partly — usually one CREATE TABLE block |
| `web/wrangler.jsonc` | ~50 lines | ~1k | When deploy/Cloudflare behavior is in question | Already small |
| `docs/backend/01..05-*.md` (5 files) | unknown | ~3–6k combined est. | Often | Yes — pick the doc that matches the topic |
| `AGENTS.md` itself | 231 lines | ~2.5–3k | Once per session (auto-loaded) | Yes — don't re-read |

**Official web docs (WebFetch / WebSearch, network)**

| Source | Tokens per fetch | Refetched how often | Reducible? |
| --- | --- | --- | --- |
| Next.js 16 doc page | ~3–8k | Whenever a Next 16 API is touched | Yes — fetch a specific URL, not the docs root |
| React 19 doc page | ~3–6k | Whenever a React 19 API is touched | Same |
| OpenNext 1.19 doc page | ~2–5k | Whenever OpenNext-specific behavior is in question | Same |
| Cloudflare Workers / Wrangler doc page | ~2–6k | Whenever wrangler config, flags, or bindings are in question | Same |
| Supabase CLI doc page | ~2–5k | Whenever `supabase` CLI behavior is in question | Same |
| Sequelize 6 doc page | ~2–5k | Whenever a model definition or query is in question | Same |
| Express 4 doc page | ~2–4k | Whenever middleware, error handling, or routing is in question | Same |
| Pino / pino-http doc page | ~1–3k | Whenever log shape, redaction, or transport is in question | Same |
| zod doc page | ~1–3k | Whenever a schema shape is in question | Same |
| openapi-fetch / openapi-typescript doc page | ~1–3k | Whenever the FE client is being modified or regenerated | Same |
| Other deps' doc pages (bcrypt, multer, papaparse, nodemailer, helmet, cors, jsonwebtoken, qrcode, etc.) | ~1–3k each | When that specific lib is in question | Same |

**Training-data fallbacks**

| Source | Tokens | Refetched how often | Reducible? |
| --- | --- | --- | --- |
| The model's own memory of these frameworks | 0 input (already in weights) | When both the repo and the web are silent | The rule already says flag it |

### Per-session token cost

- **First session on a fresh repo, no prior context:** ~30–60k tokens of repo
  reads (mostly design docs and `swagger.yaml`) plus a handful of WebFetches
  (~5–20k). Roughly **40–80k input tokens** to build a working model of the
  repo.
- **Subsequent session on the same repo, same task:** ~5–15k tokens of repo
  reads (just the files in scope) plus 0–3 WebFetches (~5–15k). Roughly
  **10–30k input tokens** if the agent is disciplined.
- **Pathological session** (whole `swagger.yaml`, all five backend docs,
  every framework's docs root): ~80–150k input tokens. An agent that does
  this is the one that wastes context.

### Reduction strategies that work here

1. **Scope reads to the topic.** Use `Read` with `offset` / `limit` on
   `swagger.yaml`, the migration SQL, and the design docs. Read whole files
   only when the bug is "the file is wrong."
2. **One WebFetch per framework, per session, scoped to a specific URL.** Don't
   fetch the docs root. Don't fetch the same page twice. The
   source-preferences rule already says to verify; it doesn't say to
   re-verify.
3. **Prefer `grep` over `Read`** when looking for where something is defined.
   Read the matched file, not the whole tree.
4. **Trust `AGENTS.md` after the first read.** It's already in context.
   Re-reading it is a token-cost bug, not a safety move.
5. **Don't fetch the docs of a library that isn't in scope.** If the bug is
   in `Reimbursement.helper.js`, the agent doesn't need bcrypt, multer,
   papaparse, or nodemailer docs. It needs Sequelize, Express middleware
   order, and possibly the auth / JWT pages.
6. **Keep a "fetched this session" mental list** and skip sources already on
   it. Same idea as browser cache.
