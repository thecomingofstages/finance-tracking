const { dbKeys } = require("../config/init");

/**
 * Verifies a Supabase Auth access token by asking Supabase's own GoTrue endpoint whose token
 * it is (GET /auth/v1/user) — this needs no JWKS fetching or local RS256 verification, so it
 * stays correct even if Supabase rotates their signing keys. Used by #57 claim and #58
 * login/supabase, which receive a Supabase session token instead of one of our own.
 * Returns the Supabase user record ({ id, email, ... }) or throws a 401 ApiError.
 */
const ApiError = require("./ApiError.util");

async function verifySupabaseToken(accessToken) {
  if (!accessToken) throw ApiError.unauthorized("Missing Supabase session token.");
  if (!dbKeys.supabaseUrl || !dbKeys.supabasePublishableKey) {
    throw new Error(
      "Supabase is not configured — set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in api/.env."
    );
  }
  const res = await fetch(`${dbKeys.supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: dbKeys.supabasePublishableKey,
    },
  });
  if (!res.ok) {
    throw ApiError.unauthorized("Invalid or expired Supabase session.");
  }
  return res.json();
}

module.exports = { verifySupabaseToken };
