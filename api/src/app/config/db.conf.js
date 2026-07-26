module.exports = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 54322,
  database: process.env.DB_NAME || "postgres",
  username: process.env.DB_USER || "postgres",
  // Every table lives under this Postgres schema, not `public` — see
  // supabase/migrations/20260101000000_init.sql, which creates it explicitly.
  schema: process.env.DB_SCHEMA || "finance",
  pool: { min: 0, max: 10, idle: 10000, acquire: 30000 },
};
