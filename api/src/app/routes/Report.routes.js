const { Router } = require("express");
const ctrl = require("../controllers/Report.controller");
const { verifyJWT, resolveScope, requireScope } = require("../middleware/Auth.middleware");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #50
router.get("/summary", ...auth, ctrl.summary);
// #51
router.get("/cashflow", ...auth, requireScope("isFinanceOrOwner"), ctrl.cashflow);
// #52
router.get("/journal", ...auth, requireScope("isFinanceOrOwner"), ctrl.journal);
// #53
router.post("/journal/export", ...auth, requireScope("isFinanceOrOwner"), ctrl.journalExport);
// #54 — Blocked, see docs/backend/05-open-questions.md #1
router.get("/ledger", ...auth, requireScope("isFinanceOrOwner"), ctrl.ledger);
// #55
router.get("/top-expenses", ...auth, ctrl.topExpenses);
// #56
router.get("/sponsors", ...auth, requireScope("isFinanceOrOwner"), ctrl.sponsors);

module.exports = router;
