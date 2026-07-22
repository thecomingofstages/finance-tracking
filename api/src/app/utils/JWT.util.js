const jwt = require("jsonwebtoken");
const { keys } = require("../config/init");

/** Access token: { sub, role, nickname }, 15 min. Scope is never embedded — see doc 04 §2. */
function signAccessToken({ sub, role, nickname }) {
  return jwt.sign({ sub, role, nickname }, keys.jwtPrivateKey, {
    algorithm: "RS256",
    expiresIn: keys.jwtAccessTtl,
  });
}

function signRefreshToken({ sub }) {
  return jwt.sign({ sub, typ: "refresh" }, keys.jwtPrivateKey, {
    algorithm: "RS256",
    expiresIn: keys.jwtRefreshTtl,
  });
}

/** Step-up token — see docs/backend/04-authorization.md §9. */
function signReauthToken({ sub }) {
  return jwt.sign({ sub, typ: "reauth" }, keys.jwtPrivateKey, {
    algorithm: "RS256",
    expiresIn: keys.reauthTtl,
  });
}

function verify(token) {
  return jwt.verify(token, keys.jwtPublicKey, { algorithms: ["RS256"] });
}

/** Decodes without verifying expiry — used by /auth/logout, which accepts a just-expired token. */
function decodeIgnoringExpiry(token) {
  return jwt.verify(token, keys.jwtPublicKey, { algorithms: ["RS256"], ignoreExpiration: true });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  signReauthToken,
  verify,
  decodeIgnoringExpiry,
};
