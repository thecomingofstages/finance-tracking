/**
 * Both templates are real as of this pass — real Puppeteer, pooled (one browser instance
 * reused across requests, per docs/backend/03-api-spec.md §9):
 * - `reimbursement-request` (ใบเบิกเงิน): the actual company template from
 *   github.com/thecomingofstages/finance-pdfgenerator, adapted from static example data to
 *   real `{token}` substitution — see templates/reimbursement-request.html.
 * - `reimbursement-voucher` (ใบสำคัญจ่าย): hand-built from a real exported example (a
 *   FlowAccount "ใบเตรียมจ่าย/ใบสำคัญจ่าย" PDF, not source HTML like the request form) — see
 *   templates/reimbursement-voucher.html. Real gap surfaced here: the example has a withholding
 *   tax (หัก ณ ที่จ่าย) line, but nothing in this schema models a tax rate anywhere —
 *   `withheld_amount` is always 0 until that's designed for real, not computed and possibly
 *   wrong. `ยอดชำระ/Amount paid` therefore always equals the full total.
 *
 * Both use our own QR.util.js (local `qrcode` package) for the verification QR, not an
 * external network call — the real FlowAccount export has no such QR at all; it's an
 * addition specific to this system (the original plan explicitly asks for one).
 */

const fs = require("node:fs");
const path = require("node:path");
// Lazy, not top-level: puppeteer's main entry is ESM-only ("export * from 'puppeteer-core'"),
// which plain Node's require() resolves fine via package.json's dual exports but Jest's default
// CommonJS transform can't parse. PDF.util.js gets pulled in by every test file through the
// route-mounting chain (buildApp -> Reimbursement.routes -> ... -> Document.helper.js), so a
// top-level require broke the entire suite, not just this file's own tests. Deferring it into
// getBrowser() means it's only ever evaluated when a PDF is actually rendered — which the fast
// unit suite never does (PDF.util.js is mocked there; real rendering is verified manually).

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** Thai solar (Buddhist) calendar, full month name — matches the request template's own
 *  example ("21 กรกฎาคม 2569" = 21 July 2026 CE). Used on the request form. */
function toThaiDate(value) {
  const d = new Date(value);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** DD/MM/YYYY, Gregorian year — matches the real voucher example exactly ("11/05/2026", not
 *  a Buddhist year). Used on the voucher only; the two real examples just use different
 *  date conventions and this keeps each template faithful to its own source. */
function toShortDate(value) {
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatBaht(satang) {
  return (satang / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

const templateCache = {};
function loadTemplate(name) {
  if (!templateCache[name]) {
    templateCache[name] = fs.readFileSync(path.join(__dirname, "..", "..", "..", "templates", `${name}.html`), "utf8");
  }
  return templateCache[name];
}

/** `{token}` substitution — every value is HTML-escaped except `items_rows` (pre-built,
 *  trusted markup — each cell inside it is escaped individually by its own builder). */
function fillTemplate(html, values) {
  return html.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in values)) return match;
    return key === "items_rows" ? values[key] : esc(values[key]);
  });
}

/** Real data -> real template. Shared by both the html preview and the PDF render below, so
 *  what you see in the browser is exactly what gets printed. */
function buildRequestHtml(data) {
  const headEntry = data.history.find((h) => h.status === "head_approve");
  const financeEntry = data.history.find((h) => h.status === "fin_approve");
  const rejectEntry = [...data.history].reverse().find((h) => h.status === "rejected");
  const transferEntry = data.history.find((h) => h.status === "transfer");

  const items_rows = data.details
    .map((d, i) => `<tr><td>${i + 1}</td><td>${esc(d.title)}</td><td style="text-align:right;">${formatBaht(d.amount)}</td></tr>`)
    .join("\n        ");

  return fillTemplate(loadTemplate("reimbursement-request"), {
    trackingId: data.tracking_id || "-",
    date: toThaiDate(data.created_at),
    name: data.requester.name,
    dept: data.department,
    project: data.project,
    objective: data.purpose,
    items_rows,
    total_amount: formatBaht(data.total_amount),
    receiverName: data.requester.name, // schema has no separate payee concept — pay to requester
    headDepartmentName: headEntry?.staff_name || "",
    approverName: financeEntry?.staff_name || "",
    isFinApproved: financeEntry ? "ครบถ้วน" : "",
    rejectDate: rejectEntry ? toThaiDate(rejectEntry.created_at) : "",
    transferDate: transferEntry ? toThaiDate(transferEntry.created_at) : "",
    bankName: data.bank_account?.provider || "",
    bankAccountNumber: data.bank_account?.number || "",
    bankAccountName: data.bank_account?.name || "",
    bankCheckbox: data.bank_account ? "✓" : "",
    cashCheckbox: data.bank_account ? "" : "✓",
  });
}

