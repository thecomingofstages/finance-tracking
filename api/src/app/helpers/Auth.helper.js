const bcrypt = require("bcrypt");
const { fn, col, where: sqlWhere } = require("sequelize");
const ApiError = require("../utils/ApiError.util");
const JWT = require("../utils/JWT.util");
const Supabase = require("../utils/Supabase.util");
const Email = require("../utils/Email.util");
const logger = require("../utils/Logger.util");
const { app: appConf } = require("../config/init");

const BCRYPT_ROUNDS = 12;

/**
 * Real implementation — this domain is chompoo's, and unlike the other six it does NOT read
 * appConf.mockMode: every method here always hits the real `staff` table via Sequelize.
 * Requires a real Postgres connection (see docs/backend/03-api-spec.md §4 for the auth model,
 * README.md for what has to be running). Endpoint numbers (#N) match docs/backend/03-api-spec.md §2.
 */

/** Lazy require — keeps requiring this file from forcing model init (and a DB dial) before
 *  index.js has decided to connect; only actually resolves models/index.js when a method runs. */
function Staff() {
  return require("../models").Staff;
}

/** staff.email is plain TEXT UNIQUE, case-sensitive, in the shipped schema (doc 02 §6 gap #4) —
 *  lowercase both sides ourselves until that's fixed with citext. */
function byEmail(email) {
  return Staff().findOne({ where: sqlWhere(fn("lower", col("email")), String(email).toLowerCase()) });
}

class AuthHelper {
  /** #1 — POST /auth/login */
  static async login({ email, password }) {
    if (!email || !password) throw ApiError.validation("email and password are required.");
    const staff = await byEmail(email);
    // Never distinguish "no such email" from "wrong password" from "never claimed" — same
    // generic 401 for all three (doc 03 §4), to avoid account enumeration.
    if (!staff || !staff.password_hash || !(await bcrypt.compare(password, staff.password_hash))) {
      throw ApiError.unauthorized("Incorrect email or password.");
    }
    return AuthHelper._issueSession(staff);
  }

  /** #3 — POST /auth/refresh. Takes the raw refresh_token cookie value (read by the
   *  controller), verifies it's actually typ:"refresh" (not an access/reauth/reset token
   *  reused here by mistake), and reloads the real staff row so a deleted staff member can't
   *  refresh forever off a still-valid token signature. */
  static async refresh(refreshToken) {
    if (!refreshToken) throw ApiError.unauthorized("Missing refresh token.", "REFRESH_REQUIRED");
    let payload;
    try {
      payload = JWT.verify(refreshToken);
    } catch (err) {
      const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_CREDENTIALS";
      throw ApiError.unauthorized("Invalid or expired refresh token.", code);
    }
    if (payload.typ !== "refresh") {
      throw ApiError.unauthorized("Invalid or expired refresh token.", "INVALID_CREDENTIALS");
    }
    const staff = await Staff().findByPk(payload.sub);
    if (!staff) throw ApiError.unauthorized("Invalid or expired refresh token.", "INVALID_CREDENTIALS");
    return AuthHelper._issueSession(staff);
  }

  /** #58 — POST /auth/login/supabase. Alternate login path for staff who already claimed
   *  their account and prefer Supabase's own login UI — still ends in one of OUR sessions. */
  static async loginViaSupabase({ supabaseAccessToken }) {
    const supaUser = await Supabase.verifySupabaseToken(supabaseAccessToken);
    if (!supaUser?.email) throw ApiError.unauthorized("Invalid Supabase session.");
    const staff = await byEmail(supaUser.email);
    if (!staff || !staff.password_hash) {
      throw ApiError.notFound(
        "No TCOS account is linked to this email yet — claim it via POST /auth/claim first.",
        "ACCOUNT_NOT_CLAIMED"
      );
    }
    return AuthHelper._issueSession(staff);
  }

  /** #57 — POST /auth/claim. First-time setup: staff already exists in Supabase Auth (they
   *  received an invite/magic link) and in our `staff` table (an admin provisioned the row by
   *  email, no password yet) — this call links the two and sets their real password. */
  static async claim({ supabaseAccessToken, password }) {
    if (!password || password.length < 8) {
      throw ApiError.validation("Password must be at least 8 characters.", "password");
    }
    const supaUser = await Supabase.verifySupabaseToken(supabaseAccessToken);
    if (!supaUser?.email) throw ApiError.unauthorized("Invalid Supabase session.");
    const staff = await byEmail(supaUser.email);
    if (!staff) {
      throw ApiError.notFound(
        "No staff record was provisioned for this email yet — ask an admin to add you first.",
        "NOT_PROVISIONED"
      );
    }
    if (staff.password_hash) {
      throw ApiError.conflict("This account has already been claimed — log in instead.", "ALREADY_CLAIMED");
    }
    staff.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await staff.save();
    return AuthHelper._issueSession(staff);
  }

