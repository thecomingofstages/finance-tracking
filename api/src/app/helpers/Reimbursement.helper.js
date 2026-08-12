const { Op, fn, col, where: sqlWhere } = require("sequelize");
const ApiError = require("../utils/ApiError.util");
const R2 = require("../utils/R2.util");
const CSV = require("../utils/CSV.util");
const { ApprovalHelper } = require("./Approval.helper");
const { db } = require("../config/init");
const EDITABLE_STATUSES = new Set(["waiting", "rejected"]);
const STAFF_SUMMARY_ATTRIBUTES = ["_id", "title", "first_name", "last_name", "nickname", "email"];
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

function toPlain(record) {
  if (!record) return record;
  return typeof record.toJSON === "function" ? record.toJSON() : { ...record };
}

function safeStaff(record) {
  const staff = toPlain(record);
  if (!staff) return null;
  return Object.fromEntries(
    STAFF_SUMMARY_ATTRIBUTES.filter((key) => staff[key] !== undefined).map((key) => [key, staff[key]])
  );
}

function maskedNumber(number) {
  const value = String(number || "");
  return value.length > 4 ? `${"x".repeat(value.length - 4)}${value.slice(-4)}` : value;
}

function scopeValues(scope = {}, camelKey, snakeKey) {
  return [...new Set([...(scope[camelKey] || []), ...(scope[snakeKey] || [])])];
}

