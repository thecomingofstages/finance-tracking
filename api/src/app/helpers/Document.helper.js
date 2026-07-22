const ApiError = require("../utils/ApiError.util");
const PDF = require("../utils/PDF.util");
const Money = require("../utils/Money.util");
const QR = require("../utils/QR.util");
const fixtures = require("../../mocks/fixtures");

class DocumentHelper {
  static async render(reimbursementId, { type, format = "pdf" }) {
    if (!["request", "voucher"].includes(type)) {
      throw ApiError.validation("type must be 'request' or 'voucher'.", "type");
    }
    const record = fixtures.reimbursement({ _id: reimbursementId, latest_status: "fin_approve", tracking_id: "TCOS3-0042" });
    if (type === "voucher" && !["fin_approve", "transfer"].includes(record.latest_status)) {
      throw new ApiError(422, "NOT_APPROVED", "Voucher requires the reimbursement to be approved first.");
    }

    const total = record.details.reduce((sum, d) => sum + d.amount, 0);
    const data = {
      ...record,
      total_amount_text: Money.toThaiText(total),
      qr: await QR.verificationQrDataUri(reimbursementId),
      // TODO: mask bank account unless viewer is requester/finance/owner — doc 03 §9.
    };

    if (format === "html") {
      return { contentType: "text/html", body: await PDF.renderHtml(`reimbursement-${type}`, data) };
    }
    return { contentType: "application/pdf", body: await PDF.renderPdf(`reimbursement-${type}`, data) };
  }
}

module.exports = DocumentHelper;
