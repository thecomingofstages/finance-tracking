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
 * so every route is reachable without a real staff_dept table — real mode queries StaffDept
 * for real, joined up to department -> project.
 *
 * isGlobal matches the mock's own contract exactly (finance/owner/admin, not just owner/admin
 * as doc 04 §2's comment says) — FE has been built against the mock's permissive behavior all
 * along, so this makes the real path match what was already promised, not tighten it as a
 * surprise side effect. If that's wrong, it's a product decision to revisit, not something to
 * silently change here.
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

  try {
    const { StaffDept, Department } = require("../models");
    const rows = await StaffDept.findAll({
      where: { staff_id: req.auth.staffId },
      include: [{ model: Department, as: "department" }],
    });
    const memberships = rows.map((r) => ({
      staffDeptId: r._id,
      departmentId: r.department_id,
      projectId: r.department.project_id,
      isHead: r.is_head,
      isFinance: r.is_finance,
      isManager: r.is_manager,
    }));
    req.scope = {
      staffId: req.auth.staffId,
      role: req.auth.role,
      memberships,
      departments: memberships.map((m) => m.departmentId),
      headOf: memberships.filter((m) => m.isHead).map((m) => m.departmentId),
      financeOf: [...new Set(memberships.filter((m) => m.isFinance).map((m) => m.projectId))],
      managerOf: [...new Set(memberships.filter((m) => m.isManager).map((m) => m.projectId))],
      isGlobal: ["finance", "owner", "admin"].includes(req.auth.role),
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

function scopeIncludes(list, targetId) {
  // No target to check against (a bulk/global-ish route with nothing to resolve) -> fall back
  // to "holds this flag anywhere at all", the coarse role-shaped check doc 04 §1 describes.
  // Routes that need real per-target precision on a bulk action (e.g. #40 payments/approve)
  // already do their own direct StaffDept query inside the helper — this is a defense-in-depth
  // outer gate, not the only check.
  return targetId ? list.includes(targetId) : list.length > 0;
}

/**
 * Flag -> check function. Every flag actually used across routes/*.js today, not just doc 04
 * §3's base four — the compound ones (isFinanceOrAdmin etc.) are read literally from their own
 * names: global (isGlobal) OR the named project-scoped flag(s).
 */
const FLAG_CHECKS = {
  isHead: (scope, targetId) => scopeIncludes(scope.headOf, targetId),
  isFinance: (scope, targetId) => scopeIncludes(scope.financeOf, targetId),
  isManager: (scope, targetId) => scopeIncludes(scope.managerOf, targetId),
  isMember: (scope, targetId) =>
    targetId ? scope.memberships.some((m) => m.projectId === targetId) : scope.memberships.length > 0,
  isGlobal: (scope) => scope.isGlobal,
  isFinanceOrAdmin: (scope, targetId) => scope.isGlobal || scopeIncludes(scope.financeOf, targetId),
  isManagerOrFinance: (scope, targetId) =>
    scope.isGlobal || scopeIncludes(scope.managerOf, targetId) || scopeIncludes(scope.financeOf, targetId),
  isFinanceOrOwner: (scope, targetId) => scope.isGlobal || scopeIncludes(scope.financeOf, targetId),
};

/**
 * Declarative scope guard — doc 04 §3. `flag` is one of the keys in FLAG_CHECKS above.
 * `resolveTargetId(req)` returns the project/department id to check the flag against — may be
 * async (it's awaited), for routes where the id in the URL isn't already that target (e.g. a
 * tag/source/department id that needs a DB lookup to find its project). Defaults to
 * `req.params.id` when no resolver is given, which is already correct for every route
 * nested directly under /projects/:id/... or acting on the project itself.
 * MOCK_MODE always allows, since the mock scope claims "*" for every flag.
 *
 * Named requireScope, not `require` — a function literally named `require` hoists and shadows
 * Node's own module-scoped `require()` for the rest of this file, silently breaking every
 * import above it. Learned that the hard way in this file; don't reintroduce it.
 */
function requireScope(flag, resolveTargetId) {
  return async (req, res, next) => {
    if (appConf.mockMode) return next();
    const check = FLAG_CHECKS[flag];
    if (!check) return next(new Error(`requireScope: unknown flag '${flag}'`));
    try {
      const targetId = resolveTargetId ? await resolveTargetId(req) : req.params.id;
      if (!check(req.scope, targetId)) {
        return fail(res, ApiError.forbidden());
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * Plain role check straight off the JWT payload (verifyJWT already put it on req.auth) — real
 * regardless of MOCK_MODE, since it needs no DB/scope lookup. Stricter than
 * requireScope("isGlobal") (which covers finance/owner/admin) — use this where the spec calls
 * for exactly one role, e.g. doc 03 §5's `/admin/staff` routes ("Verify role === 'admin'. 403
 * otherwise.").
 */
function requireRole(role) {
  return (req, res, next) => {
    if (req.auth?.role !== role) {
      return fail(res, ApiError.forbidden(`Requires the ${role} role.`));
    }
    return next();
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

module.exports = { verifyJWT, resolveScope, requireScope, requireRole, requireReauth };
