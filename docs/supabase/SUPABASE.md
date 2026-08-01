# Local Supabase

This project uses [Supabase](https://supabase.com) for its database, auth, storage, and realtime. For local development we run the **full Supabase stack in Docker** via the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) — no cloud account required, no shared dev database.

The CLI version is pinned in the root `package.json`, so `npm install` is the only setup step.

## Prerequisites

- **Docker** — Docker Desktop (macOS / Windows) or Docker Engine (Linux).
  - On Linux, your user needs to be in the `docker` group, otherwise the CLI can't reach the daemon:
    ```bash
    sudo usermod -aG docker "$USER"
    # then log out and back in (or `exec newgrp docker` in this shell)
    ```

## First-time setup

```bash
npm install                    # picks up the pinned `supabase` CLI
npm run supabase:start         # first run pulls ~1.5 GB of images
```

When it finishes, the CLI prints a JSON block with the local API URL and keys. Copy them into the two env files so the apps can connect:

```bash
# web/ — Next.js worker (loaded by wrangler dev/preview)
cp web/.dev.vars.example web/.dev.vars
$EDITOR web/.dev.vars

# api/ — Express backend
cp api/.env.example api/.env
$EDITOR api/.env
```

Fill in the three keys from the `supabase start` output:

| Variable                    | Where to find it           | Used by                |
| --------------------------- | -------------------------- | ---------------------- |
| `SUPABASE_URL`              | `API_URL`                  | web, api               |
| `SUPABASE_ANON_KEY`         | `ANON_KEY`                 | web (browser)          |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY`         | api (server-side only) |

> The `service_role` key bypasses Row Level Security. Never put it in client-side code or commit it. The two `.example` files are committed; the real `.env` / `.dev.vars` are gitignored.

## Day-to-day commands

All from the repo root:

```bash
npm run supabase:start   # boot the local stack
npm run supabase:stop    # stop containers (data is preserved)
npm run supabase:status  # print URLs + keys again
npm run supabase:reset   # nuke the DB, re-run every migration, re-seed
```

## Local endpoints

Once `supabase start` is running:

| Service             | URL                                  |
| ------------------- | ------------------------------------ |
| API / REST / Auth   | http://127.0.0.1:54321               |
| Postgres (direct)   | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Studio (DB UI)      | http://127.0.0.1:54323 — login `supabase` / `supabase` |
| Mailpit (test email)| http://127.0.0.1:54324               |
| GraphQL             | http://127.0.0.1:54321/graphql/v1    |
| Storage S3          | http://127.0.0.1:54321/storage/v1/s3 |

> The CLI binds everything to `0.0.0.0` on Linux, so the API keys and JWT secret are reachable from other machines on your LAN. That's fine for a dev box, but be aware before running it on shared networks.

## Schema changes

Migrations live in `supabase/migrations/` as plain SQL files, one per change:

```bash
# create a new migration (filename is auto-prefixed with a timestamp)
npx supabase migration new add_transactions_table
# write the SQL, then:
npm run supabase:reset   # apply every migration from scratch
```

Seed data for local dev goes in `supabase/seed.sql` and is applied by `db reset` after all migrations.

## When you're ready for a cloud project

The same `supabase/` directory pushes to a hosted project:

```bash
npx supabase login
npx supabase link --project-ref <ref>    # from your Supabase dashboard URL
npx supabase db push                     # apply pending migrations to the cloud DB
```

Keep a separate cloud project for testing (e.g. `finance-tracking-test`) so local experiments never touch production data.
