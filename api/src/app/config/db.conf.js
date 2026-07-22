module.exports = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 54322,
  database: process.env.DB_NAME || "postgres",
  username: process.env.DB_USER || "postgres",
  pool: { min: 0, max: 10, idle: 10000, acquire: 30000 },
};
