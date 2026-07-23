const rateLimit = require("express-rate-limit");
const ApiError = require("../utils/ApiError.util");
const { fail } = require("../utils/Response.util");

function handler(req, res) {
  fail(res, new ApiError(429, "RATE_LIMITED", "Too many attempts — try again shortly."));
}

/** 5 attempts per email/IP per 15 min — doc 03 §4 (/auth/login, /auth/verify-password). */
const authAttempts = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

/** Looser general limit for everything else, mainly to blunt accidental retry storms. */
const general = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

module.exports = { authAttempts, general };
