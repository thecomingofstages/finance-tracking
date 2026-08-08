require("dotenv").config();

const host = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

/**
 * Does the browser treat an API call from the frontend as cross-site? If so the refresh cookie
 * must be SameSite=None; Secure or the browser refuses to store it at all — which is what broke
 * production login (Cloudflare Workers ↔ Render are different registrable domains).
 *
 * Derived from the configured origins rather than NODE_ENV, because NODE_ENV is not reliably
 * set on Render and getting this wrong fails silently: the cookie is simply dropped, with no
 * error anywhere. Requires https on the frontend origin, since Secure is mandatory for
 * SameSite=None — so plain-http local dev correctly stays on Lax even though the ports differ.
 * Override with CROSS_SITE_COOKIES=true|false if a deployment ever needs to disagree.
 */
function resolveCrossSiteCookies() {
  if (process.env.CROSS_SITE_COOKIES) return process.env.CROSS_SITE_COOKIES === "true";
  const frontend = process.env.CORS_ORIGIN || "http://localhost:3000";
  const frontendHost = host(frontend);
  const apiHost = host(process.env.BASE_URL || "http://localhost:4000");
  return frontend.startsWith("https://") && Boolean(frontendHost) && frontendHost !== apiHost;
}

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
  // See resolveCrossSiteCookies() above — drives the refresh cookie's SameSite/Secure pair.
  crossSiteCookies: resolveCrossSiteCookies(),
  // Roles that get scope.isGlobal — permission everywhere, bypassing staff_dept membership
  // (doc 04 §2). Configurable because doc 04 disagrees with itself: §2 says "owner / admin",
  // while §3's matrix also grants `finance` global project create/delete. The default keeps
  // §3's reading, which is what MOCK_MODE has always returned.
  globalRoles: (process.env.GLOBAL_ROLES || "finance,owner,admin")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean),
};
