const { Router } = require("express");
const ctrl = require("../controllers/Staff.controller");
const { verifyJWT, resolveScope, requireScope, requireRole, requireReauth } = require("../middleware/Auth.middleware");
const upload = require("../middleware/Upload.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Staff.schema");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #7
router.get("/", ...auth, requireScope("isManager"), ctrl.list);
// #8
router.get("/:id", ...auth, requireScope("isManager"), ctrl.getById);
// #9
router.patch("/me", ...auth, Validate.body(schema.updateSelf), ctrl.updateSelf);
// #14
router.get("/me/bank-accounts", ...auth, ctrl.listBankAccounts);
// #15
router.post("/me/bank-accounts", ...auth, Validate.body(schema.addBankAccount), ctrl.addBankAccount);
// #16
router.delete("/me/bank-accounts/:id", ...auth, ctrl.removeBankAccount);
// #60 — step-up required. multipart/form-data, so no Validate.body — the file itself is
// checked in Staff.helper.js#uploadSignature, not by a zod object schema.
router.post("/me/signature", ...auth, requireReauth, upload.signature, ctrl.uploadSignature);

// #10-13 — admin-only, mounted under /v1/admin/staff in routes/init.js. requireRole("admin")
// is real (straight off the JWT, doc 03 §5 step 1) — not requireScope("isGlobal"), which is
// broader (finance/owner/admin too) and still mock-gated pending the StaffDept scope system.
const adminRouter = Router();
adminRouter.post("/", ...auth, requireRole("admin"), Validate.body(schema.adminCreate), ctrl.adminCreate);
// #11 — multipart, no Validate.body, same reasoning as #60 above.
adminRouter.post("/import", ...auth, requireRole("admin"), upload.csvFile, ctrl.adminImport);
adminRouter.patch("/:id", ...auth, requireRole("admin"), Validate.body(schema.adminUpdate), ctrl.adminUpdate);
adminRouter.delete("/:id", ...auth, requireRole("admin"), ctrl.adminDeactivate);

module.exports = { staffRouter: router, adminStaffRouter: adminRouter };
