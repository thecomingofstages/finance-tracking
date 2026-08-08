const asyncHandler = require("../utils/asyncHandler.util");
const { ok, created, noContent } = require("../utils/Response.util");
const Auth = require("../helpers/Auth.helper");
const { app: appConf } = require("../config/init");

/**
 * The frontend and the API are on different registrable domains in every deployed environment
 * (Cloudflare Workers ↔ Render), which makes every API call cross-site. SameSite=Strict meant
 * the browser never stored this cookie at all, so POST /auth/refresh could never work and a
 * page reload was an unrecoverable logout.
 *
 * SameSite=None is the only value a cross-site cookie can have, and browsers require Secure
 * alongside it. Locally there is no cross-site problem and no TLS, so Lax is both sufficient
 * and the only thing that works over plain http. appConf derives which case applies from the
 * configured origins — see resolveCrossSiteCookies() in config/app.conf.js.
 */
const REFRESH_COOKIE = "refresh_token";
const refreshCookieOptions = {
  httpOnly: true,
  secure: appConf.crossSiteCookies,
  sameSite: appConf.crossSiteCookies ? "none" : "lax",
  path: "/",
};

const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

/** clearCookie only matches a cookie whose attributes agree — same options, minus maxAge. */
const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

/** #57/#58 carry a Supabase Auth session token, not one of our own Bearer access tokens —
 *  verifyJWT (which expects OUR RS256 tokens) is deliberately not mounted on these two routes,
 *  so the raw header is read here instead. */
function supabaseToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : undefined;
}

exports.claim = asyncHandler(async (req, res) => {
  const session = await Auth.claim({ supabaseAccessToken: supabaseToken(req), password: req.body?.password });
  setRefreshCookie(res, session.refresh_token);
  const { refresh_token, ...body } = session;
  return created(res, body);
});

exports.login = asyncHandler(async (req, res) => {
  const session = await Auth.login(req.body);
  setRefreshCookie(res, session.refresh_token);
  const { refresh_token, ...body } = session;
  return ok(res, body);
});

exports.loginViaSupabase = asyncHandler(async (req, res) => {
  const session = await Auth.loginViaSupabase({ supabaseAccessToken: supabaseToken(req) });
  setRefreshCookie(res, session.refresh_token);
  const { refresh_token, ...body } = session;
  return ok(res, body);
});

exports.logout = asyncHandler(async (req, res) => {
  clearRefreshCookie(res);
  return noContent(res);
});

exports.refresh = asyncHandler(async (req, res) => {
  const session = await Auth.refresh(req.cookies?.refresh_token);
  setRefreshCookie(res, session.refresh_token);
  const { refresh_token, ...body } = session;
  return ok(res, body);
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const data = await Auth.forgotPassword(req.body?.email);
  return ok(res, data);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  await Auth.resetPassword(req.body);
  return noContent(res);
});

exports.verifyPassword = asyncHandler(async (req, res) => {
  const data = await Auth.verifyPassword({ staffId: req.auth.staffId, password: req.body?.password });
  return ok(res, data);
});

exports.me = asyncHandler(async (req, res) => {
  const data = await Auth.me(req.auth.staffId, req.scope);
  return ok(res, data);
});
