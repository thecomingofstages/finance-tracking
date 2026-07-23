const { Router } = require("express");
const ctrl = require("../controllers/Reimbursement.controller");
const { verifyJWT, resolveScope, requireReauth } = require("../middleware/Auth.middleware");
const upload = require("../middleware/Upload.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Reimbursement.schema");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #41
router.post("/", ...auth, Validate.body(schema.create), ctrl.create);
// #42
router.get("/", ...auth, ctrl.list);
// #49 — before /:id so "import" isn't parsed as an id. multipart, no Validate.body — the
// file itself is checked in Reimbursement.helper.js#bulkImport, not a zod object schema.
router.post("/import", ...auth, upload.csvFile, ctrl.bulkImport);
// #43
router.get("/:id", ...auth, ctrl.getById);
// #44
router.patch("/:id", ...auth, Validate.body(schema.update), ctrl.update);
// #45
router.delete("/:id", ...auth, ctrl.cancel);
// #46 — multipart, no Validate.body, same reasoning as #49 above.
router.post("/:id/receipt", ...auth, upload.receipt, ctrl.uploadReceipt);
// #47 — step-up required on every status change
router.post("/:id/status", ...auth, requireReauth, Validate.body(schema.changeStatus), ctrl.changeStatus);
// #48
router.get("/:id/document", ...auth, ctrl.document);

module.exports = router;
