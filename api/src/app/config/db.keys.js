module.exports = {
  password: process.env.DB_PASSWORD || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  // Supabase's current key naming: `publishable` (was `anon`) and `secret` (was
  // `service_role`). `secret` bypasses RLS — server-side only, never sent to a browser.
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
  supabaseAuthJwksUrl: process.env.SUPABASE_AUTH_JWKS_URL || "",
};
