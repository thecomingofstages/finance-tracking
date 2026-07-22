const { Router } = require("express");
const ctrl = require("../controllers/Payment.controller");
const { verifyJWT, resolveScope, requireScope, requireReauth } = require("../middleware/Auth.middleware");
const { verifyServiceToken } = require("../middleware/ServiceAuth.middleware");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #37 — service token only, never reachable with a user JWT
router.post("/", verifyServiceToken, ctrl.ingest);
// #38
router.get("/", ...auth, requireScope("isFinance"), ctrl.list);
// #39
router.get("/:id", ...auth, requireScope("isFinance"), ctrl.getById);
// #40 — bulk, step-up required
router.post("/approve", ...auth, requireReauth, requireScope("isFinance"), ctrl.bulkApprove);

module.exports = router;
