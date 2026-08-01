const { Op } = require("sequelize");
const ApiError = require("../utils/ApiError.util");
const { db } = require("../config/init");
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

  /** #18 — POST /projects (doc 03 §6). Real. Access control (finance/admin) still goes
   *  through requireScope("isFinanceOrAdmin"), which is mock-permissive pending the
   *  StaffDept-backed scope system — same gap as GET /auth/me's `scope`, not specific to
   *  this endpoint. */
  static async create({ name, description, allocated_budget }) {
    if (!name) throw ApiError.validation("name is required.", "name");
    const { Project } = require("../models");
    const project = await Project.create({
      name,
      description: description ?? null,
      allocated_budget: allocated_budget ?? 0,
    });
    return project.toJSON();
  }

  /** #19 — GET /projects/:id */
  static async getById(projectId) {
    // TODO(mock): load the real row, 404 if not found or soft-deleted.
    return fixtures.project({ _id: projectId });
  }

  /** #20 — PATCH /projects/:id (doc 03 §6). Real. Still no budget_changes audit table (doc 05
   *  open question #12 unanswered) — this stays the one financially material edit with no
   *  audit trail, real or mock. */
  static async update(projectId, patch) {
    // Real already: total_income/total_expense are never client-writable, checked for real.
    if ("total_income" in patch || "total_expense" in patch) {
      throw ApiError.validation("total_income/total_expense are never client-writable.");
    }
    const { Project } = require("../models");
    const project = await Project.findByPk(projectId);
    if (!project) throw ApiError.notFound("Project not found.");
    project.set(patch);
    await project.save();
    return project.toJSON();
  }

  /** #21 — DELETE /projects/:id (doc 03 §6). Real: 409 if any live tag/department/source/
   *  reimbursement still references it — reimbursement is checked transitively (via
   *  staff_dept -> department), the other three have a direct project_id FK. */
  static async remove(projectId) {
    const { Project, ProjectTag, Department, Source, sequelize } = require("../models");
    const project = await Project.findByPk(projectId);
    if (!project) throw ApiError.notFound("Project not found.");

    const [tagCount, deptCount, sourceCount, liveReimbursement] = await Promise.all([
      ProjectTag.count({ where: { project_id: projectId } }),
      Department.count({ where: { project_id: projectId } }),
      Source.count({ where: { project_id: projectId } }),
      sequelize.query(
        `SELECT 1 FROM ${db.schema}.reimbursement r
         JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id
         JOIN ${db.schema}.department d ON d._id = sd.department_id
         WHERE d.project_id = :projectId AND r.deleted_at IS NULL
         LIMIT 1`,
        { replacements: { projectId }, type: sequelize.QueryTypes.SELECT }
      ),
    ]);
    if (tagCount || deptCount || sourceCount || liveReimbursement.length) {
      throw ApiError.conflict(
        "Can't delete a project that still has tags, departments, sources, or reimbursements attached.",
        "PROJECT_HAS_DEPENDENTS"
      );
    }
    await project.destroy();
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

  /** #24 — PATCH /tags/:id (doc 03 §6). Real. No UNIQUE constraint on project_tag.name at the
   *  DB level — DUPLICATE_TAG is an application-level rule, not a DB one. */
  static async updateTag(tagId, patch) {
    const { ProjectTag } = require("../models");
    const tag = await ProjectTag.findByPk(tagId);
    if (!tag) throw ApiError.notFound("Tag not found.");
    if (patch.name) {
      const dup = await ProjectTag.findOne({
        where: { project_id: tag.project_id, name: patch.name, _id: { [Op.ne]: tagId } },
      });
      if (dup) throw ApiError.conflict("A tag with this name already exists in this project.", "DUPLICATE_TAG");
    }
    tag.set(patch);
    await tag.save();
    return tag.toJSON();
  }

  /** #25 — DELETE /tags/:id (doc 03 §6). Real: 409 if any live source or reimbursement still
   *  references it — both have a direct tag_id FK. */
  static async removeTag(tagId) {
    const { ProjectTag, Source, Reimbursement } = require("../models");
    const tag = await ProjectTag.findByPk(tagId);
    if (!tag) throw ApiError.notFound("Tag not found.");
    const [sourceCount, reimbursementCount] = await Promise.all([
      Source.count({ where: { tag_id: tagId } }),
      Reimbursement.count({ where: { tag_id: tagId } }),
    ]);
    if (sourceCount || reimbursementCount) {
      throw ApiError.conflict("Can't delete a tag that's still used by a source or reimbursement.", "TAG_HAS_DEPENDENTS");
    }
    await tag.destroy();
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

  /** #28 — PATCH /departments/:id (doc 03 §6). Real. Same reasoning as updateTag — no DB-level
   *  UNIQUE on department.name, DUPLICATE_DEPARTMENT is an application rule. */
  static async updateDepartment(deptId, patch) {
    const { Department } = require("../models");
    const dept = await Department.findByPk(deptId);
    if (!dept) throw ApiError.notFound("Department not found.");
    if (patch.name) {
      const dup = await Department.findOne({
        where: { project_id: dept.project_id, name: patch.name, _id: { [Op.ne]: deptId } },
      });
      if (dup) throw ApiError.conflict("A department with this name already exists in this project.", "DUPLICATE_DEPARTMENT");
    }
    dept.set(patch);
    await dept.save();
    return dept.toJSON();
  }

  /** #29 — DELETE /departments/:id (doc 03 §6). Real: 409 if anyone's still a member (live
   *  staff_dept row) or it has live reimbursements (checked transitively via staff_dept,
   *  since a reimbursement can outlive the membership that created it — see doc 02's
   *  staff_dept_id orphaning note). */
  static async removeDepartment(deptId) {
    const { Department, StaffDept, sequelize } = require("../models");
    const dept = await Department.findByPk(deptId);
    if (!dept) throw ApiError.notFound("Department not found.");
    const [memberCount, liveReimbursement] = await Promise.all([
      StaffDept.count({ where: { department_id: deptId } }),
      sequelize.query(
        `SELECT 1 FROM ${db.schema}.reimbursement r
         JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id
         WHERE sd.department_id = :deptId AND r.deleted_at IS NULL
         LIMIT 1`,
        { replacements: { deptId }, type: sequelize.QueryTypes.SELECT }
      ),
    ]);
    if (memberCount || liveReimbursement.length) {
      throw ApiError.conflict("Can't delete a department that still has members or live reimbursements.", "DEPARTMENT_HAS_DEPENDENTS");
    }
    await dept.destroy();
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
