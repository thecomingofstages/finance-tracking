const { Router } = require("express");
const ctrl = require("../controllers/Auth.controller");
const { verifyJWT, resolveScope } = require("../middleware/Auth.middleware");
const { authAttempts } = require("../middleware/RateLimit.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Auth.schema");

const router = Router();

// #57 — Supabase Auth session token, not a Bearer access token — no verifyJWT here by design.
router.post("/claim", authAttempts, Validate.body(schema.claim), ctrl.claim);
// #1
router.post("/login", authAttempts, Validate.body(schema.login), ctrl.login);
// #58
router.post("/login/supabase", authAttempts, ctrl.loginViaSupabase);
// #2
router.post("/logout", verifyJWT, ctrl.logout);
// #3 — refresh cookie only, no Bearer header
router.post("/refresh", ctrl.refresh);
// #5
router.post("/password/forgot", authAttempts, Validate.body(schema.forgotPassword), ctrl.forgotPassword);
// #6
router.post("/password/reset", authAttempts, Validate.body(schema.resetPassword), ctrl.resetPassword);
// #59
router.post("/verify-password", verifyJWT, authAttempts, Validate.body(schema.verifyPassword), ctrl.verifyPassword);
// #4
router.get("/me", verifyJWT, resolveScope, ctrl.me);

module.exports = router;
