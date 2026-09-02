/**
 * Shared run context: admin session + a run-scoped prefix so every artefact this suite writes
 * to the shared database is identifiable and reversible.
 *
 * Blast-radius rule for this suite (agreed 2026-09-02): the target Supabase project is shared
 * and will become production once delivered, so every row created here is named
 * `E2E-<runId>-…`. Nothing pre-existing is ever mutated or deleted. `scripts/e2e-cleanup.sql`
 * removes what the API cannot.
 */

const { api } = require("./client");

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "password1234";

/** Stable per-run id: sortable, short, and greppable in the DB afterwards. */
const RUN_ID = process.env.E2E_RUN_ID || new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
const PREFIX = `E2E-${RUN_ID}`;

/** Emails must be unique and must never collide with a real member of staff. */
const email = (label) => `e2e+${RUN_ID}-${label}@example.invalid`;

async function login(emailAddr, password) {
  const res = await api.post("/auth/login", { body: { email: emailAddr, password } });
  if (res.status !== 200) {
    throw new Error(`login failed for ${emailAddr}: ${res.status} ${res.text}`);
  }
  return {
    token: res.data.access_token,
    staff: res.data.staff,
    refreshCookie: (res.setCookie.find((c) => c.startsWith("refresh_token=")) || "").split(";")[0],
    raw: res,
  };
}

/** Step-up token for the endpoints that demand X-Reauth-Token (#40, #47, #60). */
async function stepUp(token, password) {
  const res = await api.post("/auth/verify-password", { token, body: { password } });
  if (res.status !== 200) throw new Error(`step-up failed: ${res.status} ${res.text}`);
  return res.data.reauth_token || res.data.token || res.data;
}

const admin = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };

module.exports = { RUN_ID, PREFIX, email, login, stepUp, admin, ADMIN_EMAIL, ADMIN_PASSWORD };
