const ApiError = require("../utils/ApiError.util");
const JWT = require("../utils/JWT.util");
const { app: appConf } = require("../config/init");
const fixtures = require("../../mocks/fixtures");

/**
 * MOCK_MODE: every credential "succeeds" — login/claim mint a real signed JWT for a fabricated
 * staff record built from whatever was submitted, so FE gets a genuinely working session
 * (real expiry, real 401s, real refresh) without a real staff table behind it yet.
 * Swap the bodies marked TODO for real Staff-model lookups once Staff.helper.js is wired up.
 */
class AuthHelper {
  static async login({ email, password }) {
    if (!email || !password) throw ApiError.validation("email and password are required.");
    if (!appConf.mockMode) {
      // TODO: find live Staff by email (case-insensitive once doc 02 §6 gap #4 is fixed),
      // bcrypt.compare against password_hash, 401 INVALID_CREDENTIALS on either failure.
      throw new Error("AuthHelper.login: real implementation not wired up yet");
    }
    const mockStaff = fixtures.staff({ email, nickname: email.split("@")[0] });
    return AuthHelper._issueSession(mockStaff);
  }

  static async loginViaSupabase({ supabaseEmail }) {
    const mockStaff = fixtures.staff({ email: supabaseEmail || "golf@tcos.app" });
    return AuthHelper._issueSession(mockStaff);
  }

  static async claim({ password }) {
    if (!password || password.length < 8) {
      throw ApiError.validation("Password must be at least 8 characters.", "password");
    }
    const mockStaff = fixtures.staff();
    return AuthHelper._issueSession(mockStaff);
  }

  static async verifyPassword({ staffId, password }) {
    if (!password) throw ApiError.validation("password is required.", "password");
    // TODO: bcrypt.compare against the real staff row's password_hash.
    return { reauth_token: JWT.signReauthToken({ sub: staffId }), expires_in: 300 };
  }

  static async me(staffId, scope) {
    return { ...fixtures.staff({ _id: staffId }), scope };
  }

  static async forgotPassword(_email) {
    // Always returns the same shape regardless of whether the email exists — doc 03 §4.
    return { message: "If that email exists, a reset link has been sent." };
  }

  static async resetPassword({ password }) {
    if (!password || password.length < 8) {
      throw ApiError.validation("Password must be at least 8 characters.", "password");
    }
    // TODO: verify reset token, bcrypt-hash + $set password_hash, invalidate every refresh token.
    return null;
  }

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
