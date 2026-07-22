module.exports = {
  password: process.env.DB_PASSWORD || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseAuthJwksUrl: process.env.SUPABASE_AUTH_JWKS_URL || "",
};
