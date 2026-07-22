const crypto = require("node:crypto");
const ApiError = require("../utils/ApiError.util");
const { fail } = require("../utils/Response.util");
const { keys } = require("../config/init");

/** X-Service-Token — Enroll/Merch ingress only, never reachable with a user JWT. Doc 04 §6. */
function verifyServiceToken(req, res, next) {
  const provided = req.headers["x-service-token"];
  if (!provided) return fail(res, ApiError.unauthorized("Missing X-Service-Token."));

  const known = Object.values(keys.serviceTokens).filter(Boolean);
  const match = known.some((token) => {
    const a = Buffer.from(token);
    const b = Buffer.from(String(provided));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!match) return fail(res, ApiError.unauthorized("Invalid service token."));
  return next();
}

module.exports = { verifyServiceToken };
