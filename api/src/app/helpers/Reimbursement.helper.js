const ApiError = require("../utils/ApiError.util");
const R2 = require("../utils/R2.util");
const { ApprovalHelper } = require("./Approval.helper");
const fixtures = require("../../mocks/fixtures");

/**
 * Grep this file for `TODO(mock)` to find every spot returning fixture data instead of
 * querying Postgres. Endpoint numbers (#N) match docs/backend/03-api-spec.md §2.
 * `uploadReceipt` is already fully real (R2 doesn't mock — see api/README.md). The
 * validation and Approval.helper.js transition checks throughout this file are real too;
 * only the actual persistence is stubbed.
 */
class ReimbursementHelper {
  /** #41 — POST /reimbursements. No draft stage — creation lands directly in 'waiting'.
   *  Doc 03 §9 / doc 04 §4. */
  static async create({ department_id, tag_id, purpose, banking_id, details }, scope) {
    // Real already: all four checks below are genuine validation.
    if (!department_id || !purpose) throw ApiError.validation("department_id and purpose are required.");
    if (!Array.isArray(details) || !details.length) {
      throw ApiError.validation("details must be a non-empty array.", "details");
    }
    const bad = details.find((d) => !(d.amount > 0));
    if (bad) throw ApiError.validation("Every detail line needs amount > 0.", "details");

    // Real already: the auto-verify-when-head decision itself (doc 04 §4) — only which
    // department the caller heads is mocked, via req.scope's fixture (?as_head=true).
    const isRequesterHeadOfDepartment = scope?.head_of?.includes("*") || scope?.head_of?.includes(department_id);
    const latest_status = ApprovalHelper.shouldAutoVerifyHead({ isRequesterHeadOfDepartment })
      ? "head_approve"
      : "waiting";

    // TODO(mock): insert reimbursement + details + the initial waiting status row (and, for
    // the auto-verify path, a second head_approve row) in one real transaction, instead of
    // building a fixture with the right shape.
    const record = fixtures.reimbursement({
      staff_dept_id: department_id,
      tag_id: tag_id ?? null,
      purpose,
      banking_id: banking_id ?? null,
      details: details.map((d) => fixtures.reimbursementDetail(d)),
      latest_status,
    });

    // TODO(mock): compute the real budget projection (department_id's allocated_budget vs.
    // its current total_expense) instead of this hardcoded meta block.
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

  /** #47 — POST /reimbursements/:id/status. Already real: `ApprovalHelper.assertTransition`
   *  below is the actual, complete transition table from doc 04 §4 — not a stub. */
  static async changeStatus(reimbursementId, { status, tracking_id, reason }, currentStatus = "waiting") {
    const edge = ApprovalHelper.assertTransition(currentStatus, status);
    if (edge.needs?.includes("tracking_id") && !tracking_id) {
      throw ApiError.validation("tracking_id is required for this transition.", "tracking_id");
    }
    if (edge.needs?.includes("reason") && !reason) {
      throw ApiError.validation("reason is required for this transition.", "reason");
    }
    // TODO(mock): insert the real reimbursement_updatestatus row instead of building a
    // fixture — trg_sync_reimbursement_latest_status then updates latest_status for real, no
    // extra write needed on this side once that part is real.
    const record = fixtures.reimbursement({
      _id: reimbursementId,
      latest_status: status,
      tracking_id: tracking_id ?? null,
    });
    // TODO(mock): on fin_approve -> transfer, roll the total up to department/tag/project
    // explicitly — no trigger does this yet (doc 02 §6 gap #1), so this has to be a real
    // write here, not something that becomes automatic later.
    return { ...record, history: fixtures.reimbursementStatusHistory(reimbursementId, status) };
  }

  /** #49 — POST /reimbursements/import */
  static async bulkImport(_fileBuffer, _projectId) {
    // TODO(mock): CSV.util.parse the real upload, resolve requester (by email) and
    // department (by name, scoped to the project) per row, collect row-level errors instead
    // of failing the whole batch, land every resolvable row in 'waiting' (no quiet import
    // state exists — see doc 03 §9). Currently ignores the file and creates one fixture row.
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
