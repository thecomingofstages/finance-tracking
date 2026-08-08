require("dotenv").config();

module.exports = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  baseUrl: process.env.BASE_URL || "http://localhost:4000",
  // Where the web/ frontend lives — used to build the verification QR link on rendered
  // documents (doc 03 §9), which points at the frontend's /reimburse/<id> page, not the API.
  frontendBaseUrl: process.env.CORS_ORIGIN || "http://localhost:3000",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  logLevel: process.env.LOG_LEVEL || "info",
  // See docs/backend/02-database.md §6 — no rollup triggers exist yet, so helpers must
  // maintain aggregate columns explicitly once MOCK_MODE is off.
  mockMode: process.env.MOCK_MODE !== "false",
  // Roles that get scope.isGlobal — permission everywhere, bypassing staff_dept membership
  // (doc 04 §2). Configurable because doc 04 disagrees with itself: §2 says "owner / admin",
  // while §3's matrix also grants `finance` global project create/delete. The default keeps
  // §3's reading, which is what MOCK_MODE has always returned.
  globalRoles: (process.env.GLOBAL_ROLES || "finance,owner,admin")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean),
};
