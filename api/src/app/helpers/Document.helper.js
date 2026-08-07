const ApiError = require("../utils/ApiError.util");
const PDF = require("../utils/PDF.util");
const Money = require("../utils/Money.util");
const QR = require("../utils/QR.util");

class DocumentHelper {
  /** #48 — GET /reimbursements/:id/document. Real record load, real authorization (via
   *  Reimbursement.helper.js#loadForDocument — requester/head/finance/owner, direct StaffDept
   *  query, same as #47), real NOT_APPROVED check, real bank-account masking, real Thai baht
   *  text + QR (already real). `format=html` renders genuine HTML from real data.
   *  `format=pdf` still returns PDF.util.js's placeholder bytes — Puppeteer/Handlebars are a
   *  deliberately separate, already-documented gap (see PDF.util.js), not reopened here. */
  static async render(reimbursementId, { type, format = "pdf" }, scope) {
    if (!["request", "voucher"].includes(type)) {
      throw ApiError.validation("type must be 'request' or 'voucher'.", "type");
    }

    const Reimbursement = require("./Reimbursement.helper");
    const { reimbursement, canSeeFullBankAccount } = await Reimbursement.loadForDocument(reimbursementId, scope);

    if (type === "voucher" && !["fin_approve", "transfer"].includes(reimbursement.latest_status)) {
      throw new ApiError(422, "NOT_APPROVED", "Voucher requires the reimbursement to be approved first.");
    }

    const total = reimbursement.details.reduce((sum, d) => sum + d.amount, 0);
    const account = reimbursement.bankAccount;
    const staff = reimbursement.staffDept.staff;
    const department = reimbursement.staffDept.department;

    const data = {
      _id: reimbursement._id,
      type,
      purpose: reimbursement.purpose,
      tracking_id: reimbursement.tracking_id,
      latest_status: reimbursement.latest_status,
      created_at: reimbursement.created_at,
      details: reimbursement.details.map((d) => ({ title: d.title, amount: d.amount })),
      total_amount: total,
      total_amount_text: Money.toThaiText(total),
      requester: { name: `${staff.first_name} ${staff.last_name}`, nickname: staff.nickname },
      department: department.name,
      project: department.project.name,
      tag: reimbursement.tag?.name ?? null,
      bank_account: account
        ? { name: account.name, provider: account.provider, number: canSeeFullBankAccount ? account.number : account.maskedNumber }
        : null,
      history: reimbursement.history.map((h) => ({
        status: h.status,
        staff_name: h.staff ? `${h.staff.first_name} ${h.staff.last_name}` : null,
        signature_image: h.staff?.signature_image ?? null,
        created_at: h.created_at,
      })),
      qr: await QR.verificationQrDataUri(reimbursementId),
    };

    if (format === "html") {
      return { contentType: "text/html", body: await PDF.renderHtml(`reimbursement-${type}`, data) };
    }
    return { contentType: "application/pdf", body: await PDF.renderPdf(`reimbursement-${type}`, data) };
  }
}

module.exports = DocumentHelper;
