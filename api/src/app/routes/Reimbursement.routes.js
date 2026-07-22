const { Router } = require("express");
const ctrl = require("../controllers/Reimbursement.controller");
const { verifyJWT, resolveScope, requireReauth } = require("../middleware/Auth.middleware");
const upload = require("../middleware/Upload.middleware");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #41
router.post("/", ...auth, ctrl.create);
// #42
router.get("/", ...auth, ctrl.list);
// #49 — before /:id so "import" isn't parsed as an id
router.post("/import", ...auth, upload.csvFile, ctrl.bulkImport);
// #43
router.get("/:id", ...auth, ctrl.getById);
// #44
router.patch("/:id", ...auth, ctrl.update);
// #45
router.delete("/:id", ...auth, ctrl.cancel);
// #46
router.post("/:id/receipt", ...auth, upload.receipt, ctrl.uploadReceipt);
// #47 — step-up required on every status change
router.post("/:id/status", ...auth, requireReauth, ctrl.changeStatus);
// #48
router.get("/:id/document", ...auth, ctrl.document);

module.exports = router;
