const ApiError = require("../utils/ApiError.util");
const PDF = require("../utils/PDF.util");
const Money = require("../utils/Money.util");
const QR = require("../utils/QR.util");
const fixtures = require("../../mocks/fixtures");

class DocumentHelper {
  /** #48 — GET /reimbursements/:id/document. `Money.toThaiText` and `QR.verificationQrDataUri`
   *  below are already real. `PDF.renderPdf`/`renderHtml` return a placeholder, not the real
   *  ใบเบิกเงิน/ใบสำคัญจ่าย templates — Puppeteer/Handlebars are deliberately not wired up yet
   *  (see api/README.md "Deferred entirely"), that's a separate gap from MOCK_MODE. */
  static async render(reimbursementId, { type, format = "pdf" }) {
    // Real already: this validation and the NOT_APPROVED business rule below are genuine.
    if (!["request", "voucher"].includes(type)) {
      throw ApiError.validation("type must be 'request' or 'voucher'.", "type");
    }
    // TODO(mock): load the real reimbursement + details + history + staff + department +
    // project + tag + bank account instead of a fixture forced into fin_approve.
    const record = fixtures.reimbursement({ _id: reimbursementId, latest_status: "fin_approve", tracking_id: "TCOS3-0042" });
    if (type === "voucher" && !["fin_approve", "transfer"].includes(record.latest_status)) {
      throw new ApiError(422, "NOT_APPROVED", "Voucher requires the reimbursement to be approved first.");
    }

    const total = record.details.reduce((sum, d) => sum + d.amount, 0);
    const data = {
      ...record,
      total_amount_text: Money.toThaiText(total),
      qr: await QR.verificationQrDataUri(reimbursementId),
      // TODO(mock): mask the bank account number unless the viewer is the requester,
      // is_finance, or owner — doc 03 §9. Needs the real caller scope to decide, not just
      // real reimbursement data.
    };

    // TODO(pdf, separate from mock): swap for real Puppeteer + Handlebars rendering against
    // templates/reimbursement-request.hbs / payment-voucher.hbs. See PDF.util.js — it
    // currently returns a fixed placeholder PDF/HTML regardless of `data`.
    if (format === "html") {
      return { contentType: "text/html", body: await PDF.renderHtml(`reimbursement-${type}`, data) };
    }
    return { contentType: "application/pdf", body: await PDF.renderPdf(`reimbursement-${type}`, data) };
  }
}

module.exports = DocumentHelper;
