const { Op } = require("sequelize");
const ApiError = require("../utils/ApiError.util");
const { db } = require("../config/init");

function toPlain(record) {
  return typeof record?.toJSON === "function" ? record.toJSON() : record;
}

async function ensureProject(Project, projectId, options) {
  const project = await Project.findByPk(projectId, options);
  if (!project) throw ApiError.notFound("Project not found.");
  return project;
}

function duplicateIndex(items) {
  const seen = new Set();
  return items.findIndex(({ name }) => {
    if (seen.has(name)) return true;
    seen.add(name);
    return false;
  });
}

function throwDuplicate(kind, field, index) {
  const code = kind === "tag" ? "DUPLICATE_TAG" : "DUPLICATE_DEPARTMENT";
  const error = ApiError.conflict(`A ${kind} with this name already exists in this project.`, code);
  error.field = `${field}.${index}.name`;
  throw error;
}

function hasGlobalProjectAccess(scope = {}) {
  return (
    scope.isGlobal ||
    scope.financeOf?.includes("*") ||
    scope.finance_of?.includes("*") ||
    scope.managerOf?.includes("*") ||
    scope.manager_of?.includes("*")
  );
}

function scopedProjectIds(scope = {}) {
  return [
    ...(scope.memberships || []).map((membership) => membership.projectId ?? membership.project_id),
    ...(scope.financeOf || scope.finance_of || []),
    ...(scope.managerOf || scope.manager_of || []),
  ].filter((projectId) => projectId && projectId !== "*");
}

/** Endpoint numbers (#N) match docs/backend/03-api-spec.md §2. */
class ProjectHelper {
  /** #17 — GET /projects */
  static async list({ page = 1, limit = 20 }, scope) {
    const { Project } = require("../models");
    const where = hasGlobalProjectAccess(scope)
      ? undefined
      : { _id: { [Op.in]: [...new Set(scopedProjectIds(scope))] } };
    const { rows, count } = await Project.findAndCountAll({
      attributes: ["_id", "name", "allocated_budget", "total_income", "total_expense"],
      ...(where && { where }),
      order: [["created_at", "DESC"], ["_id", "ASC"]],
      limit,
      offset: (page - 1) * limit,
    });
    return { rows: rows.map(toPlain), meta: { page, limit, total: count } };
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
    const { Project } = require("../models");
    return toPlain(await ensureProject(Project, projectId));
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
    const { Project, ProjectTag } = require("../models");
    await ensureProject(Project, projectId);
    const rows = await ProjectTag.findAll({
      where: { project_id: projectId },
      order: [["name", "ASC"], ["_id", "ASC"]],
    });
    return rows.map(toPlain);
  }

  /** #23 — POST /projects/:id/tags (bulk) */
  static async createTags(projectId, tags) {
    if (!Array.isArray(tags) || !tags.length) throw ApiError.validation("tags must be a non-empty array.", "tags");
    const repeatedAt = duplicateIndex(tags);
    if (repeatedAt >= 0) throwDuplicate("tag", "tags", repeatedAt);

    const { Project, ProjectTag, sequelize } = require("../models");
    return sequelize.transaction(async (transaction) => {
      await ensureProject(Project, projectId, { transaction });
      const names = tags.map(({ name }) => name);
      const existing = await ProjectTag.findAll({
        attributes: ["name"],
        where: { project_id: projectId, name: { [Op.in]: names } },
        transaction,
      });
      if (existing.length) {
        const existingNames = new Set(existing.map((tag) => toPlain(tag).name));
        throwDuplicate("tag", "tags", tags.findIndex(({ name }) => existingNames.has(name)));
      }
      const rows = await ProjectTag.bulkCreate(
        tags.map(({ name, allocated_budget = 0 }) => ({
          project_id: projectId,
          name,
          allocated_budget,
          total_income: 0,
          total_expense: 0,
        })),
        { transaction, returning: true }
      );
      return rows.map(toPlain);
    });
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
    const { Project, Department } = require("../models");
    await ensureProject(Project, projectId);
    const rows = await Department.findAll({
      where: { project_id: projectId },
      order: [["name", "ASC"], ["_id", "ASC"]],
    });
    return rows.map(toPlain);
  }

  /** #27 — POST /projects/:id/departments (bulk) */
  static async createDepartments(projectId, departments) {
    if (!Array.isArray(departments) || !departments.length) {
      throw ApiError.validation("departments must be a non-empty array.", "departments");
    }
    const repeatedAt = duplicateIndex(departments);
    if (repeatedAt >= 0) throwDuplicate("department", "departments", repeatedAt);

    const { Project, Department, sequelize } = require("../models");
    return sequelize.transaction(async (transaction) => {
      await ensureProject(Project, projectId, { transaction });
      const names = departments.map(({ name }) => name);
      const existing = await Department.findAll({
        attributes: ["name"],
        where: { project_id: projectId, name: { [Op.in]: names } },
        transaction,
      });
      if (existing.length) {
        const existingNames = new Set(existing.map((department) => toPlain(department).name));
        throwDuplicate(
          "department",
          "departments",
          departments.findIndex(({ name }) => existingNames.has(name))
        );
      }
      const rows = await Department.bulkCreate(
        departments.map(({ name, allocated_budget = 0 }) => ({
          project_id: projectId,
          name,
          allocated_budget,
          total_expense: 0,
        })),
        { transaction, returning: true }
      );
      return rows.map(toPlain);
    });
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
  static async listStaff(projectId) {
    const { Project, StaffDept, Department, Staff } = require("../models");
    await ensureProject(Project, projectId);
    const memberships = await StaffDept.findAll({
      attributes: ["_id", "staff_id", "department_id", "is_head", "is_finance", "is_manager"],
      include: [
        {
          model: Department,
          as: "department",
          required: true,
          attributes: ["_id", "name"],
          where: { project_id: projectId },
        },
        {
          model: Staff,
          as: "staff",
          required: true,
          attributes: ["_id", "title", "first_name", "last_name", "nickname"],
        },
      ],
      order: [["department_id", "ASC"], ["staff_id", "ASC"]],
    });
    return memberships.map((membership) => {
      const row = toPlain(membership);
      return {
        _id: row.staff._id,
        title: row.staff.title,
        first_name: row.staff.first_name,
        last_name: row.staff.last_name,
        nickname: row.staff.nickname,
        department_id: row.department_id,
        department: row.department.name,
        is_head: row.is_head,
        is_finance: row.is_finance,
        is_manager: row.is_manager,
      };
    });
  }
}

module.exports = ProjectHelper;