  /** #59 — POST /auth/verify-password (step-up re-auth, doc 04 §9). */
  static async verifyPassword({ staffId, password }) {
    if (!password) throw ApiError.validation("password is required.", "password");
    const staff = await Staff().findByPk(staffId);
    if (!staff || !staff.password_hash || !(await bcrypt.compare(password, staff.password_hash))) {
      throw ApiError.unauthorized("Incorrect password.");
    }
    return { reauth_token: JWT.signReauthToken({ sub: staffId }), expires_in: 300 };
  }

  /** #4 — GET /auth/me. `scope` still comes from Auth.middleware's resolveScope (mock-mode
   *  permissive scope by default) — real scope resolution reads StaffDept, which belongs to
   *  the staff/department domain, not these 9 auth endpoints. Only the staff record itself is
   *  real here. */
  static async me(staffId, scope) {
    const staff = await Staff().findByPk(staffId);
    if (!staff) throw ApiError.notFound("Staff not found.");
    return { ...staff.toSafeJSON(), scope };
  }

  /** #5 — POST /auth/password/forgot. Always the same response regardless of whether the
   *  email exists (doc 03 §4) — prevents account enumeration either way. */
  static async forgotPassword(email) {
    const generic = { message: "If that email exists, a reset link has been sent." };
    if (!email) return generic;
    const staff = await byEmail(email);
    if (!staff) return generic;
    const reset_token = JWT.signResetToken({ sub: staff._id });
    const reset_link = `${appConf.frontendBaseUrl}/reset-password?token=${reset_token}`;
    if (Email.configured) {
      await Email.sendMail({
        to: staff.email,
        subject: "Reset your TCOS Finance password",
        html: `<p>Someone asked to reset the password for this account.</p><p><a href="${reset_link}">Reset your password</a> — this link expires in 15 minutes.</p><p>If this wasn't you, ignore this email.</p>`,
      });
      logger.info({ staffId: staff._id, email: staff.email }, "password reset email sent");
    } else {
      // No SMTP_HOST/SMTP_USER/SMTP_PASSWORD set (see Email.util.js) — logging the reset link
      // is a real, working stand-in until an admin fills those in. Grab it from the server log
      // to test the reset flow locally.
      logger.info({ staffId: staff._id, email: staff.email, reset_link }, "password reset requested — no email provider configured, link logged instead of sent");
    }
    return generic;
  }

  /** #6 — POST /auth/password/reset. */
  static async resetPassword({ reset_token, password }) {
    if (!password || password.length < 8) {
      throw ApiError.validation("Password must be at least 8 characters.", "password");
    }
    if (!reset_token) throw ApiError.validation("reset_token is required.", "reset_token");
    let payload;
    try {
      payload = JWT.verify(reset_token);
    } catch {
      throw ApiError.unauthorized("This reset link is invalid or has expired.", "INVALID_RESET_TOKEN");
    }
    if (payload.typ !== "reset") {
      throw ApiError.unauthorized("This reset link is invalid or has expired.", "INVALID_RESET_TOKEN");
    }
    const staff = await Staff().findByPk(payload.sub);
    if (!staff) throw ApiError.notFound("Staff not found.");
    staff.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await staff.save();
    // NOTE: existing access/refresh tokens for this staff member stay valid until they
    // naturally expire — there's no session store/denylist (doc 02 §6), so "invalidate every
    // outstanding refresh token" isn't actually implementable server-side yet. Real gap, not
    // silently skipped: worth a session table if this needs closing before launch.
    return null;
  }

  /** Not an endpoint itself — shared by login/refresh/claim/loginViaSupabase. */
  static _issueSession(staffRecord) {
    const access_token = JWT.signAccessToken({
      sub: staffRecord._id,
      role: staffRecord.role,
      nickname: staffRecord.nickname,
    });
    const refresh_token = JWT.signRefreshToken({ sub: staffRecord._id });
    return {
      access_token,
      refresh_token,
      token_type: "Bearer",
      expires_in: 900,
      staff: {
        _id: staffRecord._id,
        nickname: staffRecord.nickname,
        email: staffRecord.email,
        role: staffRecord.role,
      },
    };
  }
}

module.exports = AuthHelper;