/** Real data -> real template (templates/reimbursement-voucher.html). See file header for the
 *  withholding-tax gap. */
function buildVoucherHtml(data) {
  const financeEntry = data.history.find((h) => h.status === "fin_approve");
  const transferEntry = data.history.find((h) => h.status === "transfer");
  const docDate = transferEntry?.created_at || financeEntry?.created_at || data.created_at;
  const project = data.tag ? `${data.project} (${data.tag})` : data.project;
  const trackingId = data.tracking_id || "-";
  const netAmount = formatBaht(data.total_amount); // withheld_amount is always 0 — see file header

  const items_rows = data.details
    .map(
      (d, i) =>
        `<tr><td>${i + 1}</td><td>${esc(trackingId)}</td><td>${esc(toShortDate(docDate))}</td><td>${esc(project)}</td><td>${formatBaht(d.amount)}</td></tr>`
    )
    .join("\n      ");

  return fillTemplate(loadTemplate("reimbursement-voucher"), {
    trackingId,
    docDate: toShortDate(docDate),
    preparerName: financeEntry?.staff_name || "-",
    name: data.requester.name,
    approverName: transferEntry?.staff_name || financeEntry?.staff_name || "-",
    objective: data.purpose,
    items_rows,
    item_count: data.details.length,
    total_amount: formatBaht(data.total_amount),
    total_amount_text: data.total_amount_text,
    withheld_amount: "0.00",
    net_amount: netAmount,
    cashBox: data.bank_account ? "" : "checked",
    cashMark: data.bank_account ? "" : "✓",
    transferBox: data.bank_account ? "checked" : "",
    transferMark: data.bank_account ? "✓" : "",
    bankName: data.bank_account?.provider || "",
    bankAccountNumber: data.bank_account?.number || "",
    paymentDate: transferEntry ? toShortDate(transferEntry.created_at) : "",
  });
}

async function renderHtml(templateName, data) {
  return templateName.endsWith("voucher") ? buildVoucherHtml(data) : buildRequestHtml(data);
}

/** One Chromium instance, reused across requests (doc 03 §9 — cold start ~1s, a pool keeps
 *  p95 render well under that). Not closed automatically; the process exiting cleans it up,
 *  same as any other long-lived server resource. */
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    const puppeteer = require("puppeteer");
    browserPromise = puppeteer.launch({ headless: true });
  }
  return browserPromise;
}

async function closeBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

async function renderPdf(templateName, data) {
  const html = templateName.endsWith("voucher") ? buildVoucherHtml(data) : buildRequestHtml(data);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width:100%;font-size:12px;font-family:'Sarabun','Tahoma',sans-serif;color:lightgrey;padding:0 18mm;display:flex;justify-content:space-between;align-items:flex-end;">
          <div>
            <div style="margin-bottom:2px;">เอกสารนี้ถูกจัดทำขึ้นโดยระบบอัตโนมัติ กรุณาสแกน QR Code ด้านขวามือเพื่อตรวจสอบข้อมูล</div>
            <div>Created at: ${esc(new Date().toISOString())}</div>
          </div>
          <img src="${data.qr}" width="40" height="40" />
        </div>
      `,
      margin: { top: "15mm", bottom: "25mm", left: "18mm", right: "18mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

module.exports = { renderPdf, renderHtml, closeBrowser };
