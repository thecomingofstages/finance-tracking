const ApiError = require("../utils/ApiError.util");
const fixtures = require("../../mocks/fixtures");

class PaymentHelper {
  static async ingest(payload) {
    const { _id, source_id, expected_amount, promptpay_qr_data } = payload;
    if (!_id || !source_id) throw ApiError.validation("_id and source_id are required.");
    // TODO: resolve source by (type, reference_id), 404 SOURCE_NOT_FOUND if none configured.
    // TODO: idempotent on PK conflict — return 200 with the existing record instead of erroring.
    // TODO: promptpay_qr_data has no unique index yet (doc 02 §6 gap #5) — check for a live
    // duplicate manually before insert.
    return fixtures.payment({ _id, source_id, expected_amount, promptpay_qr_data });
  }

  static async list(_projectId, _query) {
    const rows = [fixtures.payment(), fixtures.payment({ expected_amount: 80000 })];
    return { rows, meta: fixtures.pagination(rows.length) };
  }

  static async getById(paymentId) {
    return { ...fixtures.payment({ _id: paymentId }), history: fixtures.paymentStatusHistory(paymentId) };
  }

  /** Doc 03 §8 — bulk, idempotent per item, skips (not errors) on a concurrent duplicate decision. */
  static async bulkApprove(decisions) {
    if (!Array.isArray(decisions) || !decisions.length) {
      throw ApiError.validation("decisions must be a non-empty array.", "decisions");
    }
    return decisions.map((d) => {
      if (!["approved", "rejected"].includes(d.status)) {
        return { payment_id: d.payment_id, outcome: "skipped", reason: "Invalid target status." };
      }
      if (d.status === "approved" && d.actual_amount == null) {
        return { payment_id: d.payment_id, outcome: "skipped", reason: "actual_amount is required on approval." };
      }
      // TODO: real per-item transaction — resolve payment -> source, check is_finance, read
      // latest payment_updatestatus, skip if already decided, insert new status row, and
      // explicitly roll up source.actual_amount (doc 02 §6 gap #1 — no trigger does this yet).
      return {
        payment_id: d.payment_id,
        outcome: d.status === "approved" ? "approved" : "rejected",
        // Mock always reports a match — real implementation compares against the payment's
        // own expected_amount, which this stub doesn't look up. See open question #9.
        amount_matches: d.status === "approved" ? true : undefined,
      };
    });
  }
}

module.exports = PaymentHelper;
