const ApiError = require("../utils/ApiError.util");
const JWT = require("../utils/JWT.util");
const { fail } = require("../utils/Response.util");
const { app: appConf } = require("../config/init");
const { scope: mockScope } = require("../../mocks/fixtures");

/** Authorization: Bearer <access_token> — required, valid, not expired. */
function verifyJWT(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return fail(res, ApiError.unauthorized("Missing or malformed Authorization header."));
  }
  try {
    const payload = JWT.verify(token);
    req.auth = { staffId: payload.sub, role: payload.role, nickname: payload.nickname };
    return next();
  } catch (err) {
    const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_CREDENTIALS";
    return fail(res, ApiError.unauthorized("Invalid or expired token.", code));
  }
}

/**
 * Resolves req.auth into req.scope (doc 04 §2). MOCK_MODE returns a fixed, permissive scope
 * so every route is reachable without a real staff_dept table — real mode queries StaffDept.
 */
async function resolveScope(req, res, next) {
  if (appConf.mockMode) {
    req.scope = {
      staffId: req.auth.staffId,
      role: req.auth.role,
      isGlobal: ["finance", "owner", "admin"].includes(req.auth.role),
      // finance_of/manager_of are "*" so requireScope() below never blocks a route (it doesn't
      // actually check these in mock mode, but a future reader shouldn't have to know that).
      // head_of stays empty by default — Reimbursement.helper.js reads this directly to decide
      // the auto-verify path, and 'waiting' (not an auto-approved head_approve) is the more
      // representative default for FE to build against. Pass ?as_head=true on POST
      // /reimbursements to exercise the auto-verify path deliberately.
      ...mockScope({
        finance_of: ["*"],
        manager_of: ["*"],
        head_of: req.query.as_head === "true" ? ["*"] : [],
      }),
    };
    return next();
  }
  // TODO: real implementation — query StaffDept for req.auth.staffId, build memberships/
  // departments/headOf/financeOf/managerOf exactly as documented in doc 04 §2.
  return next(new Error("resolveScope: real (non-mock) implementation not wired up yet"));
}

/**
 * Declarative scope guard — doc 04 §3. `flag` is one of isHead/isFinance/isManager/isGlobal.
 * `resolveTargetId(req)` returns the project/department id to check the flag against.
 * MOCK_MODE always allows, since the mock scope claims "*" for every flag.
 *
 * Named requireScope, not `require` — a function literally named `require` hoists and shadows
 * Node's own module-scoped `require()` for the rest of this file, silently breaking every
 * import above it. Learned that the hard way in this file; don't reintroduce it.
 */
function requireScope(flag, _resolveTargetId) {
  return (req, res, next) => {
    if (appConf.mockMode) return next();
    // TODO: real implementation — check req.scope[flag+'Of'] (or isGlobal) includes the
    // resolved target id.
    return next(new Error(`requireScope(${flag}): real implementation not wired up yet`));
  };
}

/** X-Reauth-Token step-up check — doc 04 §9. Gates #40, #47, #60. */
function requireReauth(req, res, next) {
  const token = req.headers["x-reauth-token"];
  if (!token) return fail(res, new ApiError(401, "REAUTH_REQUIRED", "Re-enter your password to continue."));
  try {
    const payload = JWT.verify(token);
    if (payload.typ !== "reauth" || payload.sub !== req.auth?.staffId) {
      throw new Error("reauth token subject mismatch");
    }
    return next();
  } catch {
    return fail(res, new ApiError(401, "REAUTH_REQUIRED", "Re-enter your password to continue."));
  }
}

module.exports = { verifyJWT, resolveScope, requireScope, requireReauth };
