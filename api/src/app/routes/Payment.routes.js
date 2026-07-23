const { Router } = require("express");
const ctrl = require("../controllers/Payment.controller");
const { verifyJWT, resolveScope, requireScope, requireReauth } = require("../middleware/Auth.middleware");
const { verifyServiceToken } = require("../middleware/ServiceAuth.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Payment.schema");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #37 — service token only, never reachable with a user JWT
router.post("/", verifyServiceToken, Validate.body(schema.ingest), ctrl.ingest);
// #38
router.get("/", ...auth, requireScope("isFinance"), ctrl.list);
// #39
router.get("/:id", ...auth, requireScope("isFinance"), ctrl.getById);
// #40 — bulk, step-up required
router.post("/approve", ...auth, requireReauth, requireScope("isFinance"), Validate.body(schema.bulkApprove), ctrl.bulkApprove);

module.exports = router;
