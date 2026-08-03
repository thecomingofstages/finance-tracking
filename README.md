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
$EDITOR api/.env          # fill in SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY

cp web/.dev.vars.example web/.dev.vars
$EDITOR web/.dev.vars     # fill in the same three keys
```

The `SUPABASE_SECRET_KEY` is server-side only (bypasses RLS). The
`SUPABASE_PUBLISHABLE_KEY` is what the browser sees. **Never swap them** — see
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
  -d '{"email":"name@tcos.app","password":"anything"}'
```

In `MOCK_MODE=true`, the password isn't checked against a real `staff` table —
any string works for the seeded users.

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