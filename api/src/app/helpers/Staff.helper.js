const { fn, col, where: sqlWhere, Op } = require("sequelize");
const ApiError = require("../utils/ApiError.util");
const R2 = require("../utils/R2.util");
const CSV = require("../utils/CSV.util");

/**
 * staff.email is plain TEXT UNIQUE, case-sensitive (doc 02 §6 gap #4) — lowercase both sides
 * ourselves. `paranoid: false` is deliberate, not a bug: the UNIQUE constraint isn't scoped to
 * `deleted_at IS NULL`, so a soft-deleted staff row still permanently occupies its email at the
 * DB level (doc 02 §6 gap #10) — Sequelize's default paranoid findOne would miss that row,
 * report the email as free, and then the real insert/update fails with a raw
 * SequelizeUniqueConstraintError (500) instead of a clean 409. Checking with paranoid:false
 * makes this match what the DB actually enforces. Shared by #10/#11/#12 below.
 */
function byEmail(email) {
  const { Staff } = require("../models");
  return Staff.findOne({
    where: sqlWhere(fn("lower", col("email")), String(email).toLowerCase()),
    paranoid: false,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toPlain(record) {
  if (!record) return record;
  return typeof record.toJSON === "function" ? record.toJSON() : { ...record };
}

function toSafeStaff(record) {
  if (typeof record.toSafeJSON === "function") return record.toSafeJSON();
  const { password_hash, ...safe } = toPlain(record);
  return safe;
}

function membershipJSON(record) {
  const membership = toPlain(record);
  const departmentRecord = record.department || membership.department;
  const department = toPlain(departmentRecord) || {};
  const project = toPlain(departmentRecord?.project || department.project) || {};
  return {
    staff_dept_id: membership._id,
    department_id: membership.department_id,
    department_name: department.name ?? null,
    project_id: department.project_id,
    project_name: project.name ?? null,
    is_head: Boolean(membership.is_head),
    is_finance: Boolean(membership.is_finance),
    is_manager: Boolean(membership.is_manager),
  };
}

function maskedNumber(number) {
  const value = String(number || "");
  return value.length > 4 ? `${"x".repeat(value.length - 4)}${value.slice(-4)}` : value;
}

function bankAccountJSON(record, { masked = false } = {}) {
  const { staff_id, deleted_at, ...account } = toPlain(record);
  return { ...account, number: masked ? maskedNumber(account.number) : account.number };
}

function staffWithRelationsJSON(record, { includeBankAccounts = false } = {}) {
  const safe = toSafeStaff(record);
  const memberships = record.memberships || safe.memberships || [];
  const bankAccounts = record.bankAccounts || safe.bankAccounts || [];
  delete safe.memberships;
  delete safe.bankAccounts;
  const result = { ...safe, memberships: memberships.map(membershipJSON) };
  if (includeBankAccounts) {
    result.bank_accounts = bankAccounts.map((account) => bankAccountJSON(account, { masked: true }));
  }
  return result;
}

function managerProjectIds(scope = {}) {
  return scope.manager_of || scope.managerOf || [];
}

/**
 * Endpoint numbers (#N) match docs/backend/03-api-spec.md §2. Staff/profile/bank-account
 * methods query Sequelize directly; MOCK_MODE only keeps the route-level scope guard
 * permissive until the shared StaffDept-backed authorization middleware is wired.
 */
class StaffHelper {
  /** #7 — GET /staff */
  static async list({ department_id, project_id, page = 1, limit = 20 }, scope = {}) {
    const managedProjects = managerProjectIds(scope);
    const managesEveryProject = managedProjects.includes("*");
    if (!managesEveryProject && !managedProjects.length) {
      throw ApiError.forbidden("You must manage at least one project to list staff.");
    }
    if (project_id && !managesEveryProject && !managedProjects.includes(project_id)) {
      throw ApiError.forbidden("You don't manage this project.", "NOT_PROJECT_MEMBER");
    }

    const { Staff, StaffDept, Department, Project } = require("../models");
    const departmentWhere = {};
    if (department_id) departmentWhere._id = department_id;
    if (project_id) departmentWhere.project_id = project_id;
    else if (!managesEveryProject) departmentWhere.project_id = { [Op.in]: managedProjects };

    const { rows, count } = await Staff.findAndCountAll({
      attributes: [
        "_id",
        "title",
        "first_name",
        "last_name",
        "nickname",
        "email",
        "phone",
        "line_id",
        "role",
        "signature_image",
        "created_at",
        "updated_at",
      ],
      include: [
        {
          model: StaffDept,
          as: "memberships",
          required: true,
          attributes: ["_id", "department_id", "is_head", "is_finance", "is_manager"],
          include: [
            {
              model: Department,
              as: "department",
              required: true,
              where: departmentWhere,
              attributes: ["_id", "project_id", "name"],
              include: [{ model: Project, as: "project", attributes: ["_id", "name"] }],
            },
          ],
        },
      ],
      distinct: true,
      order: [["first_name", "ASC"], ["last_name", "ASC"]],
      limit,
      offset: (page - 1) * limit,
    });

    return {
      rows: rows.map((staff) => staffWithRelationsJSON(staff)),
      meta: { page, limit, total: Array.isArray(count) ? count.length : count },
    };
  }

  /** #8 — GET /staff/:id */
  static async getById(staffId, scope = {}) {
    const { Staff, StaffDept, Department, Project, BankAccount } = require("../models");
    const staff = await Staff.findByPk(staffId, {
      include: [
        {
          model: StaffDept,
          as: "memberships",
          attributes: ["_id", "department_id", "is_head", "is_finance", "is_manager"],
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["_id", "project_id", "name"],
              include: [{ model: Project, as: "project", attributes: ["_id", "name"] }],
            },
          ],
        },
        { model: BankAccount, as: "bankAccounts" },
      ],
    });
    if (!staff) throw ApiError.notFound("Staff not found.");

    const managedProjects = managerProjectIds(scope);
    if (!managedProjects.includes("*")) {
      const targetProjects = (staff.memberships || [])
        .map((membership) => membership.department?.project_id)
        .filter(Boolean);
      if (!targetProjects.some((projectId) => managedProjects.includes(projectId))) {
        throw ApiError.forbidden("You don't manage a project this staff member belongs to.");
      }
    }

    return staffWithRelationsJSON(staff, { includeBankAccounts: true });
  }

  /** #9 — PATCH /staff/me */
  static async updateSelf(staffId, patch, scope) {
    const allowed = ["nickname", "phone", "line_id", "title"];
    const rejected = Object.keys(patch).filter((k) => !allowed.includes(k));
    if (rejected.length) throw ApiError.validation(`Field not editable here: ${rejected[0]}`, rejected[0]);
    const { Staff } = require("../models");
    const staff = await Staff.findByPk(staffId);
    if (!staff) throw ApiError.notFound("Staff not found.");
    staff.set(patch);
    await staff.save();
    return { ...toSafeStaff(staff), scope };
  }

  /** #10 — POST /admin/staff (doc 03 §5). Real: creates the identity only — no password_hash,
   *  staff set their own via POST /auth/claim (#57). Role check (`role === 'admin'`) happens
   *  in the route via requireRole("admin"), not here. */
  static async adminCreate(payload) {
    if (!payload.email || !payload.first_name || !payload.last_name || !payload.nickname) {
      throw ApiError.validation("first_name, last_name, nickname, and email are required.");
    }
    const { Staff } = require("../models");
    const existing = await byEmail(payload.email);
    if (existing) throw ApiError.conflict("A staff member with this email already exists.", "DUPLICATE_EMAIL");
    const staff = await Staff.create({
      title: payload.title || null,
      first_name: payload.first_name,
      last_name: payload.last_name,
      nickname: payload.nickname,
      email: payload.email,
      phone: payload.phone || null,
    });
    return staff.toSafeJSON();
  }

  /** #11 — POST /admin/staff/import (doc 03 §5). All-or-nothing: every row is validated (required
   *  fields, email format, duplicate-in-file, duplicate-against-live-staff, department_id
   *  existence) before anything is written; any failure returns the full per-row error list and
   *  inserts nothing. `department_id` is optional per-row (staff_dept was originally scoped as
   *  manual-only — see docs/backend/03-api-spec.md §5 — added here on request, 2026-07-27): a
   *  blank/missing value just means the staff row is created without a department, not an error. */
  static async adminImport(fileBuffer) {
    if (!fileBuffer) throw ApiError.validation("A CSV file is required.", "file");
    const { rows, errors: parseErrors } = CSV.parse(fileBuffer);
    if (!rows.length) throw ApiError.validation("CSV has no rows.", "file");

    const rowErrors = parseErrors.map((e) => ({ row: e.row, message: e.message }));
    const seenEmails = new Map(); // lowercase email -> 1-based row number

    rows.forEach((row, i) => {
      const rowNum = i + 1;
      for (const field of ["first_name", "last_name", "nickname", "email"]) {
        if (!row[field] || !String(row[field]).trim()) {
          rowErrors.push({ row: rowNum, message: `${field} is required.` });
        }
      }
      if (row.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          rowErrors.push({ row: rowNum, message: `Invalid email: ${row.email}` });
        } else {
          const key = row.email.toLowerCase();
          if (seenEmails.has(key)) {
            rowErrors.push({ row: rowNum, message: `Duplicate email in file: ${row.email} (also row ${seenEmails.get(key)})` });
          } else {
            seenEmails.set(key, rowNum);
          }
        }
      }
      if (row.department_id && row.department_id.trim() && !UUID_RE.test(row.department_id.trim())) {
        rowErrors.push({ row: rowNum, message: `department_id is not a valid UUID: ${row.department_id}` });
      }
    });

    const { Staff, StaffDept, Department, sequelize } = require("../models");

    if (rowErrors.length === 0 && seenEmails.size) {
      const existing = await Staff.findAll({
        where: sqlWhere(fn("lower", col("email")), { [Op.in]: [...seenEmails.keys()] }),
        attributes: ["email"],
      });
      for (const row of existing) {
        rowErrors.push({ row: seenEmails.get(row.email.toLowerCase()), message: `Email already exists: ${row.email}` });
      }
    }

    if (rowErrors.length === 0) {
      const deptIds = [...new Set(rows.map((r) => r.department_id?.trim()).filter(Boolean))];
      if (deptIds.length) {
        const found = await Department.findAll({ where: { _id: { [Op.in]: deptIds } }, attributes: ["_id"] });
        const foundIds = new Set(found.map((d) => d._id));
        rows.forEach((row, i) => {
          const id = row.department_id?.trim();
          if (id && !foundIds.has(id)) rowErrors.push({ row: i + 1, message: `department_id not found: ${id}` });
        });
      }
    }

    if (rowErrors.length) {
      throw ApiError.validationDetails(`${rowErrors.length} row(s) failed validation — nothing was imported.`, rowErrors);
    }

    const created = await sequelize.transaction(async (t) => {
      const staffRows = await Staff.bulkCreate(
        rows.map((row) => ({
          title: row.title || null,
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          nickname: row.nickname.trim(),
          email: row.email.trim(),
          phone: row.phone || null,
          line_id: row.line_id || null,
        })),
        { transaction: t, returning: true }
      );

      const staffDeptRows = rows
        .map((row, i) => ({ department_id: row.department_id?.trim(), staff_id: staffRows[i]._id }))
        .filter((r) => r.department_id);
      if (staffDeptRows.length) {
        await StaffDept.bulkCreate(staffDeptRows, { transaction: t });
      }

      return staffRows;
    });

    return { created: created.length, rows: created.map((s) => s.toSafeJSON()) };
  }

  /** #12 — PATCH /admin/staff/:id (doc 03 §5). `patch` is already zod-filtered to the allowed
   *  fields (nickname/phone/line_id/title/first_name/last_name/email/role) by the time it gets
   *  here — see Staff.schema.js's adminUpdate. */
  static async adminUpdate(staffId, patch) {
    const { Staff } = require("../models");
    const staff = await Staff.findByPk(staffId);
    if (!staff) throw ApiError.notFound("Staff not found.");
    if (patch.email) {
      const existing = await byEmail(patch.email);
      if (existing && existing._id !== staffId) {
        throw ApiError.conflict("A staff member with this email already exists.", "DUPLICATE_EMAIL");
      }
    }
    staff.set(patch);
    await staff.save();
    return staff.toSafeJSON();
  }

  /** #13 — DELETE /admin/staff/:id (doc 03 §5). Soft-delete only (paranoid:true sets
   *  deleted_at) — does not cascade to reimbursements/approvals already attributed to this
   *  staff member (intentional, not a gap). */
  static async adminDeactivate(staffId) {
    const { Staff } = require("../models");
    const staff = await Staff.findByPk(staffId);
    if (!staff) throw ApiError.notFound("Staff not found.");
    await staff.destroy();
    return null;
  }

  /** #14 — GET /staff/me/bank-accounts */
  static async listBankAccounts(staffId) {
    const { BankAccount } = require("../models");
    const accounts = await BankAccount.findAll({
      where: { staff_id: staffId },
      order: [["created_at", "ASC"]],
    });
    return accounts.map((account) => bankAccountJSON(account));
  }

  /** #15 — POST /staff/me/bank-accounts */
  static async addBankAccount(staffId, { name, number, provider }) {
    if (!name || !number || !provider) throw ApiError.validation("name, number, and provider are required.");
    const { BankAccount } = require("../models");
    const duplicate = await BankAccount.findOne({ where: { staff_id: staffId, number } });
    if (duplicate) {
      throw ApiError.conflict("You already have a live bank account with this number.", "DUPLICATE_BANK_ACCOUNT");
    }
    const account = await BankAccount.create({ staff_id: staffId, name, number, provider });
    return bankAccountJSON(account);
  }

  /** #16 — DELETE /staff/me/bank-accounts/:id */
  static async removeBankAccount(staffId, accountId) {
    const { BankAccount } = require("../models");
    const account = await BankAccount.findByPk(accountId);
    if (!account) throw ApiError.notFound("Bank account not found.");
    if (account.staff_id !== staffId) throw ApiError.forbidden("This bank account belongs to another staff member.");
    await account.destroy();
    return null;
  }

  /** #60 — POST /staff/me/signature. Already real, not mocked — genuinely uploads to R2 and
   *  returns a real presigned URL (see api/README.md, "R2 storage" is decoupled from
   *  MOCK_MODE). Only the "$set staff.signature_image" write-back is still missing. */
  static async uploadSignature(staffId, file) {
    if (!file) throw ApiError.validation("signature file is required.", "signature");
    const key = R2.buildKey("signatures", staffId, "png");
    await R2.upload("signatures", key, file.buffer, file.mimetype);
    // TODO(mock): $set staff.signature_image = key on the real Staff row. The R2 upload
    // itself above needs no changes when this goes real.
    return { signature_image: await R2.presignedUrl("signatures", key) };
  }
}

module.exports = StaffHelper;
