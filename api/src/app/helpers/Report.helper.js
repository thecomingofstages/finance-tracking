const PDF = require("../utils/PDF.util");
const fixtures = require("../../mocks/fixtures");

/**
 * Every method here is `TODO(mock)` in the same way: all of them read straight off
 * trigger-maintained aggregate columns in the real design (doc 02), which don't get updated
 * by anything yet (doc 02 §6 gap #1) — so even once these stop returning hardcoded numbers,
 * they'll be wrong until the payment/reimbursement helpers are writing real totals. Endpoint
 * numbers (#N) match docs/backend/03-api-spec.md §2. #54 GET /reports/ledger has no helper
 * method — it's blocked, returns 501 directly from Report.controller.js.
 */
class ReportHelper {
  /** #50 — GET /reports/summary */
  static async summary(_query) {
    // TODO(mock): read project.total_income/total_expense/allocated_budget for real,
    // aggregate by tag/department, count live reimbursements/pending payments — instead of
    // one fixed object regardless of project_id/tag_id/department_id/from/to.
    return {
      total_income: 12500000,
      total_expense: 8300000,
      net_income: 4200000,
      allocated_budget: 15000000,
      budget_used_pct: 55.3,
      outstanding_reimbursements: { count: 7, amount: 450000 },
      pending_slips: { count: 12 },
      by_tag: [fixtures.tag()],
      by_department: [fixtures.department()],
    };
  }

  /** #51 — GET /reports/cashflow */
  static async cashflow(_query) {
    // TODO(mock): aggregate income by source.type, expense by department/tag, build the
    // real monthly time series from the journal query (doc 02), real budget-vs-actual.
    return {
      income_by_source_type: { enroll: 6000000, merch: 1500000, spon: 5000000, other: 0 },
      expense_by_department: [fixtures.department()],
      expense_by_tag: [fixtures.tag()],
      monthly: [{ month: "2026-06", income: 4000000, expense: 2500000 }],
      budget_vs_actual: [{ department: fixtures.department() }],
    };
  }

  /** #52 — GET /reports/journal */
  static async journal(_query) {
    // TODO(mock): run the real UNION query from docs/backend/02-database.md ("Journal
    // query") instead of two hardcoded rows regardless of project_id/month/from/to.
    return [
      { entry_date: "2026-07-01", side: "income", description: "บริษัท กล้วยหอมจอมซน จำกัด", amount: 5000000, tag: "สปอนเซอร์", project: "The Coming of Stages 3" },
      { entry_date: "2026-07-05", side: "expense", description: "ผ้าม่านเวที", amount: 120000, tag: "ค่าสถานที่", project: "The Coming of Stages 3" },
    ];
  }

  /** #53 — POST /reports/journal/export */
  static async journalExport(_query, format) {
    const rows = await ReportHelper.journal(_query);
    if (format === "xlsx") {
      // TODO(xlsx, separate from mock): real XLSX via a sheet-writing library. This returns
      // CSV instead — same "does a file download work" contract, without hand-rolling a
      // binary XLSX mock. Swap this branch even after `journal()` above goes real.
      const header = "entry_date,side,description,amount,tag,project";
      const body = rows.map((r) => `${r.entry_date},${r.side},${r.description},${r.amount},${r.tag},${r.project}`).join("\n");
      return { contentType: "text/csv", filename: "journal.csv", body: `${header}\n${body}` };
    }
    // TODO(pdf, separate from mock): real Puppeteer render via templates/journal.hbs —
    // PDF.util.js currently returns a fixed placeholder regardless of `rows`.
    return { contentType: "application/pdf", filename: "journal.pdf", body: await PDF.renderPdf("journal", { rows }) };
  }

  /** #55 — GET /reports/top-expenses */
  static async topExpenses(_query) {
    // TODO(mock): query reimbursement_detail joined to reimbursements where
    // latest_status = 'transfer', ordered by amount DESC, limited to ?limit. Currently
    // always the same single row regardless of project_id/limit.
    return [
      { title: "ผ้าม่านเวที", amount: 120000, purpose: "ค่าอุปกรณ์ประกอบฉากรอบซ้อมใหญ่", department: "ฝ่ายเวที", tag: "ค่าสถานที่" },
    ];
  }

  /** #56 — GET /reports/sponsors */
  static async sponsors(_query) {
    // TODO(mock): query source WHERE type = 'spon' AND project_id = :project_id.
    return [{ name: "บริษัท กล้วยหอมจอมซน จำกัด", amount: 5000000, tag: "สปอนเซอร์" }];
  }
}

module.exports = ReportHelper;