function scopeCovers(values, targetId, { wildcard = true } = {}) {
  return values.includes(targetId) || (wildcard && values.includes("*"));
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function assertEditable(status, message = "Only editable while waiting or rejected.") {
  if (!EDITABLE_STATUSES.has(status)) throw new ApiError(422, "INVALID_TRANSITION", message);
}

function reimbursementAmount(record) {
  const plain = toPlain(record);
  const details = record?.details || plain?.details || [];
  return details.reduce((sum, detail) => sum + Number(toPlain(detail).amount || 0), 0);
}

function listItem(record) {
  const plain = toPlain(record);
  const membership = toPlain(record.staffDept || plain.staffDept) || {};
  const departmentRecord = record.staffDept?.department || membership.department;
  const department = toPlain(departmentRecord) || {};
  const project = toPlain(departmentRecord?.project || department.project) || {};
  const requester = safeStaff(record.staffDept?.staff || membership.staff);

  return {
    _id: plain._id,
    staff_dept_id: plain.staff_dept_id,
    tag_id: plain.tag_id,
    purpose: plain.purpose,
    title: plain.purpose,
    tracking_id: plain.tracking_id,
    banking_id: plain.banking_id,
    latest_status: plain.latest_status,
    status: plain.latest_status,
    amount: reimbursementAmount(record),
    department_id: membership.department_id,
    department_name: department.name ?? null,
    project_id: department.project_id,
    project_name: project.name ?? null,
    requester,
    requester_name: requester ? `${requester.first_name || ""} ${requester.last_name || ""}`.trim() : null,
    tag: toPlain(record.tag || plain.tag) || null,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

async function budgetProjection(department, candidateAmount, excludeReimbursementId) {
  const { sequelize } = require("../models");
  const excludeClause = excludeReimbursementId ? "AND r._id <> :excludeReimbursementId" : "";
  const replacements = { departmentId: department._id };
  if (excludeReimbursementId) replacements.excludeReimbursementId = excludeReimbursementId;

  const [row = { used: 0 }] = await sequelize.query(
    `SELECT COALESCE(SUM(rd.amount), 0)::int AS used
     FROM ${db.schema}.reimbursement_detail rd
     JOIN ${db.schema}.reimbursement r ON r._id = rd.reimbursement_id
     JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id
     WHERE sd.department_id = :departmentId
       AND r.latest_status NOT IN ('rejected', 'delete')
       AND r.deleted_at IS NULL AND rd.deleted_at IS NULL
       ${excludeClause}`,
    { replacements, type: sequelize.QueryTypes.SELECT }
  );

  const used = Number(row.used || 0);
  const allocated = Number(department.allocated_budget || 0);
  const projected = used + Number(candidateAmount || 0);
  return {
    department_allocated: allocated,
    department_used: used,
    would_exceed: projected > allocated,
    over_by: Math.max(0, projected - allocated),
  };
}

function detectReceipt(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { extension: "pdf", contentType: "application/pdf" };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { extension: "png", contentType: "image/png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  return null;
}

async function detailJSON(record, { canSeeFullBankAccount = false } = {}) {
  const plain = toPlain(record);
  const membershipRecord = record.staffDept || plain.staffDept;
  const membership = toPlain(membershipRecord);
  const bankRecord = record.bankAccount || plain.bankAccount;
  const bankAccount = toPlain(bankRecord);
  const historyRecords = record.history || plain.history || [];
  const receiptLink = plain.receipt_link ? await R2.presignedUrl("receipts", plain.receipt_link) : null;

  if (membership) membership.staff = safeStaff(membershipRecord?.staff || membership.staff);
  if (bankAccount) {
    delete bankAccount.staff_id;
    delete bankAccount.deleted_at;
    bankAccount.number = canSeeFullBankAccount ? bankAccount.number : maskedNumber(bankAccount.number);
  }

  return {
    ...plain,
    receipt_link: receiptLink,
    staffDept: membership || undefined,
    bankAccount: bankAccount || undefined,
    history: historyRecords.map((entryRecord) => {
      const entry = toPlain(entryRecord);
      return { ...entry, staff: safeStaff(entryRecord.staff || entry.staff) };
    }),
  };
}

/** staff.email is plain TEXT UNIQUE, case-sensitive (doc 02 §6 gap #4) — lowercase both sides. */
function byEmail(email) {
  const { Staff } = require("../models");
  return Staff.findOne({ where: sqlWhere(fn("lower", col("email")), String(email).toLowerCase()), paranoid: false });
}

/** Real StaffDept query for "is staff_id finance of project_id" — doc 04 §2/§3 defines
 *  isFinance as project-scoped even though is_finance is stored per (staff, department) row;
 *  having it on ANY department in the project counts. Shared by Payment.helper.js's #40 too. */
async function isFinanceOfProject(staffId, projectId) {
  const { StaffDept, Department } = require("../models");
  const row = await StaffDept.findOne({
    where: { staff_id: staffId, is_finance: true },
    include: [{ model: Department, as: "department", where: { project_id: projectId }, attributes: [] }],
  });
  return Boolean(row);
}

/** Endpoint numbers (#N) match docs/backend/03-api-spec.md §2. Reimbursement persistence,
 * authorization, history, and receipt metadata are backed by Sequelize. R2 retains its local
 * fallback when storage credentials are not configured. */
class ReimbursementHelper {
  /** #41 — POST /reimbursements. No draft stage — creation lands directly in 'waiting', or
   *  'head_approve' if the requester is themselves head of the target department (doc 04 §4
   *  auto-verify — two status rows inserted in the same transaction, both attributed to the
   *  requester). Budget projection adds this request to the department's current active usage —
   *  it warns, never blocks. */
  static async create({ department_id, tag_id, purpose, banking_id, details }, { staffId }) {
    if (!department_id || !purpose) throw ApiError.validation("department_id and purpose are required.");
    if (!Array.isArray(details) || !details.length) {
      throw ApiError.validation("details must be a non-empty array.", "details");
    }
    const bad = details.find((d) => !(d.amount > 0));
    if (bad) throw ApiError.validation("Every detail line needs amount > 0.", "details");

    const { Department, StaffDept, ProjectTag, BankAccount, Reimbursement, ReimbursementDetail, ReimbursementStatus, sequelize } =
      require("../models");

    const department = await Department.findByPk(department_id);
    if (!department) throw ApiError.notFound("Department not found.");

    const membership = await StaffDept.findOne({ where: { staff_id: staffId, department_id } });
    if (!membership) throw ApiError.forbidden("You're not a member of this department.");

    if (tag_id) {
      const tag = await ProjectTag.findOne({ where: { _id: tag_id, project_id: department.project_id } });
      if (!tag) throw new ApiError(422, "TAG_PROJECT_MISMATCH", "tag_id does not belong to this department's project.");
    }

    if (banking_id) {
      const account = await BankAccount.findOne({ where: { _id: banking_id, staff_id: staffId } });
      if (!account) throw ApiError.forbidden("banking_id must be a live account you own.");
    }

    const autoVerify = ApprovalHelper.shouldAutoVerifyHead({ isRequesterHeadOfDepartment: membership.is_head });
    const candidateAmount = details.reduce((sum, detail) => sum + Number(detail.amount), 0);
    const budget = await budgetProjection(department, candidateAmount);

    const reimbursementId = await sequelize.transaction(async (t) => {
      const reimbursement = await Reimbursement.create(
        { staff_dept_id: membership._id, tag_id: tag_id ?? null, purpose, banking_id: banking_id ?? null },
        { transaction: t }
      );
      await ReimbursementDetail.bulkCreate(
        details.map((d) => ({ reimbursement_id: reimbursement._id, title: d.title, amount: d.amount })),
        { transaction: t }
      );
      await ReimbursementStatus.create({ reimbursement_id: reimbursement._id, status: "waiting", staff_id: staffId }, { transaction: t });
      if (autoVerify) {
        await ReimbursementStatus.create(
          { reimbursement_id: reimbursement._id, status: "head_approve", staff_id: staffId },
          { transaction: t }
        );
      }
      return reimbursement._id;
    });

    const record = await Reimbursement.findByPk(reimbursementId, { include: [{ model: ReimbursementDetail, as: "details" }] });

    return {
      record: record.toJSON(),
      meta: { budget },
    };
  }

  /** #42 — GET /reimbursements */
  static async list({ status, department_id, project_id, mine = false, page = 1, limit = 20 }, scope = {}) {
    const { Reimbursement, ReimbursementDetail, StaffDept, Staff, Department, Project, ProjectTag } = require("../models");
    const headOf = scopeValues(scope, "headOf", "head_of");
    const financeOf = scopeValues(scope, "financeOf", "finance_of");
    const access = [];

    if (mine) {
      access.push({ "$staffDept.staff_id$": scope.staffId });
    } else if (!scope.isGlobal) {
      access.push({ "$staffDept.staff_id$": scope.staffId });
      if (headOf.length) {
        const headAccess = { latest_status: "waiting" };
        if (!headOf.includes("*")) headAccess["$staffDept.department_id$"] = { [Op.in]: headOf };
        access.push(headAccess);
      }
      if (financeOf.length) {
        const financeAccess = { latest_status: "head_approve" };
        if (!financeOf.includes("*")) financeAccess["$staffDept.department.project_id$"] = { [Op.in]: financeOf };
        access.push(financeAccess);
      }
    }

    const filters = [];
    if (access.length) filters.push({ [Op.or]: access });
    if (status) filters.push({ latest_status: status });
    if (department_id) filters.push({ "$staffDept.department_id$": department_id });
    if (project_id) filters.push({ "$staffDept.department.project_id$": project_id });

    const { rows, count } = await Reimbursement.findAndCountAll({
      ...(filters.length && { where: { [Op.and]: filters } }),
      attributes: [
        "_id", "staff_dept_id", "tag_id", "purpose", "tracking_id", "banking_id", "latest_status", "created_at", "updated_at",
      ],
      include: [
        { model: ReimbursementDetail, as: "details", separate: true, attributes: ["_id", "title", "amount"] },
        {
          model: StaffDept,
          as: "staffDept",
          required: true,
          attributes: ["_id", "staff_id", "department_id"],
          include: [
            { model: Staff, as: "staff", attributes: STAFF_SUMMARY_ATTRIBUTES },
            {
              model: Department,
              as: "department",
              required: true,
              attributes: ["_id", "project_id", "name"],
              include: [{ model: Project, as: "project", attributes: ["_id", "name"] }],
            },
          ],
        },
        { model: ProjectTag, as: "tag", attributes: ["_id", "project_id", "name"] },
      ],
      distinct: true,
      order: [["created_at", "DESC"], ["_id", "ASC"]],
      limit,
      offset: (page - 1) * limit,
    });

    return { rows: rows.map(listItem), meta: { page, limit, total: Array.isArray(count) ? count.length : count } };
  }

  /** #43 — GET /reimbursements/:id */
  static async getById(reimbursementId, scope = {}) {
    const { Reimbursement, ReimbursementDetail, ReimbursementStatus, StaffDept, Staff, Department, Project, ProjectTag, BankAccount } =
      require("../models");
    const reimbursement = await Reimbursement.findByPk(reimbursementId, {
      include: [
        { model: ReimbursementDetail, as: "details", attributes: ["_id", "title", "amount"] },
        {
          model: ReimbursementStatus,
          as: "history",
          separate: true,
          include: [{ model: Staff, as: "staff", attributes: STAFF_SUMMARY_ATTRIBUTES }],
          order: [["created_at", "ASC"]],
        },
        {
          model: StaffDept,
          as: "staffDept",
          include: [
            { model: Staff, as: "staff", attributes: STAFF_SUMMARY_ATTRIBUTES },
            { model: Department, as: "department", include: [{ model: Project, as: "project" }] },
          ],
        },
        { model: ProjectTag, as: "tag" },
        { model: BankAccount, as: "bankAccount" },
      ],
    });
    if (!reimbursement) throw ApiError.notFound("Reimbursement not found.");

    const departmentId = reimbursement.staffDept.department_id;
    const projectId = reimbursement.staffDept.department.project_id;
    const isRequester = reimbursement.staffDept.staff_id === scope.staffId;
    const wasApprover = reimbursement.history.some((entry) => entry.staff_id === scope.staffId);
    const isHead = scopeCovers(scopeValues(scope, "headOf", "head_of"), departmentId);
    const isFinance = scopeCovers(scopeValues(scope, "financeOf", "finance_of"), projectId);
    if (!(isRequester || wasApprover || isHead || isFinance || scope.isGlobal)) {
      throw ApiError.forbidden("You don't have access to this reimbursement.");
    }

    const canSeeFullBankAccount =
      isRequester || scope.isGlobal || scopeCovers(scopeValues(scope, "financeOf", "finance_of"), projectId, { wildcard: false });
    return detailJSON(reimbursement, { canSeeFullBankAccount });
  }

  /** #44 — PATCH /reimbursements/:id */
  static async update(reimbursementId, patch, { staffId }) {
    const { Reimbursement, ReimbursementDetail, StaffDept, Department, ProjectTag, BankAccount, sequelize } = require("../models");
    const reimbursement = await Reimbursement.findByPk(reimbursementId, {
      include: [
        { model: ReimbursementDetail, as: "details" },
        { model: StaffDept, as: "staffDept", include: [{ model: Department, as: "department" }] },
      ],
    });
    if (!reimbursement) throw ApiError.notFound("Reimbursement not found.");
    if (reimbursement.staffDept.staff_id !== staffId) throw ApiError.forbidden("Only the requester can edit this reimbursement.");
    assertEditable(reimbursement.latest_status);

    const projectId = reimbursement.staffDept.department.project_id;
    if (hasOwn(patch, "tag_id") && patch.tag_id !== null) {
      const tag = await ProjectTag.findOne({ where: { _id: patch.tag_id, project_id: projectId } });
      if (!tag) throw new ApiError(422, "TAG_PROJECT_MISMATCH", "tag_id does not belong to this reimbursement's project.");
    }
    if (hasOwn(patch, "banking_id") && patch.banking_id !== null) {
      const account = await BankAccount.findOne({ where: { _id: patch.banking_id, staff_id: staffId } });
      if (!account) throw ApiError.forbidden("banking_id must be a live account you own.");
    }

    await sequelize.transaction(async (transaction) => {
      for (const field of ["purpose", "tag_id", "banking_id"]) {
        if (hasOwn(patch, field)) reimbursement[field] = patch[field];
      }
      if (["purpose", "tag_id", "banking_id"].some((field) => hasOwn(patch, field))) {
        await reimbursement.save({ transaction });
      }
      if (hasOwn(patch, "details")) {
        await ReimbursementDetail.destroy({ where: { reimbursement_id: reimbursementId }, transaction });
        await ReimbursementDetail.bulkCreate(
          patch.details.map((detail) => ({ reimbursement_id: reimbursementId, title: detail.title, amount: detail.amount })),
          { transaction }
        );
      }
    });

    const updated = await Reimbursement.findByPk(reimbursementId, {
      include: [
        { model: ReimbursementDetail, as: "details" },
        { model: StaffDept, as: "staffDept", include: [{ model: Department, as: "department" }] },
      ],
    });
    const budget = await budgetProjection(updated.staffDept.department, reimbursementAmount(updated), reimbursementId);
    return { record: await detailJSON(updated, { canSeeFullBankAccount: true }), meta: { budget } };
  }

  /** #45 — DELETE /reimbursements/:id */
  static async cancel(reimbursementId, { staffId }) {
    const { Reimbursement, ReimbursementStatus, StaffDept } = require("../models");
    const reimbursement = await Reimbursement.findByPk(reimbursementId, {
      include: [{ model: StaffDept, as: "staffDept", attributes: ["staff_id"] }],
    });
    if (!reimbursement) throw ApiError.notFound("Reimbursement not found.");
    if (reimbursement.staffDept.staff_id !== staffId) throw ApiError.forbidden("Only the requester can cancel this reimbursement.");
    ApprovalHelper.assertTransition(reimbursement.latest_status, "delete");
    await ReimbursementStatus.create({ reimbursement_id: reimbursementId, status: "delete", staff_id: staffId });
    return null;
  }

  /** #46 — POST /reimbursements/:id/receipt */
  static async uploadReceipt(reimbursementId, file, { staffId }) {
    const { Reimbursement, StaffDept, Department } = require("../models");
    const reimbursement = await Reimbursement.findByPk(reimbursementId, {
      include: [{ model: StaffDept, as: "staffDept", include: [{ model: Department, as: "department" }] }],
    });
    if (!reimbursement) throw ApiError.notFound("Reimbursement not found.");
    if (reimbursement.staffDept.staff_id !== staffId) throw ApiError.forbidden("Only the requester can upload this receipt.");
    assertEditable(reimbursement.latest_status, "Receipt can only be attached while waiting or rejected.");
    if (!file) throw ApiError.validation("receipt file is required.", "receipt");
    if (!Buffer.isBuffer(file.buffer) || file.buffer.length > MAX_RECEIPT_BYTES || file.size > MAX_RECEIPT_BYTES) {
      throw ApiError.validation("Receipt must be 10 MB or smaller.", "receipt");
    }
    const detected = detectReceipt(file.buffer);
    if (!detected) throw ApiError.validation("Receipt must be a PDF, PNG, or JPEG file.", "receipt");

    const projectId = reimbursement.staffDept.department.project_id;
    const key = R2.buildKey("receipts", projectId, reimbursementId, detected.extension);
    await R2.upload("receipts", key, file.buffer, detected.contentType);
    reimbursement.receipt_link = key;
    await reimbursement.save();
    return { receipt_link: await R2.presignedUrl("receipts", key) };
  }

  /** #47 — POST /reimbursements/:id/status (doc 03 §9 / doc 04 §4). Real: loads the actual
   *  current status off the row (trigger-maintained, not a query-param escape hatch anymore),
   *  resolves the caller's real isHead/isFinance/isOwner/isRequester via direct StaffDept
   *  queries (still bypassing the broader mock-permissive scope system, same reasoning as
   *  Payment.helper.js's #40), and on fin_approve->transfer rolls the total up to
   *  department/project/tag explicitly (doc 02 §6 gap #1 — no trigger does this yet).
   *
   *  Real gap surfaced here: `reason` (required on any ->rejected transition per doc 03/04) has
   *  nowhere to persist — `reimbursement_updatestatus` in the shipped schema has no `reason`
   *  column at all (unlike the doc's description of it). Still validated/required at the API
   *  layer since the contract promises it, but the value doesn't survive past this request —
   *  needs a schema migration (ALTER TABLE ... ADD COLUMN reason TEXT) to actually close. */
  static async changeStatus(reimbursementId, { status, tracking_id, reason }, { staffId, role }) {
    const { Reimbursement, ReimbursementDetail, ReimbursementStatus, StaffDept, Department, Project, ProjectTag, sequelize } =
      require("../models");

    const reimbursement = await Reimbursement.findByPk(reimbursementId, {
      include: [
        { model: StaffDept, as: "staffDept", include: [{ model: Department, as: "department" }] },
        { model: ReimbursementDetail, as: "details" },
      ],
    });
    if (!reimbursement) throw ApiError.notFound("Reimbursement not found.");

    const currentStatus = reimbursement.latest_status;
    const edge = ApprovalHelper.assertTransition(currentStatus, status);
    if (edge.needs?.includes("tracking_id") && !tracking_id) {
      throw ApiError.validation("tracking_id is required for this transition.", "tracking_id");
    }
    if (edge.needs?.includes("reason") && !reason) {
      throw ApiError.validation("reason is required for this transition.", "reason");
    }

    const departmentId = reimbursement.staffDept.department_id;
    const projectId = reimbursement.staffDept.department.project_id;
    const isRequester = reimbursement.staffDept.staff_id === staffId;
    const isHead = Boolean(await StaffDept.findOne({ where: { staff_id: staffId, department_id: departmentId, is_head: true } }));
    const isFinance = await isFinanceOfProject(staffId, projectId);
    const isOwner = role === "owner";
    ApprovalHelper.assertAuthorized(edge, { isHead, isFinance, isOwner, isRequester });

    await sequelize.transaction(async (t) => {
      await ReimbursementStatus.create({ reimbursement_id: reimbursementId, status, staff_id: staffId }, { transaction: t });
      if (status === "fin_approve") {
        reimbursement.tracking_id = tracking_id;
        await reimbursement.save({ transaction: t });
      }
      if (status === "transfer") {
        const total = reimbursement.details.reduce((sum, d) => sum + d.amount, 0);
        await Department.increment("total_expense", { by: total, where: { _id: departmentId }, transaction: t });
        await Project.increment("total_expense", { by: total, where: { _id: projectId }, transaction: t });
        if (reimbursement.tag_id) {
          await ProjectTag.increment("total_expense", { by: total, where: { _id: reimbursement.tag_id }, transaction: t });
        }
      }
    });

    // trg_sync_reimbursement_latest_status already updated latest_status by now — reload for
    // the real post-transition state instead of setting it client-side.
    const updated = await Reimbursement.findByPk(reimbursementId, {
      include: [
        { model: ReimbursementDetail, as: "details" },
        { model: ReimbursementStatus, as: "history", order: [["created_at", "ASC"]] },
      ],
    });
    return updated.toJSON();
  }

  /** #48 — GET /reimbursements/:id/document. Real record load + authorization + masking used
   *  by Document.helper.js — see that file for the render step itself. */
  static async loadForDocument(reimbursementId, { staffId, role }) {
    const { Reimbursement, ReimbursementDetail, ReimbursementStatus, StaffDept, Department, Project, ProjectTag, BankAccount, Staff } =
      require("../models");
    const reimbursement = await Reimbursement.findByPk(reimbursementId, {
      include: [
        { model: ReimbursementDetail, as: "details" },
        { model: ReimbursementStatus, as: "history", include: [{ model: Staff, as: "staff" }] },
        { model: StaffDept, as: "staffDept", include: [{ model: Department, as: "department", include: [{ model: Project, as: "project" }] }, { model: Staff, as: "staff" }] },
        { model: ProjectTag, as: "tag" },
        { model: BankAccount, as: "bankAccount" },
      ],
    });
    if (!reimbursement) throw ApiError.notFound("Reimbursement not found.");

    const projectId = reimbursement.staffDept.department.project_id;
    const departmentId = reimbursement.staffDept.department_id;
    const isRequester = reimbursement.staffDept.staff_id === staffId;
    const isFinance = await isFinanceOfProject(staffId, projectId);
    const isOwner = role === "owner" || role === "admin";
    const isHead = Boolean(await StaffDept.findOne({ where: { staff_id: staffId, department_id: departmentId, is_head: true } }));
    if (!(isRequester || isHead || isFinance || isOwner)) {
      throw ApiError.forbidden("You don't have access to this reimbursement.");
    }

    return { reimbursement, canSeeFullBankAccount: isRequester || isFinance || isOwner };
  }

  /** #49 — POST /reimbursements/import (doc 03 §9). All-or-nothing per row, same shape as
   *  Staff.helper.js's #11: every row validated (requester resolves by email, department
   *  resolves by name scoped to the target project, purpose/title/amount present) before
   *  anything is written. Simplified vs. the doc's aspiration of per-project-configurable
   *  column mapping (not built — no config table/mechanism exists for it yet): fixed columns
   *  `requester_email,department,purpose,title,amount[,tag]`, one detail line per row. Every
   *  imported row lands straight in 'waiting' (no quiet import state exists — doc 03 §9),
   *  including the head auto-verify path if the requester happens to head that department. */
  static async bulkImport(fileBuffer, projectId, importerStaffId) {
    if (!projectId) throw ApiError.validation("project_id is required.", "project_id");
    if (!fileBuffer) throw ApiError.validation("A CSV file is required.", "file");

    const { Project, Department, StaffDept, ProjectTag, Reimbursement, ReimbursementDetail, ReimbursementStatus, sequelize } =
      require("../models");

    const project = await Project.findByPk(projectId);
    if (!project) throw ApiError.notFound("Project not found.");
    if (!(await isFinanceOfProject(importerStaffId, projectId))) {
      throw ApiError.forbidden("You're not finance for this project.");
    }

    const { rows, errors: parseErrors } = CSV.parse(fileBuffer);
    if (!rows.length) throw ApiError.validation("CSV has no rows.", "file");

    const rowErrors = parseErrors.map((e) => ({ row: e.row, message: e.message }));
    const resolved = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      for (const field of ["requester_email", "department", "purpose", "title", "amount"]) {
        if (!row[field] || !String(row[field]).trim()) rowErrors.push({ row: rowNum, message: `${field} is required.` });
      }
      const amount = Number(row.amount);
      if (row.amount && (!Number.isFinite(amount) || amount <= 0)) {
        rowErrors.push({ row: rowNum, message: `amount must be a positive number: ${row.amount}` });
      }
      if (rowErrors.some((e) => e.row === rowNum)) continue;

      const staff = await byEmail(row.requester_email);
      if (!staff) {
        rowErrors.push({ row: rowNum, message: `No staff found for email: ${row.requester_email}` });
        continue;
      }
      const department = await Department.findOne({ where: { project_id: projectId, name: row.department } });
      if (!department) {
        rowErrors.push({ row: rowNum, message: `No department named '${row.department}' in this project.` });
        continue;
      }
      const membership = await StaffDept.findOne({ where: { staff_id: staff._id, department_id: department._id } });
      if (!membership) {
        rowErrors.push({ row: rowNum, message: `${row.requester_email} is not a member of '${row.department}'.` });
        continue;
      }
      let tagId = null;
      if (row.tag && row.tag.trim()) {
        const tag = await ProjectTag.findOne({ where: { project_id: projectId, name: row.tag.trim() } });
        if (!tag) {
          rowErrors.push({ row: rowNum, message: `No tag named '${row.tag}' in this project.` });
          continue;
        }
        tagId = tag._id;
      }

      resolved.push({
        staffDeptId: membership._id,
        isHead: membership.is_head,
        tagId,
        purpose: row.purpose.trim(),
        title: row.title.trim(),
        amount,
      });
    }

    if (rowErrors.length) {
      throw ApiError.validationDetails(`${rowErrors.length} row(s) failed validation — nothing was imported.`, rowErrors);
    }

    const created = await sequelize.transaction(async (t) => {
      const out = [];
      for (const row of resolved) {
        const reimbursement = await Reimbursement.create(
          { staff_dept_id: row.staffDeptId, tag_id: row.tagId, purpose: row.purpose },
          { transaction: t }
        );
        await ReimbursementDetail.create(
          { reimbursement_id: reimbursement._id, title: row.title, amount: row.amount },
          { transaction: t }
        );
        await ReimbursementStatus.create(
          { reimbursement_id: reimbursement._id, status: "waiting", staff_id: importerStaffId },
          { transaction: t }
        );
        if (row.isHead) {
          await ReimbursementStatus.create(
            { reimbursement_id: reimbursement._id, status: "head_approve", staff_id: importerStaffId },
            { transaction: t }
          );
        }
        out.push(reimbursement._id);
      }
      return out;
    });

    return { created: created.length, reimbursement_ids: created };
  }
}

module.exports = ReimbursementHelper;
