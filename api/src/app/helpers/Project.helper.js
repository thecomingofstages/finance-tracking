const ApiError = require("../utils/ApiError.util");
const fixtures = require("../../mocks/fixtures");

class ProjectHelper {
  static async list(_query) {
    const rows = [fixtures.project(), fixtures.project({ name: "Merch Drop 2026" })];
    return { rows, meta: fixtures.pagination(rows.length) };
  }

  static async create({ name, description, allocated_budget }) {
    if (!name) throw ApiError.validation("name is required.", "name");
    return fixtures.project({ name, description, allocated_budget, total_income: 0, total_expense: 0 });
  }

  static async getById(projectId) {
    return fixtures.project({ _id: projectId });
  }

  static async update(projectId, patch) {
    if ("total_income" in patch || "total_expense" in patch) {
      throw ApiError.validation("total_income/total_expense are never client-writable.");
    }
    // TODO: write to budget_changes once doc 05 open question #12 lands.
    return fixtures.project({ _id: projectId, ...patch });
  }

  static async remove(_projectId) {
    // TODO: 409 CONFLICT if any live tag/department/source/reimbursement references it.
    return null;
  }

  static async listTags(projectId) {
    return [fixtures.tag({ project_id: projectId }), fixtures.tag({ project_id: projectId, name: "ค่าอาหาร", allocated_budget: 2000000 })];
  }

  static async createTags(projectId, tags) {
    if (!Array.isArray(tags) || !tags.length) throw ApiError.validation("tags must be a non-empty array.", "tags");
    return tags.map((t) => fixtures.tag({ project_id: projectId, ...t, total_income: 0, total_expense: 0 }));
  }

  static async updateTag(tagId, patch) {
    return fixtures.tag({ _id: tagId, ...patch });
  }

  static async removeTag(_tagId) {
    return null;
  }

  static async listDepartments(projectId) {
    return [fixtures.department({ project_id: projectId }), fixtures.department({ project_id: projectId, name: "ฝ่ายประชาสัมพันธ์", allocated_budget: 800000 })];
  }

  static async createDepartments(projectId, departments) {
    if (!Array.isArray(departments) || !departments.length) {
      throw ApiError.validation("departments must be a non-empty array.", "departments");
    }
    return departments.map((d) => fixtures.department({ project_id: projectId, ...d, total_expense: 0 }));
  }

  static async updateDepartment(deptId, patch) {
    return fixtures.department({ _id: deptId, ...patch });
  }

  static async removeDepartment(_deptId) {
    return null;
  }

  static async listStaff(_projectId) {
    return [
      { ...fixtures.staff(), department: "ฝ่ายเวที", is_head: true, is_finance: false, is_manager: false },
      { ...fixtures.staff({ nickname: "Nok" }), department: "ฝ่ายการเงิน", is_head: false, is_finance: true, is_manager: false },
    ];
  }
}

module.exports = ProjectHelper;
