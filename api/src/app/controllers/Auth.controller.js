const asyncHandler = require("../utils/asyncHandler.util");
const { ok, created, noContent } = require("../utils/Response.util");
const Auth = require("../helpers/Auth.helper");

const setRefreshCookie = (res, token) =>
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

exports.claim = asyncHandler(async (req, res) => {
  const session = await Auth.claim(req.body);
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
  const session = await Auth.loginViaSupabase({ supabaseEmail: req.body?.email });
  setRefreshCookie(res, session.refresh_token);
  const { refresh_token, ...body } = session;
  return ok(res, body);
});

exports.logout = asyncHandler(async (req, res) => {
  res.clearCookie("refresh_token");
  return noContent(res);
});

exports.refresh = asyncHandler(async (req, res) => {
  const session = await Auth.loginViaSupabase({ supabaseEmail: undefined });
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
