const { z } = require("zod");

// Matches the request bodies documented in swagger.yaml's Auth paths (§5 of doc 03).
// These validate shape/type only — business rules (does this email exist, is the password
// right) stay in Auth.helper.js, that's not zod's job.

const login = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const claim = z.object({
  password: z.string().min(8),
});

const verifyPassword = z.object({
  password: z.string().min(1),
});

const forgotPassword = z.object({
  email: z.string().email(),
});

const resetPassword = z.object({
  reset_token: z.string().min(1),
  password: z.string().min(8),
});

module.exports = { login, claim, verifyPassword, forgotPassword, resetPassword };
