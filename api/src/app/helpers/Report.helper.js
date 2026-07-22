const PDF = require("../utils/PDF.util");
const fixtures = require("../../mocks/fixtures");

class ReportHelper {
  static async summary(_query) {
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

  static async cashflow(_query) {
    return {
      income_by_source_type: { enroll: 6000000, merch: 1500000, spon: 5000000, other: 0 },
      expense_by_department: [fixtures.department()],
      expense_by_tag: [fixtures.tag()],
      monthly: [{ month: "2026-06", income: 4000000, expense: 2500000 }],
      budget_vs_actual: [{ department: fixtures.department() }],
    };
  }

  static async journal(_query) {
    return [
      { entry_date: "2026-07-01", side: "income", description: "บริษัท กล้วยหอมจอมซน จำกัด", amount: 5000000, tag: "สปอนเซอร์", project: "The Coming of Stages 3" },
      { entry_date: "2026-07-05", side: "expense", description: "ผ้าม่านเวที", amount: 120000, tag: "ค่าสถานที่", project: "The Coming of Stages 3" },
    ];
  }

  static async journalExport(_query, format) {
    const rows = await ReportHelper.journal(_query);
    if (format === "xlsx") {
      // TODO: real XLSX via a sheet-writing library. Mock returns CSV — same "does a file
      // download work" contract, without hand-rolling a binary XLSX mock.
      const header = "entry_date,side,description,amount,tag,project";
      const body = rows.map((r) => `${r.entry_date},${r.side},${r.description},${r.amount},${r.tag},${r.project}`).join("\n");
      return { contentType: "text/csv", filename: "journal.csv", body: `${header}\n${body}` };
    }
    return { contentType: "application/pdf", filename: "journal.pdf", body: await PDF.renderPdf("journal", { rows }) };
  }

  static async topExpenses(_query) {
    return [
      { title: "ผ้าม่านเวที", amount: 120000, purpose: "ค่าอุปกรณ์ประกอบฉากรอบซ้อมใหญ่", department: "ฝ่ายเวที", tag: "ค่าสถานที่" },
    ];
  }

  static async sponsors(_query) {
    return [{ name: "บริษัท กล้วยหอมจอมซน จำกัด", amount: 5000000, tag: "สปอนเซอร์" }];
  }
}

module.exports = ReportHelper;
