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

/** Lazy require — same reasoning as Auth.helper.js: requiring this file must not force model
 *  init (and a DB dial) before index.js has decided whether to connect. In MOCK_MODE the real
 *  branch never runs, so models are never resolved. */
function models() {
  return require("../models");
}

/** Roles that see everything, regardless of staff_dept membership. Configurable via
 *  GLOBAL_ROLES — see app.conf.js for why doc 04 leaves this genuinely ambiguous. */
function isGlobalRole(role) {
  return appConf.globalRoles.includes(String(role || "").toLowerCase());
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
      isGlobal: isGlobalRole(req.auth.role),
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
  /* Real mode. One indexed query on staff_dept, joined up to department → project, per
   * request — deliberately not cached and deliberately not in the JWT (doc 04 §2: a promotion
   * or, worse, a revocation must take effect immediately, not at token expiry).
   *
   * Key shape matches src/mocks/fixtures.js scope() exactly — snake_case arrays and
   * memberships[].is_head, camelCase staffId/role/isGlobal at the top. GET /auth/me hands
   * req.scope straight to the browser, and web/src/context/AuthContext.tsx reads those names.
   * Doc 04 §2's camelCase (headOf/financeOf/managerOf) was never what shipped; the doc has
   * been corrected rather than the wire format. */
  try {
    const { StaffDept, Department, Project } = models();

    // required: true on both joins — a membership whose department or project has been
    // soft-deleted grants nothing. StaffDept is itself paranoid (deleted_at = leave time),
    // so rows for departments the staff member has left are already excluded by default scope.
    const rows = await StaffDept.findAll({
      where: { staff_id: req.auth.staffId },
      include: [
        {
          model: Department,
          as: "department",
          required: true,
          attributes: ["_id", "name", "project_id"],
          include: [{ model: Project, as: "project", required: true, attributes: ["_id", "name"] }],
        },
      ],
    });

    const memberships = rows.map((row) => ({
      staff_dept_id: row._id,
      project_id: row.department.project_id,
      project_name: row.department.project.name,
      department_id: row.department._id,
      department_name: row.department.name,
      is_head: Boolean(row.is_head),
      is_finance: Boolean(row.is_finance),
      is_manager: Boolean(row.is_manager),
    }));

    const distinct = (values) => [...new Set(values)];

    req.scope = {
      staffId: req.auth.staffId,
      role: req.auth.role,
      isGlobal: isGlobalRole(req.auth.role),
      memberships,
      departments: distinct(memberships.map((m) => m.department_id)),
      // head_of is department-scoped; finance_of/manager_of are project-scoped (doc 04 §2).
      // is_finance/is_manager are stored per (staff, department) row, so being finance of any
      // one department promotes to finance of that whole project — the tension already noted
      // in Reimbursement.helper.js:16, resolved here the way doc 04 §3's matrix reads it.
      head_of: distinct(memberships.filter((m) => m.is_head).map((m) => m.department_id)),
      finance_of: distinct(memberships.filter((m) => m.is_finance).map((m) => m.project_id)),
      manager_of: distinct(memberships.filter((m) => m.is_manager).map((m) => m.project_id)),
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * `list` holds the ids the caller has this flag on. A concrete `targetId` must appear in it;
 * `undefined` (a route with no project context — see ScopeTarget.util.js) degrades to "holds
 * this flag on at least one project".
 */
function holds(list, targetId) {
  return targetId === undefined ? list.length > 0 : list.includes(targetId);
}

/**
 * Every flag used at a route definition, resolved against req.scope. Anything not listed here
 * is rejected at boot rather than at request time — see requireScope below.
 *
 * The four composite flags aren't in doc 04 §2's scope object; they come from §3's permission
 * matrix, which grants some capabilities to a role OR a local flag ("Create / delete a project
 * — finance, admin"). isGlobal is not listed: requireScope short-circuits on it before
 * consulting this table, so reaching a predicate at all means the caller is not global.
 */
const SCOPE_FLAGS = {
  // head_of holds DEPARTMENT ids; the other two hold PROJECT ids (doc 04 §2).
  isHead: (scope, id) => holds(scope.head_of, id),
  isFinance: (scope, id) => holds(scope.finance_of, id),
  isManager: (scope, id) => holds(scope.manager_of, id),
  isMember: (scope, id) =>
    id === undefined
      ? scope.memberships.length > 0
      : scope.memberships.some((m) => m.project_id === id || m.department_id === id),
  isFinanceOrOwner: (scope, id) => scope.role === "owner" || holds(scope.finance_of, id),
  isFinanceOrAdmin: (scope, id) => scope.role === "admin" || holds(scope.finance_of, id),
  isManagerOrFinance: (scope, id) =>
    holds(scope.manager_of, id) || holds(scope.finance_of, id),
  // Reachable only when scope.isGlobal is false, which is exactly when this flag must deny.
  isGlobal: () => false,
};

/**
 * Declarative scope guard — doc 04 §3. `flag` is a key of SCOPE_FLAGS above.
 * `resolveTargetId(req)` returns the project (or, for isHead, department) id to check it
 * against; see ScopeTarget.util.js for the resolvers and for why omitting one is meaningful
 * rather than sloppy. MOCK_MODE always allows, since the mock scope claims "*" for every flag.
 *
 * Named requireScope, not `require` — a function literally named `require` hoists and shadows
 * Node's own module-scoped `require()` for the rest of this file, silently breaking every
 * import above it. Learned that the hard way in this file; don't reintroduce it.
 */
function requireScope(flag, resolveTargetId) {
  const predicate = SCOPE_FLAGS[flag];
  // Thrown at import time, i.e. the server refuses to boot. A typo'd flag name must never be
  // able to reach production as a runtime 500 — or, worse, as a guard that quietly allows.
  if (!predicate) {
    throw new Error(
      `requireScope: unknown flag "${flag}". Known flags: ${Object.keys(SCOPE_FLAGS).join(", ")}`
    );
  }
  return async (req, res, next) => {
    if (appConf.mockMode) return next();
    try {
      if (!req.scope) {
        return next(new Error(`requireScope("${flag}") ran before resolveScope — check the route`));
      }
      // finance/owner/admin (configurable, see GLOBAL_ROLES) bypass local membership entirely.
      if (req.scope.isGlobal) return next();

      const targetId = resolveTargetId ? await resolveTargetId(req) : undefined;
      if (predicate(req.scope, targetId)) return next();

      return fail(
        res,
        ApiError.forbidden(
          targetId === undefined
            ? "You don't have permission to do this."
            : "You don't have permission to do this in this project."
        )
      );
    } catch (err) {
      return next(err);
    }
  };
}

/**
 * Plain role check straight off the JWT payload (verifyJWT already put it on req.auth) — real
 * regardless of MOCK_MODE, since it needs no DB/scope lookup. Stricter than
 * requireScope("isGlobal") (which covers finance/owner/admin and is still mock-gated pending
 * the StaffDept-backed scope system) — use this where the spec calls for exactly one role, e.g.
 * doc 03 §5's `/admin/staff` routes ("Verify role === 'admin'. 403 otherwise.").
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
