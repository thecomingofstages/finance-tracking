const ApiError = require("../utils/ApiError.util");
const JWT = require("../utils/JWT.util");
const { app: appConf } = require("../config/init");
const fixtures = require("../../mocks/fixtures");

/**
 * MOCK_MODE: every credential "succeeds" — login/claim mint a real signed JWT for a fabricated
 * staff record built from whatever was submitted, so FE gets a genuinely working session
 * (real expiry, real 401s, real refresh) without a real staff table behind it yet.
 * Grep this file for `TODO(mock)` to find every spot that needs a real Staff-model lookup
 * once this domain's MOCK_MODE goes false. Endpoint numbers (#N) match the tracking table in
 * docs/backend/03-api-spec.md §2.
 */
class AuthHelper {
  /** #1 — POST /auth/login */
  static async login({ email, password }) {
    if (!email || !password) throw ApiError.validation("email and password are required.");
    if (!appConf.mockMode) {
      // TODO(mock): find live Staff by email (case-insensitive once doc 02 §6 gap #4 is
      // fixed), bcrypt.compare against password_hash, 401 INVALID_CREDENTIALS on either
      // failure — never distinguish "no such email" from "wrong password" (doc 03 §4).
      throw new Error("AuthHelper.login: real implementation not wired up yet");
    }
    // TODO(mock): this accepts ANY password for a real-looking staff record fabricated from
    // the submitted email. Once real, this whole branch is replaced by the lookup above.
    const mockStaff = fixtures.staff({ email, nickname: email.split("@")[0] });
    return AuthHelper._issueSession(mockStaff);
  }

  /** #58 — POST /auth/login/supabase */
  static async loginViaSupabase({ supabaseEmail }) {
    // TODO(mock): verify the Supabase Auth session token, extract its email, then look up
    // live Staff by that email — 404 if not found or password_hash never set (doc 03 §4).
    const mockStaff = fixtures.staff({ email: supabaseEmail || "golf@tcos.app" });
    return AuthHelper._issueSession(mockStaff);
  }

  /** #57 — POST /auth/claim */
  static async claim({ password }) {
    if (!password || password.length < 8) {
      throw ApiError.validation("Password must be at least 8 characters.", "password");
    }
    // TODO(mock): verify the Supabase Auth session, look up live Staff by its email, 404 if
    // never provisioned, 409 ALREADY_CLAIMED if password_hash is already set, then
    // bcrypt-hash this password and $set it (doc 03 §4). Right now this always succeeds
    // against a fabricated staff record.
    const mockStaff = fixtures.staff();
    return AuthHelper._issueSession(mockStaff);
  }

  /** #59 — POST /auth/verify-password (step-up, see doc 04 §9) */
  static async verifyPassword({ staffId, password }) {
    if (!password) throw ApiError.validation("password is required.", "password");
    // TODO(mock): bcrypt.compare against the real staff row's password_hash instead of
    // accepting any non-empty password.
    return { reauth_token: JWT.signReauthToken({ sub: staffId }), expires_in: 300 };
  }

  /** #4 — GET /auth/me */
  static async me(staffId, scope) {
    // TODO(mock): load the real Staff row by staffId instead of fabricating one — this is
    // the endpoint FE hydrates the whole "current user" UI state from, so it's the first
    // one worth making real.
    return { ...fixtures.staff({ _id: staffId }), scope };
  }

  /** #5 — POST /auth/password/forgot */
  static async forgotPassword(_email) {
    // Real already, not mocked: always returns the same shape regardless of whether the
    // email exists — doc 03 §4 requires this to prevent account-enumeration either way.
    // TODO(mock): actually generate + email a reset token when a live Staff row matches.
    return { message: "If that email exists, a reset link has been sent." };
  }

  /** #6 — POST /auth/password/reset */
  static async resetPassword({ password }) {
    if (!password || password.length < 8) {
      throw ApiError.validation("Password must be at least 8 characters.", "password");
    }
    // TODO(mock): verify the reset token, bcrypt-hash + $set password_hash, and invalidate
    // every existing refresh token for that staff member. Currently a no-op that always
    // "succeeds".
    return null;
  }

  /** Not an endpoint itself — shared by login/claim/loginViaSupabase. Already real: signs
   *  genuine RS256 tokens regardless of MOCK_MODE, just against whatever staffRecord it's
   *  handed (real or fixture). */
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
