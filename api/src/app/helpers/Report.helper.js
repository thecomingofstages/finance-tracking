const { QueryTypes } = require("sequelize");
const PDF = require("../utils/PDF.util");
const ApiError = require("../utils/ApiError.util");
const { db } = require("../config/init");
const fixtures = require("../../mocks/fixtures");

const SOURCE_TYPES = ["enroll", "merch", "spon", "other"];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function scopeList(scope, camelKey, snakeKey) {
  return unique([...(scope?.[camelKey] || []), ...(scope?.[snakeKey] || [])]);
}

function accessibleProjectIds(scope = {}, { financeOnly = false } = {}) {
  const financeOf = scopeList(scope, "financeOf", "finance_of");
  if (financeOnly) return financeOf;
  const membershipProjects = (scope.memberships || []).map((membership) => membership.projectId ?? membership.project_id);
  return unique([
    ...membershipProjects,
    ...financeOf,
    ...scopeList(scope, "managerOf", "manager_of"),
  ]);
}

function resolveProjectAccess(projectId, scope, options) {
  const ids = accessibleProjectIds(scope, options);
  const unrestricted = Boolean(scope?.isGlobal || ids.includes("*"));
  const allowedIds = ids.filter((id) => id !== "*");

  if (projectId) {
    if (!unrestricted && !allowedIds.includes(projectId)) {
      throw ApiError.forbidden("You don't have access to this project.", "NOT_PROJECT_MEMBER");
    }
    return { projectId };
  }
  return unrestricted ? {} : { allowedIds };
}

function projectPredicate(access, column, replacements) {
  if (access.projectId) {
    replacements.projectId = access.projectId;
    return `${column} = :projectId`;
  }
  if (access.allowedIds) {
    if (!access.allowedIds.length) return "FALSE";
    replacements.scopeProjectIds = access.allowedIds;
    return `${column} IN (:scopeProjectIds)`;
  }
  return "TRUE";
}

function datePredicate(query, column, replacements) {
  const clauses = [];
  if (query.from) {
    replacements.from = query.from;
    clauses.push(`${column} >= CAST(:from AS date)`);
  }
  if (query.to) {
    replacements.to = query.to;
    clauses.push(`${column} < CAST(:to AS date) + INTERVAL '1 day'`);
  }
  return clauses;
}

