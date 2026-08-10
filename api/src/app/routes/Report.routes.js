const { Router } = require("express");
const ctrl = require("../controllers/Report.controller");
const { verifyJWT, resolveScope, requireScope } = require("../middleware/Auth.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Report.schema");

const router = Router();
const auth = [verifyJWT, resolveScope];
// No :id anywhere in this file — reports are scoped by an optional ?project_id= query param
// instead (doc 03 §10: unrestricted for finance/owner/admin, else scoped to memberships).
// Undefined (no project_id given) falls back to isFinanceOrOwner's isGlobal check.
const reportProjectId = (req) => req.query.project_id;

// #50
router.get("/summary", ...auth, ctrl.summary);
// #51
router.get("/cashflow", ...auth, requireScope("isFinanceOrOwner", reportProjectId), ctrl.cashflow);
// #52
router.get("/journal", ...auth, requireScope("isFinanceOrOwner", reportProjectId), ctrl.journal);
// #53 — format is accepted via body or query (controller checks both); schema only
// validates the body shape, and format is optional there for exactly that reason.
router.post("/journal/export", ...auth, requireScope("isFinanceOrOwner", reportProjectId), Validate.body(schema.journalExport), ctrl.journalExport);
// #54 — Blocked, see docs/backend/05-open-questions.md #1
router.get("/ledger", ...auth, requireScope("isFinanceOrOwner", reportProjectId), ctrl.ledger);
// #55
router.get("/top-expenses", ...auth, ctrl.topExpenses);
// #56
router.get("/sponsors", ...auth, requireScope("isFinanceOrOwner", reportProjectId), ctrl.sponsors);

module.exports = router;
