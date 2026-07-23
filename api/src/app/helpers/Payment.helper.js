const ApiError = require("../utils/ApiError.util");
const fixtures = require("../../mocks/fixtures");

/**
 * Grep this file for `TODO(mock)` to find every spot returning fixture data instead of
 * querying Postgres. Endpoint numbers (#N) match docs/backend/03-api-spec.md §2.
 */
class PaymentHelper {
  /** #37 — POST /payments (service-token ingress from Enroll/Merch) */
  static async ingest(payload) {
    const { _id, source_id, expected_amount, promptpay_qr_data } = payload;
    if (!_id || !source_id) throw ApiError.validation("_id and source_id are required.");
    // TODO(mock): resolve source by (type, reference_id), 404 SOURCE_NOT_FOUND if none
    // configured — the caller supplies source_id directly right now, bypassing that lookup.
    // TODO(mock): idempotent on PK conflict — return 200 with the existing record instead of
    // always inserting/returning a fresh fixture.
    // TODO(mock): promptpay_qr_data has no unique index yet (doc 02 §6 gap #5) — check for a
    // live duplicate manually before insert once this is real.
    return fixtures.payment({ _id, source_id, expected_amount, promptpay_qr_data });
  }

  /** #38 — GET /payments (the /checkslip queue) */
  static async list(_projectId, _query) {
    // TODO(mock): join payment -> latest payment_updatestatus -> source, filtered to
    // source.project_id and (optionally) status, sorted created_at ASC. Currently returns
    // two fixtures regardless of project_id/status/pagination passed in.
    const rows = [fixtures.payment(), fixtures.payment({ expected_amount: 80000 })];
    return { rows, meta: fixtures.pagination(rows.length) };
  }

  /** #39 — GET /payments/:id */
  static async getById(paymentId) {
    // TODO(mock): load the real row + its full payment_updatestatus history.
    return { ...fixtures.payment({ _id: paymentId }), history: fixtures.paymentStatusHistory(paymentId) };
  }

  /** #40 — POST /payments/approve (bulk, step-up required). Doc 03 §8 — idempotent per item,
   *  skips (not errors) on a concurrent duplicate decision. The validation and the
   *  skip-if-invalid branches below are real; only the actual DB write is mocked. */
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
      // TODO(mock): real per-item transaction — resolve payment -> source, check is_finance,
      // read latest payment_updatestatus, skip if someone else already decided it, insert a
      // new status row, and explicitly roll up source.actual_amount (doc 02 §6 gap #1 — no
      // trigger does this yet, so this write has to happen here by hand).
      return {
        payment_id: d.payment_id,
        outcome: d.status === "approved" ? "approved" : "rejected",
        // TODO(mock): this always reports a match — real implementation compares
        // actual_amount against the payment's own expected_amount. See open question #9 for
        // whether a mismatch should hard-reject or accept-and-flag.
        amount_matches: d.status === "approved" ? true : undefined,
      };
    });
  }
}

module.exports = PaymentHelper;
