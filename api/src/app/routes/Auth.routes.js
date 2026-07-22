const { Router } = require("express");
const ctrl = require("../controllers/Auth.controller");
const { verifyJWT, resolveScope } = require("../middleware/Auth.middleware");
const { authAttempts } = require("../middleware/RateLimit.middleware");

const router = Router();

// #57 — Supabase Auth session token, not a Bearer access token — no verifyJWT here by design.
router.post("/claim", authAttempts, ctrl.claim);
// #1
router.post("/login", authAttempts, ctrl.login);
// #58
router.post("/login/supabase", authAttempts, ctrl.loginViaSupabase);
// #2
router.post("/logout", verifyJWT, ctrl.logout);
// #3 — refresh cookie only, no Bearer header
router.post("/refresh", ctrl.refresh);
// #5
router.post("/password/forgot", authAttempts, ctrl.forgotPassword);
// #6
router.post("/password/reset", authAttempts, ctrl.resetPassword);
// #59
router.post("/verify-password", verifyJWT, authAttempts, ctrl.verifyPassword);
// #4
router.get("/me", verifyJWT, resolveScope, ctrl.me);

module.exports = router;
