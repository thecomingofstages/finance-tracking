const ApiError = require("../utils/ApiError.util");
const fixtures = require("../../mocks/fixtures");

/**
 * Grep this file for `TODO(mock)` to find every spot returning fixture data instead of
 * querying Postgres. Endpoint numbers (#N) match docs/backend/03-api-spec.md §2.
 */
class ProjectHelper {
  /** #17 — GET /projects */
  static async list(_query) {
    // TODO(mock): scope to projects the caller belongs to unless finance/owner/admin (doc 03 §6).
    const rows = [fixtures.project(), fixtures.project({ name: "Merch Drop 2026" })];
    return { rows, meta: fixtures.pagination(rows.length) };
  }

  /** #18 — POST /projects */
  static async create({ name, description, allocated_budget }) {
    if (!name) throw ApiError.validation("name is required.", "name");
    // TODO(mock): insert the real row instead of echoing the input onto a fixture.
    return fixtures.project({ name, description, allocated_budget, total_income: 0, total_expense: 0 });
  }

  /** #19 — GET /projects/:id */
  static async getById(projectId) {
    // TODO(mock): load the real row, 404 if not found or soft-deleted.
    return fixtures.project({ _id: projectId });
  }

  /** #20 — PATCH /projects/:id */
  static async update(projectId, patch) {
    // Real already: total_income/total_expense are never client-writable, checked for real.
    if ("total_income" in patch || "total_expense" in patch) {
      throw ApiError.validation("total_income/total_expense are never client-writable.");
    }
    // TODO(mock): $set on the real row. Also write to a budget_changes audit table once
    // doc 05 open question #12 is answered — this route is the one financially material
    // edit with no audit trail right now, mock or not.
    return fixtures.project({ _id: projectId, ...patch });
  }

  /** #21 — DELETE /projects/:id */
  static async remove(_projectId) {
    // TODO(mock): 409 CONFLICT if any live tag/department/source/reimbursement references
    // it, else $set deleted_at. Currently always "succeeds".
    return null;
  }

  /** #22 — GET /projects/:id/tags */
  static async listTags(projectId) {
    // TODO(mock): query project_tag by project_id instead of two hardcoded fixtures.
    return [fixtures.tag({ project_id: projectId }), fixtures.tag({ project_id: projectId, name: "ค่าอาหาร", allocated_budget: 2000000 })];
  }

  /** #23 — POST /projects/:id/tags (bulk) */
  static async createTags(projectId, tags) {
    if (!Array.isArray(tags) || !tags.length) throw ApiError.validation("tags must be a non-empty array.", "tags");
    // TODO(mock): 409 DUPLICATE_TAG on a name collision within the project, then insert all
    // rows in one transaction — partial success on a bulk endpoint is a support burden.
    return tags.map((t) => fixtures.tag({ project_id: projectId, ...t, total_income: 0, total_expense: 0 }));
  }

  /** #24 — PATCH /tags/:id */
  static async updateTag(tagId, patch) {
    // TODO(mock): $set on the real row, 409 DUPLICATE_TAG on a colliding rename.
    return fixtures.tag({ _id: tagId, ...patch });
  }

  /** #25 — DELETE /tags/:id */
  static async removeTag(_tagId) {
    // TODO(mock): 409 CONFLICT if any live source/reimbursement references this tag.
    return null;
  }

  /** #26 — GET /projects/:id/departments */
  static async listDepartments(projectId) {
    // TODO(mock): query department by project_id instead of two hardcoded fixtures.
    return [fixtures.department({ project_id: projectId }), fixtures.department({ project_id: projectId, name: "ฝ่ายประชาสัมพันธ์", allocated_budget: 800000 })];
  }

  /** #27 — POST /projects/:id/departments (bulk) */
  static async createDepartments(projectId, departments) {
    if (!Array.isArray(departments) || !departments.length) {
      throw ApiError.validation("departments must be a non-empty array.", "departments");
    }
    // TODO(mock): 409 DUPLICATE_DEPARTMENT on a name collision, insert all in one transaction.
    return departments.map((d) => fixtures.department({ project_id: projectId, ...d, total_expense: 0 }));
  }

  /** #28 — PATCH /departments/:id */
  static async updateDepartment(deptId, patch) {
    // TODO(mock): $set on the real row, 409 DUPLICATE_DEPARTMENT on a colliding rename.
    return fixtures.department({ _id: deptId, ...patch });
  }

  /** #29 — DELETE /departments/:id */
  static async removeDepartment(_deptId) {
    // TODO(mock): 409 CONFLICT if anyone's still a member or it has live reimbursements.
    return null;
  }

  /** #30 — GET /projects/:id/staff */
  static async listStaff(_projectId) {
    // TODO(mock): join staff_dept -> staff for every department under this project instead
    // of two hardcoded people.
    return [
      { ...fixtures.staff(), department: "ฝ่ายเวที", is_head: true, is_finance: false, is_manager: false },
      { ...fixtures.staff({ nickname: "Nok" }), department: "ฝ่ายการเงิน", is_head: false, is_finance: true, is_manager: false },
    ];
  }
}

module.exports = ProjectHelper;
