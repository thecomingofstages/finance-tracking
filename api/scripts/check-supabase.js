#!/usr/bin/env node
/** Backend-side Supabase connectivity check. Doesn't print secrets. Uses the secret key
 *  (server-side, bypasses RLS) — never run this pattern from browser/FE code. */
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });

async function main() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    console.log("Supabase not configured (missing SUPABASE_URL/SUPABASE_SECRET_KEY) — nothing to check.");
    return;
  }
  console.log("URL:", url);

  const authHealth = await fetch(`${url}/auth/v1/health`, { headers: { apikey: secretKey } });
  console.log("auth/v1/health ->", authHealth.status, authHealth.ok ? "OK" : "FAILED");

  const rest = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  });
  console.log("rest/v1/ (schema introspection, needs secret key) ->", rest.status, rest.ok ? "OK" : "FAILED");

  const staff = await fetch(`${url}/rest/v1/staff?select=_id&limit=1`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  });
  const body = await staff.json();
  if (staff.ok) {
    console.log("rest/v1/staff -> OK,", body.length, "row(s)");
  } else {
    console.log("rest/v1/staff ->", staff.status, body.message || body);
    if (body.code === "PGRST205") {
      console.log("  (schema not deployed to this project yet — expected until the migration is pushed)");
    }
  }
}

main().catch((err) => {
  console.error("Supabase connectivity FAILED:", err.message);
  process.exit(1);
});
