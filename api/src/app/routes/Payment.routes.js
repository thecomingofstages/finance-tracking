const { Router } = require("express");
const ctrl = require("../controllers/Payment.controller");
const { verifyJWT, resolveScope, requireScope, requireReauth } = require("../middleware/Auth.middleware");
const { verifyServiceToken } = require("../middleware/ServiceAuth.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Payment.schema");
const Target = require("../utils/ScopeTarget.util");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #37 — service token only, never reachable with a user JWT
router.post("/", verifyServiceToken, Validate.body(schema.ingest), ctrl.ingest);
// #38
// project_id is a required query param here (swagger.yaml), so the guard has a real target.
router.get("/", ...auth, requireScope("isFinance", Target.query()), ctrl.list);
// #39
router.get("/:id", ...auth, requireScope("isFinance", Target.projectOfPayment), ctrl.getById);
// #40 — bulk, step-up required
router.post("/approve", ...auth, requireReauth, requireScope("isFinance", Target.anyProject), Validate.body(schema.bulkApprove), ctrl.bulkApprove);

module.exports = router;
