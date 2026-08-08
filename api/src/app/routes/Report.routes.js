const { Router } = require("express");
const ctrl = require("../controllers/Report.controller");
const { verifyJWT, resolveScope, requireScope } = require("../middleware/Auth.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Report.schema");
const Target = require("../utils/ScopeTarget.util");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #50
router.get("/summary", ...auth, ctrl.summary);
// #51
router.get("/cashflow", ...auth, requireScope("isFinanceOrOwner", Target.anyProject), ctrl.cashflow);
// #52
router.get("/journal", ...auth, requireScope("isFinanceOrOwner", Target.query()), ctrl.journal);
// #53 — format is accepted via body or query (controller checks both); schema only
// validates the body shape, and format is optional there for exactly that reason.
router.post("/journal/export", ...auth, requireScope("isFinanceOrOwner", Target.anyProject), Validate.body(schema.journalExport), ctrl.journalExport);
// #54 — Blocked, see docs/backend/05-open-questions.md #1
router.get("/ledger", ...auth, requireScope("isFinanceOrOwner", Target.anyProject), ctrl.ledger);
// #55
router.get("/top-expenses", ...auth, ctrl.topExpenses);
// #56
router.get("/sponsors", ...auth, requireScope("isFinanceOrOwner", Target.query()), ctrl.sponsors);

module.exports = router;
