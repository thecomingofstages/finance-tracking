const ApiError = require("../utils/ApiError.util");
const fixtures = require("../../mocks/fixtures");

/**
 * Grep this file for `TODO(mock)` to find every spot returning fixture data instead of
 * querying Postgres. Endpoint numbers (#N) match docs/backend/03-api-spec.md §2.
 * #37 and #40 are real (doc 03 §8); #38/#39 are unchanged, still mocked.
 */
class PaymentHelper {
  /** #37 — POST /payments (service-token ingress from Enroll/Merch). Idempotent on `_id`
   *  (doc 03 §8) — a retry must hit the same row, not create a second one.
   *
   *  Real gap surfaced here, not in doc 02: `payment_updatestatus.staff_id` is NOT NULL at the
   *  DB level, but this route has no user context to attribute an initial status row to (it's
   *  an unauthenticated service call). Rather than invent a fake "system" staff account, this
   *  deliberately does NOT insert an initial payment_updatestatus row — bulkApprove() below
   *  treats "no history yet" as implicitly 'waiting', which is exactly what an explicit
   *  waiting row would have meant anyway. */
  static async ingest(payload) {
    const { _id, user_id, source_id, expected_amount, promptpay_qr_data } = payload;
    if (!_id || !source_id) throw ApiError.validation("_id and source_id are required.");

    const { Payment, Source } = require("../models");

    const existing = await Payment.findByPk(_id);
    if (existing) return { payment: existing.toJSON(), isNew: false };

    const source = await Source.findByPk(source_id);
    if (!source) throw ApiError.notFound("No source configured for this activity/store yet.", "SOURCE_NOT_FOUND");

    // No unique index on promptpay_qr_data yet (doc 02 §6 gap #5) — check-then-insert race,
    // acceptable until that index lands. A different payment already holding this exact QR
    // string is a real duplicate-slip signal, not just a retry (a retry reuses the same _id,
    // caught by the findByPk above already).
    if (promptpay_qr_data) {
      const dupe = await Payment.findOne({ where: { promptpay_qr_data } });
      if (dupe) throw ApiError.conflict("This QR data is already attached to another payment.", "DUPLICATE_QR_DATA");
    }

    const payment = await Payment.create({
      _id,
      user_id: user_id ?? null,
      source_id,
      expected_amount: expected_amount ?? 0,
      promptpay_qr_data: promptpay_qr_data ?? null,
    });
    return { payment: payment.toJSON(), isNew: true };
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

  /** #40 — POST /payments/approve (bulk, step-up required, doc 03 §8). Idempotent per item —
   *  one transaction per payment, not one for the whole batch, so a bad row can't roll back
   *  the nine good ones next to it. `amount_matches` is real now: accept-and-flag on a
   *  mismatch rather than hard-reject (open question #9 — the less disruptive of the two
   *  documented options; revisit if Finance wants a hard block instead). */
  static async bulkApprove(decisions, staffId) {
    if (!Array.isArray(decisions) || !decisions.length) {
      throw ApiError.validation("decisions must be a non-empty array.", "decisions");
    }

    const { Payment, PaymentStatus, Source, ProjectTag, Project, StaffDept, Department, sequelize } = require("../models");

    const results = [];
    for (const d of decisions) {
      if (!["approved", "rejected"].includes(d.status)) {
        results.push({ payment_id: d.payment_id, outcome: "skipped", reason: "Invalid target status." });
        continue;
      }
      if (d.status === "approved" && d.actual_amount == null) {
        results.push({ payment_id: d.payment_id, outcome: "skipped", reason: "actual_amount is required on approval." });
        continue;
      }

      const payment = await Payment.findByPk(d.payment_id, { include: [{ model: Source, as: "source" }] });
      if (!payment) {
        results.push({ payment_id: d.payment_id, outcome: "skipped", reason: "Payment not found." });
        continue;
      }

      // Per-item, not batch-wide (doc 03 §8) — every finance staff can only decide payments
      // funding a source in a project they're actually finance for. Real StaffDept query, not
      // the still-mock-permissive req.scope — see Reimbursement.helper.js for the same pattern.
      const isFinance = Boolean(
        await StaffDept.findOne({
          where: { staff_id: staffId, is_finance: true },
          include: [{ model: Department, as: "department", where: { project_id: payment.source.project_id }, attributes: [] }],
        })
      );
      if (!isFinance) {
        results.push({ payment_id: d.payment_id, outcome: "skipped", reason: "Not finance for this payment's project." });
        continue;
      }

      const latest = await PaymentStatus.findOne({ where: { payment_id: d.payment_id }, order: [["created_at", "DESC"]] });
      const currentStatus = latest?.status || "waiting";
      if (["approved", "rejected"].includes(currentStatus)) {
        results.push({ payment_id: d.payment_id, outcome: "skipped", reason: `Already ${currentStatus} by another finance staff.` });
        continue;
      }

      await sequelize.transaction(async (t) => {
        await PaymentStatus.create(
          { payment_id: d.payment_id, status: d.status, actual_amount: d.status === "approved" ? d.actual_amount : null, staff_id: staffId },
          { transaction: t }
        );
        if (d.status === "approved") {
          // No trigger rolls this up yet (doc 02 §6 gap #1) — explicit write, same transaction
          // as the status insert so a rollup failure rolls the decision back with it.
          await Source.increment("actual_amount", { by: d.actual_amount, where: { _id: payment.source_id }, transaction: t });
          if (payment.source.tag_id) {
            await ProjectTag.increment("total_income", { by: d.actual_amount, where: { _id: payment.source.tag_id }, transaction: t });
          }
          await Project.increment("total_income", { by: d.actual_amount, where: { _id: payment.source.project_id }, transaction: t });
        }
      });

      results.push({
        payment_id: d.payment_id,
        outcome: d.status,
        amount_matches: d.status === "approved" ? d.actual_amount === payment.expected_amount : undefined,
      });
    }

    return results;
  }
}

module.exports = PaymentHelper;
