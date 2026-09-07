require("dotenv").config();

const baseUrl = process.env.BASE_URL || "http://localhost:4000";
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";

/** Approximate eTLD+1 by the last two labels. Good enough to tell `*.workers.dev` from
 *  `*.up.railway.app` (different sites) apart from `app.x.com` vs `api.x.com` (same site).
 *  It is wrong for multi-label public suffixes like `.co.uk`, which is why COOKIE_SAMESITE
 *  exists as an explicit override. */
const registrable = (url) => {
  try {
    return new URL(url).hostname.split(".").slice(-2).join(".");
  } catch {
    return null;
  }
};

/**
 * Is the browser's request from the frontend to this API a cross-site request?
 *
 * This decides the refresh cookie's SameSite attribute, and getting it wrong silently kills
 * every session. In production the frontend is a Cloudflare Worker (*.workers.dev) and the API
 * is on Railway (*.up.railway.app) — different registrable domains, so a SameSite=Strict or
 * Lax cookie is never stored or sent and POST /auth/refresh can never see it. Locally both
 * sides are localhost, where SameSite=None would be rejected outright because it requires
 * Secure and local dev is plain HTTP.
 */
const isCrossSite = (() => {
  const a = registrable(baseUrl);
  const b = registrable(corsOrigin);
  return Boolean(a && b && a !== b);
})();

module.exports = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 4000,
  baseUrl,
  // Where the web/ frontend lives — used to build the verification QR link on rendered
  // documents (doc 03 §9), which points at the frontend's /reimburse/<id> page, not the API.
  frontendBaseUrl: corsOrigin,
  corsOrigin,
  logLevel: process.env.LOG_LEVEL || "info",

  // Refresh cookie attributes — see isCrossSite above. Both are overridable because the
  // heuristic cannot know about multi-label public suffixes, and because a same-domain
  // deployment (app./api. of one custom domain) should prefer the stricter "lax".
  // SameSite=None is only honoured by browsers when Secure is also set, so the two move
  // together: asking for "none" forces secure on regardless of NODE_ENV.
  cookieSameSite: process.env.COOKIE_SAMESITE || (isCrossSite ? "none" : "lax"),
  cookieSecure:
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === "true"
      : isCrossSite || process.env.NODE_ENV === "production",
  isCrossSite,
  // See docs/backend/02-database.md §6 — no rollup triggers exist yet, so helpers must
  // maintain aggregate columns explicitly once MOCK_MODE is off.
  mockMode: process.env.MOCK_MODE !== "false",
};
