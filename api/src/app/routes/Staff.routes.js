const { Router } = require("express");
const ctrl = require("../controllers/Staff.controller");
const { verifyJWT, resolveScope, requireScope, requireReauth } = require("../middleware/Auth.middleware");
const upload = require("../middleware/Upload.middleware");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #7
router.get("/", ...auth, requireScope("isManager"), ctrl.list);
// #8
router.get("/:id", ...auth, requireScope("isManager"), ctrl.getById);
// #9
router.patch("/me", ...auth, ctrl.updateSelf);
// #14
router.get("/me/bank-accounts", ...auth, ctrl.listBankAccounts);
// #15
router.post("/me/bank-accounts", ...auth, ctrl.addBankAccount);
// #16
router.delete("/me/bank-accounts/:id", ...auth, ctrl.removeBankAccount);
// #60 — step-up required
router.post("/me/signature", ...auth, requireReauth, upload.signature, ctrl.uploadSignature);

// #10-13 — admin-only, mounted under /v1/admin/staff in routes/init.js
const adminRouter = Router();
adminRouter.post("/", ...auth, requireScope("isGlobal"), ctrl.adminCreate);
adminRouter.post("/import", ...auth, requireScope("isGlobal"), upload.csvFile, ctrl.adminImport);
adminRouter.patch("/:id", ...auth, requireScope("isGlobal"), ctrl.adminUpdate);
adminRouter.delete("/:id", ...auth, requireScope("isGlobal"), ctrl.adminDeactivate);

module.exports = { staffRouter: router, adminStaffRouter: adminRouter };
