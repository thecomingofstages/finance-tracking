const { fn, col, where: sqlWhere } = require("sequelize");
const ApiError = require("../utils/ApiError.util");
const R2 = require("../utils/R2.util");
const CSV = require("../utils/CSV.util");
const { ApprovalHelper } = require("./Approval.helper");
const { db } = require("../config/init");
const fixtures = require("../../mocks/fixtures");

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

/**
 * Grep this file for `TODO(mock)` to find every spot returning fixture data instead of
 * querying Postgres. Endpoint numbers (#N) match docs/backend/03-api-spec.md §2.
 * `uploadReceipt` is already fully real (R2 doesn't mock — see api/README.md). #41, #47, #49
 * are real as of this pass; #42-46 (list/getById/update/cancel/receipt's DB write-back) stay
 * mocked — not this round's scope.
 */
class ReimbursementHelper {
  /** #41 — POST /reimbursements. No draft stage — creation lands directly in 'waiting', or
   *  'head_approve' if the requester is themselves head of the target department (doc 04 §4
   *  auto-verify — two status rows inserted in the same transaction, both attributed to the
   *  requester). Budget check is a real query (sum of every non-rejected/non-deleted
   *  reimbursement detail in this department, via staff_dept) — it warns, never blocks. */
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

    const [{ used }] = await sequelize.query(
      `SELECT COALESCE(SUM(rd.amount), 0)::int AS used
       FROM ${db.schema}.reimbursement_detail rd
       JOIN ${db.schema}.reimbursement r ON r._id = rd.reimbursement_id
       JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id
       WHERE sd.department_id = :departmentId
         AND r.latest_status NOT IN ('rejected', 'delete')
         AND r.deleted_at IS NULL AND rd.deleted_at IS NULL`,
      { replacements: { departmentId: department_id }, type: sequelize.QueryTypes.SELECT }
    );

    return {
      record: record.toJSON(),
      meta: {
        budget: {
          department_allocated: department.allocated_budget,
          department_used: used,
          would_exceed: used > department.allocated_budget,
          over_by: Math.max(0, used - department.allocated_budget),
        },
      },
    };
  }

  /** #42 — GET /reimbursements */
  static async list(_query) {
    // TODO(mock): scope to what the caller requested or can approve at their current stage
    // (doc 03 §9), apply status/department_id/project_id/mine filters. Currently always
    // returns the same two fixtures.
    const rows = [
      fixtures.reimbursement({ latest_status: "waiting" }),
      fixtures.reimbursement({ latest_status: "fin_approve", tracking_id: "TCOS3-0042" }),
    ];
    return { rows, meta: fixtures.pagination(rows.length) };
  }

  /** #43 — GET /reimbursements/:id. The receipt_link resolution below is already real R2 —
   *  only the reimbursement record itself and its history are mocked. */
  static async getById(reimbursementId) {
    // TODO(mock): load the real row + details + full reimbursement_updatestatus history.
    const record = fixtures.reimbursement({ _id: reimbursementId });
    return {
      ...record,
      receipt_link: record.receipt_link ? await R2.presignedUrl("receipts", record.receipt_link) : null,
      history: fixtures.reimbursementStatusHistory(reimbursementId, record.latest_status),
    };
  }

  /** #44 — PATCH /reimbursements/:id */
  static async update(reimbursementId, patch, currentStatus = "waiting") {
    // Real already: the waiting/rejected editability window is a genuine check — the
    // `currentStatus` param is what's mocked (see the controller's `?mock_status=` escape
    // hatch), since there's no real row to read the status off yet.
    if (!["waiting", "rejected"].includes(currentStatus)) {
      throw new ApiError(422, "INVALID_TRANSITION", "Only editable while waiting or rejected.");
    }
    // TODO(mock): full-replace details + $set the other fields on the real row inside a
    // transaction, instead of echoing the patch onto a fixture.
    return fixtures.reimbursement({ _id: reimbursementId, ...patch });
  }

  /** #45 — DELETE /reimbursements/:id */
  static async cancel(_reimbursementId, currentStatus = "waiting") {
    // Real already: this is the actual Approval.helper.js transition table doing real work —
    // throws 422 INVALID_TRANSITION for real if `currentStatus -> delete` isn't a valid edge.
    ApprovalHelper.assertTransition(currentStatus, "delete");
    // TODO(mock): insert the real `delete` status row instead of a no-op.
    return null;
  }

  /** #46 — POST /reimbursements/:id/receipt. Already fully real — the R2 upload below
   *  genuinely happens (see api/README.md). Only the editability check's `currentStatus`
   *  input and the final `$set receipt_link` write-back are mocked. */
  static async uploadReceipt(reimbursementId, file, currentStatus = "waiting") {
    if (!["waiting", "rejected"].includes(currentStatus)) {
      throw new ApiError(422, "INVALID_TRANSITION", "Receipt can only be attached while waiting or rejected.");
    }
    if (!file) throw ApiError.validation("receipt file is required.", "receipt");
    const ext = file.mimetype === "application/pdf" ? "pdf" : "jpg";
    const key = R2.buildKey("receipts", "project", reimbursementId, ext);
    await R2.upload("receipts", key, file.buffer, file.mimetype);
    // TODO(mock): $set reimbursement.receipt_link = key on the real row. The R2 upload above
    // needs no changes when this goes real.
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
