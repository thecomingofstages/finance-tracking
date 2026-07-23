/**
 * Mirrors the real Postgres enums in supabase/migrations/20260101000000_init.sql exactly.
 * Import from here — never hardcode these lists a second time — so model definitions and
 * Approval.helper.js can't drift from the shipped schema. See docs/backend/02-database.md.
 */

const TITLES = ["เด็กชาย", "เด็กหญิง", "นาย", "นาง", "นางสาว"];

const ROLES = ["user", "staff", "finance", "it", "hr", "owner", "admin"];

const SOURCE_TYPES = ["enroll", "merch", "spon", "other"];

const PAYMENT_STATUSES = ["waiting", "approved", "rejected"];

// No DRAFT — a reimbursement is created straight into 'waiting'. See doc 04 §4.
const REIMBURSEMENT_STATUSES = [
  "waiting",
  "head_approve",
  "fin_approve",
  "transfer",
  "rejected",
  "delete",
];

module.exports = { TITLES, ROLES, SOURCE_TYPES, PAYMENT_STATUSES, REIMBURSEMENT_STATUSES };
