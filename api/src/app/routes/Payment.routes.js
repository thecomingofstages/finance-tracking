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
// #38 — no :id in this route; target comes from the required ?project_id= query param instead.
router.get(
  "/",
  ...auth,
  Validate.query(schema.list),
  requireScope("isFinance", (req) => req.query.project_id),
  ctrl.list
);
// #39 — :id is the payment's own id, not a project id — resolve payment -> source -> project.
router.get(
  "/:id",
  ...auth,
  requireScope("isFinance", async (req) => {
    const { Payment, Source } = require("../models");
    const payment = await Payment.findByPk(req.params.id);
    return payment ? (await Source.findByPk(payment.source_id))?.project_id : undefined;
  }),
  ctrl.getById
);
// #40 — bulk, step-up required. No single target (a batch can span multiple projects) — the
// default req.params.id resolves to undefined here (no :id in this route), which falls back to
// the coarse "is finance anywhere" check (doc 04 §1). The real per-item, per-project isFinance
// enforcement happens inside Payment.helper.js#bulkApprove itself (a direct StaffDept query per
// decision) — this outer gate is defense-in-depth, not the actual authorization boundary here.
router.post("/approve", ...auth, requireReauth, requireScope("isFinance"), Validate.body(schema.bulkApprove), ctrl.bulkApprove);

module.exports = router;
