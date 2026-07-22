const ApiError = require("../utils/ApiError.util");
const R2 = require("../utils/R2.util");
const { ApprovalHelper } = require("./Approval.helper");
const fixtures = require("../../mocks/fixtures");

class ReimbursementHelper {
  /** No draft stage — creation lands directly in 'waiting'. Doc 03 §9 / doc 04 §4. */
  static async create({ department_id, tag_id, purpose, banking_id, details }, scope) {
    if (!department_id || !purpose) throw ApiError.validation("department_id and purpose are required.");
    if (!Array.isArray(details) || !details.length) {
      throw ApiError.validation("details must be a non-empty array.", "details");
    }
    const bad = details.find((d) => !(d.amount > 0));
    if (bad) throw ApiError.validation("Every detail line needs amount > 0.", "details");

    const isRequesterHeadOfDepartment = scope?.head_of?.includes("*") || scope?.head_of?.includes(department_id);
    const latest_status = ApprovalHelper.shouldAutoVerifyHead({ isRequesterHeadOfDepartment })
      ? "head_approve"
      : "waiting";

    const record = fixtures.reimbursement({
      staff_dept_id: department_id,
      tag_id: tag_id ?? null,
      purpose,
      banking_id: banking_id ?? null,
      details: details.map((d) => fixtures.reimbursementDetail(d)),
      latest_status,
    });

    return {
      record,
      meta: {
        budget: {
          department_allocated: 2000000,
          department_used: 1900000,
          would_exceed: true,
          over_by: 55000,
        },
      },
    };
  }

  static async list(_query) {
    const rows = [
      fixtures.reimbursement({ latest_status: "waiting" }),
      fixtures.reimbursement({ latest_status: "fin_approve", tracking_id: "TCOS3-0042" }),
    ];
    return { rows, meta: fixtures.pagination(rows.length) };
  }

  static async getById(reimbursementId) {
    const record = fixtures.reimbursement({ _id: reimbursementId });
    return {
      ...record,
      receipt_link: record.receipt_link ? await R2.presignedUrl("receipts", record.receipt_link) : null,
      history: fixtures.reimbursementStatusHistory(reimbursementId, record.latest_status),
    };
  }

  static async update(reimbursementId, patch, currentStatus = "waiting") {
    if (!["waiting", "rejected"].includes(currentStatus)) {
      throw new ApiError(422, "INVALID_TRANSITION", "Only editable while waiting or rejected.");
    }
    return fixtures.reimbursement({ _id: reimbursementId, ...patch });
  }

  static async cancel(_reimbursementId, currentStatus = "waiting") {
    ApprovalHelper.assertTransition(currentStatus, "delete");
    return null;
  }

  static async uploadReceipt(reimbursementId, file, currentStatus = "waiting") {
    if (!["waiting", "rejected"].includes(currentStatus)) {
      throw new ApiError(422, "INVALID_TRANSITION", "Receipt can only be attached while waiting or rejected.");
    }
    if (!file) throw ApiError.validation("receipt file is required.", "receipt");
    const ext = file.mimetype === "application/pdf" ? "pdf" : "jpg";
    const key = R2.buildKey("receipts", "project", reimbursementId, ext);
    await R2.upload("receipts", key, file.buffer, file.mimetype);
    return { receipt_link: await R2.presignedUrl("receipts", key) };
  }

  /** Advances one edge of the transition table — doc 04 §4. */
  static async changeStatus(reimbursementId, { status, tracking_id, reason }, currentStatus = "waiting") {
    const edge = ApprovalHelper.assertTransition(currentStatus, status);
    if (edge.needs?.includes("tracking_id") && !tracking_id) {
      throw ApiError.validation("tracking_id is required for this transition.", "tracking_id");
    }
    if (edge.needs?.includes("reason") && !reason) {
      throw ApiError.validation("reason is required for this transition.", "reason");
    }
    const record = fixtures.reimbursement({
      _id: reimbursementId,
      latest_status: status,
      tracking_id: tracking_id ?? null,
    });
    // TODO: on fin_approve -> transfer, roll the total up to department/tag/project explicitly
    // — no trigger does this yet (doc 02 §6 gap #1).
    return { ...record, history: fixtures.reimbursementStatusHistory(reimbursementId, status) };
  }

  static async bulkImport(_fileBuffer, _projectId) {
    // TODO: CSV.util.parse, resolve requester/department per row, land every resolvable row
    // in 'waiting' (no quiet import state exists — see doc 03 §9).
    const created = await ReimbursementHelper.create(
      {
        department_id: fixtures.uuidv7(),
        purpose: "นำเข้าจาก Google Form",
        details: [{ title: "รายการนำเข้า", amount: 50000 }],
      },
      {}
    );
    return { created: 1, rows: [created.record] };
  }
}

module.exports = ReimbursementHelper;