function monthBounds(month) {
  const [year, value] = month.split("-").map(Number);
  const nextYear = value === 12 ? year + 1 : year;
  const nextMonth = value === 12 ? 1 : value + 1;
  return {
    from: `${year}-${String(value).padStart(2, "0")}-01`,
    toExclusive: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

function reportDatePredicate(query, column, replacements) {
  if (!query.month) return datePredicate(query, column, replacements);
  const bounds = monthBounds(query.month);
  replacements.monthFrom = bounds.from;
  replacements.monthTo = bounds.toExclusive;
  return [`${column} >= CAST(:monthFrom AS date)`, `${column} < CAST(:monthTo AS date)`];
}

function asInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function moneyFields(row, fields) {
  const mapped = { ...row };
  for (const field of fields) mapped[field] = asInteger(mapped[field]);
  return mapped;
}

async function select(sql, replacements = {}) {
  const { sequelize } = require("../models");
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

/** Endpoint numbers (#N) match docs/backend/03-api-spec.md §2. All filters and scope values are
 * passed through Sequelize named replacements; the only interpolated SQL values are trusted
 * schema/table aliases defined in this file. #53 export and blocked #54 remain separate work. */
class ReportHelper {
  /** #50 — GET /reports/summary */
  static async summary(query, scope = {}) {
    const access = resolveProjectAccess(query.project_id, scope);
    const replacements = {};
    const projectForSource = projectPredicate(access, "s.project_id", replacements);
    const projectForDepartment = projectPredicate(access, "dept.project_id", replacements);
    const projectForProject = projectPredicate(access, "p._id", replacements);
    const sourceDates = datePredicate(query, "s.created_at", replacements);
    const reimbursementDates = datePredicate(query, "r.created_at", replacements);
    const paymentDates = datePredicate(query, "pm.created_at", replacements);
    const sourceTag = query.tag_id ? "AND s.tag_id = :tagId" : "";
    const reimbursementTag = query.tag_id ? "AND r.tag_id = :tagId" : "";
    const reimbursementDepartment = query.department_id ? "AND dept._id = :departmentId" : "";
    if (query.tag_id) replacements.tagId = query.tag_id;
    if (query.department_id) replacements.departmentId = query.department_id;

    let allocatedSql = `(SELECT COALESCE(SUM(p.allocated_budget), 0)::bigint
                           FROM ${db.schema}.project p
                           WHERE p.deleted_at IS NULL AND ${projectForProject})`;
    if (query.tag_id) {
      allocatedSql = `(SELECT COALESCE(SUM(t.allocated_budget), 0)::bigint
                         FROM ${db.schema}.project_tag t
                         WHERE t.deleted_at IS NULL AND t._id = :tagId
                           AND ${projectPredicate(access, "t.project_id", replacements)})`;
    }
    if (query.department_id) {
      allocatedSql = `(SELECT COALESCE(SUM(dept.allocated_budget), 0)::bigint
                         FROM ${db.schema}.department dept
                         WHERE dept.deleted_at IS NULL AND dept._id = :departmentId
                           AND ${projectForDepartment})`;
    }

    const [totals = {}] = await select(
      `SELECT
         (SELECT COALESCE(SUM(s.actual_amount), 0)::bigint
            FROM ${db.schema}.source s
            WHERE s.deleted_at IS NULL AND ${projectForSource}
              ${sourceTag} ${sourceDates.map((clause) => `AND ${clause}`).join(" ")}) AS total_income,
         (SELECT COALESCE(SUM(rd.amount), 0)::bigint
            FROM ${db.schema}.reimbursement_detail rd
            JOIN ${db.schema}.reimbursement r ON r._id = rd.reimbursement_id
            JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id AND sd.deleted_at IS NULL
            JOIN ${db.schema}.department dept ON dept._id = sd.department_id AND dept.deleted_at IS NULL
            WHERE rd.deleted_at IS NULL AND r.deleted_at IS NULL
              AND r.latest_status = 'transfer' AND ${projectForDepartment}
              ${reimbursementTag} ${reimbursementDepartment}
              ${reimbursementDates.map((clause) => `AND ${clause}`).join(" ")}) AS total_expense,
         ${allocatedSql} AS allocated_budget,
         (SELECT COUNT(DISTINCT r._id)::int
            FROM ${db.schema}.reimbursement r
            JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id AND sd.deleted_at IS NULL
            JOIN ${db.schema}.department dept ON dept._id = sd.department_id AND dept.deleted_at IS NULL
            WHERE r.deleted_at IS NULL AND r.latest_status IN ('waiting', 'head_approve', 'fin_approve')
              AND ${projectForDepartment} ${reimbursementTag} ${reimbursementDepartment}
              ${reimbursementDates.map((clause) => `AND ${clause}`).join(" ")}) AS outstanding_count,
         (SELECT COALESCE(SUM(rd.amount), 0)::bigint
            FROM ${db.schema}.reimbursement_detail rd
            JOIN ${db.schema}.reimbursement r ON r._id = rd.reimbursement_id
            JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id AND sd.deleted_at IS NULL
            JOIN ${db.schema}.department dept ON dept._id = sd.department_id AND dept.deleted_at IS NULL
            WHERE rd.deleted_at IS NULL AND r.deleted_at IS NULL
              AND r.latest_status IN ('waiting', 'head_approve', 'fin_approve')
              AND ${projectForDepartment} ${reimbursementTag} ${reimbursementDepartment}
              ${reimbursementDates.map((clause) => `AND ${clause}`).join(" ")}) AS outstanding_amount,
         (SELECT COUNT(*)::int
            FROM ${db.schema}.payment pm
            JOIN ${db.schema}.source s ON s._id = pm.source_id AND s.deleted_at IS NULL
            LEFT JOIN LATERAL (
              SELECT ps.status FROM ${db.schema}.payment_updatestatus ps
              WHERE ps.payment_id = pm._id ORDER BY ps.created_at DESC LIMIT 1
            ) latest ON TRUE
            WHERE pm.deleted_at IS NULL AND COALESCE(latest.status, 'waiting') = 'waiting'
              AND ${projectForSource} ${sourceTag}
              ${paymentDates.map((clause) => `AND ${clause}`).join(" ")}) AS pending_count`,
      replacements
    );

    const tagReplacements = { ...replacements };
    const tagProject = projectPredicate(access, "t.project_id", tagReplacements);
    const byTag = await select(
      `SELECT t._id AS tag_id, t.name, t.allocated_budget,
              COALESCE((SELECT SUM(s.actual_amount) FROM ${db.schema}.source s
                        WHERE s.deleted_at IS NULL AND s.tag_id = t._id
                          ${sourceDates.map((clause) => `AND ${clause}`).join(" ")}), 0)::bigint AS total_income,
              COALESCE((SELECT SUM(rd.amount)
                        FROM ${db.schema}.reimbursement_detail rd
                        JOIN ${db.schema}.reimbursement r ON r._id = rd.reimbursement_id
                        JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id AND sd.deleted_at IS NULL
                        JOIN ${db.schema}.department dept ON dept._id = sd.department_id AND dept.deleted_at IS NULL
                        WHERE rd.deleted_at IS NULL AND r.deleted_at IS NULL
                          AND r.latest_status = 'transfer' AND r.tag_id = t._id
                          ${reimbursementDepartment}
                          ${reimbursementDates.map((clause) => `AND ${clause}`).join(" ")}), 0)::bigint AS total_expense
       FROM ${db.schema}.project_tag t
       WHERE t.deleted_at IS NULL AND ${tagProject} ${query.tag_id ? "AND t._id = :tagId" : ""}
       ORDER BY t.name ASC, t._id ASC`,
      tagReplacements
    );

    const departmentReplacements = { ...replacements };
    const departmentProject = projectPredicate(access, "dept.project_id", departmentReplacements);
    const byDepartment = await select(
      `SELECT dept._id AS department_id, dept.name, dept.allocated_budget,
              COALESCE((SELECT SUM(rd.amount)
                        FROM ${db.schema}.reimbursement_detail rd
                        JOIN ${db.schema}.reimbursement r ON r._id = rd.reimbursement_id
                        JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id AND sd.deleted_at IS NULL
                        WHERE rd.deleted_at IS NULL AND r.deleted_at IS NULL
                          AND r.latest_status = 'transfer' AND sd.department_id = dept._id
                          ${reimbursementTag}
                          ${reimbursementDates.map((clause) => `AND ${clause}`).join(" ")}), 0)::bigint AS total_expense
       FROM ${db.schema}.department dept
       WHERE dept.deleted_at IS NULL AND ${departmentProject}
         ${query.department_id ? "AND dept._id = :departmentId" : ""}
       ORDER BY dept.name ASC, dept._id ASC`,
      departmentReplacements
    );

    const totalIncome = asInteger(totals.total_income);
    const totalExpense = asInteger(totals.total_expense);
    const allocatedBudget = asInteger(totals.allocated_budget);
    const pendingCount = asInteger(totals.pending_count);
    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_income: totalIncome - totalExpense,
      net_cashflow: totalIncome - totalExpense,
      allocated_budget: allocatedBudget,
      budget_used_pct: allocatedBudget ? Math.round((totalExpense / allocatedBudget) * 1000) / 10 : 0,
      outstanding_reimbursements: {
        count: asInteger(totals.outstanding_count),
        amount: asInteger(totals.outstanding_amount),
      },
      pending_slips: { count: pendingCount },
      pending_count: pendingCount,
      by_tag: byTag.map((row) => moneyFields(row, ["allocated_budget", "total_income", "total_expense"])),
      by_department: byDepartment.map((row) => moneyFields(row, ["allocated_budget", "total_expense"])),
    };
  }

  /** #51 — GET /reports/cashflow */
  static async cashflow(query, scope = {}) {
    const access = resolveProjectAccess(query.project_id, scope, { financeOnly: true });
    const replacements = {};
    const sourceProject = projectPredicate(access, "s.project_id", replacements);
    const departmentProject = projectPredicate(access, "dept.project_id", replacements);
    const sourceDates = datePredicate(query, "s.created_at", replacements);
    const reimbursementDates = datePredicate(query, "r.created_at", replacements);

    const incomeRows = await select(
      `SELECT s.type, COALESCE(SUM(s.actual_amount), 0)::bigint AS amount
       FROM ${db.schema}.source s
       WHERE s.deleted_at IS NULL AND ${sourceProject}
         ${sourceDates.map((clause) => `AND ${clause}`).join(" ")}
       GROUP BY s.type ORDER BY s.type ASC`,
      replacements
    );

    const departmentRows = await select(
      `SELECT dept._id AS department_id, dept.name, dept.allocated_budget,
              COALESCE(SUM(rd.amount), 0)::bigint AS total_expense
       FROM ${db.schema}.department dept
       LEFT JOIN ${db.schema}.staff_dept sd ON sd.department_id = dept._id AND sd.deleted_at IS NULL
       LEFT JOIN ${db.schema}.reimbursement r ON r.staff_dept_id = sd._id
         AND r.deleted_at IS NULL AND r.latest_status = 'transfer'
         ${reimbursementDates.map((clause) => `AND ${clause}`).join(" ")}
       LEFT JOIN ${db.schema}.reimbursement_detail rd ON rd.reimbursement_id = r._id AND rd.deleted_at IS NULL
       WHERE dept.deleted_at IS NULL AND ${departmentProject}
       GROUP BY dept._id, dept.name, dept.allocated_budget
       ORDER BY dept.name ASC, dept._id ASC`,
      replacements
    );

    const tagReplacements = { ...replacements };
    const tagProject = projectPredicate(access, "t.project_id", tagReplacements);
    const tagRows = await select(
      `SELECT t._id AS tag_id, t.name, t.allocated_budget,
              COALESCE(SUM(rd.amount), 0)::bigint AS total_expense
       FROM ${db.schema}.project_tag t
       LEFT JOIN ${db.schema}.reimbursement r ON r.tag_id = t._id
         AND r.deleted_at IS NULL AND r.latest_status = 'transfer'
         ${reimbursementDates.map((clause) => `AND ${clause}`).join(" ")}
       LEFT JOIN ${db.schema}.reimbursement_detail rd ON rd.reimbursement_id = r._id AND rd.deleted_at IS NULL
       WHERE t.deleted_at IS NULL AND ${tagProject}
       GROUP BY t._id, t.name, t.allocated_budget
       ORDER BY t.name ASC, t._id ASC`,
      tagReplacements
    );

    const monthlyReplacements = {};
    const expenseProject = projectPredicate(access, "dept.project_id", monthlyReplacements);
    const incomeProject = projectPredicate(access, "s.project_id", monthlyReplacements);
    const expenseEventDates = datePredicate(query, "rd.created_at", monthlyReplacements);
    const incomeEventDates = datePredicate(query, "ps.created_at", monthlyReplacements);
    const monthlyRows = await select(
      `WITH entries AS (
         SELECT rd.created_at AS entry_at, 0::bigint AS income, rd.amount::bigint AS expense
         FROM ${db.schema}.reimbursement_detail rd
         JOIN ${db.schema}.reimbursement r ON r._id = rd.reimbursement_id
         JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id AND sd.deleted_at IS NULL
         JOIN ${db.schema}.department dept ON dept._id = sd.department_id AND dept.deleted_at IS NULL
         WHERE rd.deleted_at IS NULL AND r.deleted_at IS NULL AND r.latest_status = 'transfer'
           AND ${expenseProject} ${expenseEventDates.map((clause) => `AND ${clause}`).join(" ")}
         UNION ALL
         SELECT ps.created_at, ps.actual_amount::bigint, 0::bigint
         FROM ${db.schema}.payment_updatestatus ps
         JOIN ${db.schema}.payment pm ON pm._id = ps.payment_id AND pm.deleted_at IS NULL
         JOIN ${db.schema}.source s ON s._id = pm.source_id AND s.deleted_at IS NULL
         WHERE ps.status = 'approved' AND ${incomeProject}
           ${incomeEventDates.map((clause) => `AND ${clause}`).join(" ")}
       )
       SELECT TO_CHAR(DATE_TRUNC('month', entry_at), 'YYYY-MM') AS month,
              COALESCE(SUM(income), 0)::bigint AS income,
              COALESCE(SUM(expense), 0)::bigint AS expense
       FROM entries GROUP BY DATE_TRUNC('month', entry_at)
       ORDER BY DATE_TRUNC('month', entry_at) ASC`,
      monthlyReplacements
    );

    const incomeBySourceType = Object.fromEntries(SOURCE_TYPES.map((type) => [type, 0]));
    for (const row of incomeRows) incomeBySourceType[row.type] = asInteger(row.amount);
    const expenseByDepartment = departmentRows.map((row) => moneyFields(row, ["allocated_budget", "total_expense"]));
    const expenseByTag = tagRows.map((row) => moneyFields(row, ["allocated_budget", "total_expense"]));
    return {
      income_by_source_type: incomeBySourceType,
      expense_by_department: expenseByDepartment,
      expense_by_tag: expenseByTag,
      monthly: monthlyRows.map((row) => moneyFields(row, ["income", "expense"])),
      budget_vs_actual: expenseByDepartment.map((department) => ({
        department_id: department.department_id,
        name: department.name,
        allocated_budget: department.allocated_budget,
        actual_expense: department.total_expense,
        remaining_budget: department.allocated_budget - department.total_expense,
      })),
    };
  }

  /** #52 — GET /reports/journal */
  static async journal(query, scope) {
    // #53 calls this method without a scope argument. Keep that separately owned endpoint on
    // its existing fixture-backed behavior while #52 uses the real query through its controller.
    if (!scope) {
      return [
        { entry_date: "2026-07-01", side: "income", description: "บริษัท กล้วยหอมจอมซน จำกัด", amount: 5000000, tag: "สปอนเซอร์", project: "The Coming of Stages 3" },
        { entry_date: "2026-07-05", side: "expense", description: "ผ้าม่านเวที", amount: 120000, tag: "ค่าสถานที่", project: "The Coming of Stages 3" },
      ];
    }
    const access = resolveProjectAccess(query.project_id, scope, { financeOnly: true });
    const replacements = {};
    const entryProject = projectPredicate(access, "entries.project_id", replacements);
    const entryDates = reportDatePredicate(query, "entries.entry_date", replacements);
    const rows = await select(
      `WITH entries AS (
         SELECT rd.created_at::date AS entry_date, 'expense'::text AS side,
                rd.title AS description, rd.amount, t.name AS tag, p.name AS project,
                p._id AS project_id
         FROM ${db.schema}.reimbursement_detail rd
         JOIN ${db.schema}.reimbursement r ON r._id = rd.reimbursement_id
         JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id AND sd.deleted_at IS NULL
         JOIN ${db.schema}.department dept ON dept._id = sd.department_id AND dept.deleted_at IS NULL
         JOIN ${db.schema}.project p ON p._id = dept.project_id AND p.deleted_at IS NULL
         LEFT JOIN ${db.schema}.project_tag t ON t._id = r.tag_id AND t.deleted_at IS NULL
         WHERE rd.deleted_at IS NULL AND r.deleted_at IS NULL AND r.latest_status = 'transfer'
         UNION ALL
         SELECT ps.created_at::date, 'income'::text, s.name, ps.actual_amount,
                t.name, p.name, p._id
         FROM ${db.schema}.payment_updatestatus ps
         JOIN ${db.schema}.payment pm ON pm._id = ps.payment_id AND pm.deleted_at IS NULL
         JOIN ${db.schema}.source s ON s._id = pm.source_id AND s.deleted_at IS NULL
         JOIN ${db.schema}.project p ON p._id = s.project_id AND p.deleted_at IS NULL
         LEFT JOIN ${db.schema}.project_tag t ON t._id = s.tag_id AND t.deleted_at IS NULL
         WHERE ps.status = 'approved'
       )
       SELECT entries.entry_date, entries.side, entries.description, entries.amount,
              entries.tag, entries.project
       FROM entries
       WHERE ${entryProject} ${entryDates.map((clause) => `AND ${clause}`).join(" ")}
       ORDER BY entries.entry_date ASC, entries.side ASC, entries.description ASC`,
      replacements
    );
    return rows.map((row) => moneyFields(row, ["amount"]));
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
  static async topExpenses(query, scope = {}) {
    const access = resolveProjectAccess(query.project_id, scope);
    const replacements = { limit: query.limit };
    const project = projectPredicate(access, "p._id", replacements);
    const rows = await select(
      `SELECT rd._id AS detail_id, rd.title, rd.amount, r._id AS reimbursement_id,
              r.purpose, dept._id AS department_id, dept.name AS department,
              t._id AS tag_id, t.name AS tag, p._id AS project_id, p.name AS project
       FROM ${db.schema}.reimbursement_detail rd
       JOIN ${db.schema}.reimbursement r ON r._id = rd.reimbursement_id
       JOIN ${db.schema}.staff_dept sd ON sd._id = r.staff_dept_id AND sd.deleted_at IS NULL
       JOIN ${db.schema}.department dept ON dept._id = sd.department_id AND dept.deleted_at IS NULL
       JOIN ${db.schema}.project p ON p._id = dept.project_id AND p.deleted_at IS NULL
       LEFT JOIN ${db.schema}.project_tag t ON t._id = r.tag_id AND t.deleted_at IS NULL
       WHERE rd.deleted_at IS NULL AND r.deleted_at IS NULL
         AND r.latest_status = 'transfer' AND ${project}
       ORDER BY rd.amount DESC, rd._id ASC
       LIMIT :limit`,
      replacements
    );
    return rows.map((row) => moneyFields(row, ["amount"]));
  }

  /** #56 — GET /reports/sponsors */
  static async sponsors(query, scope = {}) {
    const access = resolveProjectAccess(query.project_id, scope, { financeOnly: true });
    const replacements = {};
    const project = projectPredicate(access, "s.project_id", replacements);
    const rows = await select(
      `SELECT s._id AS source_id, s.name, s.expect_amount, s.actual_amount,
              s.actual_amount AS amount, t._id AS tag_id, t.name AS tag,
              p._id AS project_id, p.name AS project
       FROM ${db.schema}.source s
       JOIN ${db.schema}.project p ON p._id = s.project_id AND p.deleted_at IS NULL
       LEFT JOIN ${db.schema}.project_tag t ON t._id = s.tag_id AND t.deleted_at IS NULL
       WHERE s.deleted_at IS NULL AND s.type = 'spon' AND ${project}
       ORDER BY s.name ASC, s._id ASC`,
      replacements
    );
    return rows.map((row) => moneyFields(row, ["expect_amount", "actual_amount", "amount"]));
  }
}

module.exports = ReportHelper;
