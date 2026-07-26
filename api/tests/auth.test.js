const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../src/app/models", () => ({
  Staff: { findOne: jest.fn(), findByPk: jest.fn() },
}));
jest.mock("../src/app/utils/Supabase.util", () => ({
  verifySupabaseToken: jest.fn(),
}));
jest.mock("../src/app/utils/Email.util", () => ({
  configured: false,
  sendMail: jest.fn(),
}));
// Rate limiting is shared, cross-route, IP-keyed middleware (see RateLimit.middleware.js) —
// not part of the auth logic itself, and its shared in-memory bucket would otherwise start
// rejecting requests partway through this file regardless of test order. Bypassed here so the
// suite tests auth behavior, not express-rate-limit's bookkeeping.
jest.mock("../src/app/middleware/RateLimit.middleware", () => ({
  authAttempts: (req, res, next) => next(),
  general: (req, res, next) => next(),
}));

const { Staff } = require("../src/app/models");
const Supabase = require("../src/app/utils/Supabase.util");
const Email = require("../src/app/utils/Email.util");
const { buildApp } = require("./helpers/app");
const { makeStaff, hashed } = require("./helpers/factories");
const JWT = require("../src/app/utils/JWT.util");
const { keys } = require("../src/app/config/init");

const app = buildApp();

beforeEach(() => {
  jest.clearAllMocks();
  Email.configured = false;
});

describe("POST /v1/auth/login (#1)", () => {
  it("logs in with the correct password and never returns refresh_token or password_hash in the body", async () => {
    const staff = makeStaff({ email: "Golf@TCOS.app", password_hash: await hashed("correct-horse") });
    Staff.findOne.mockResolvedValueOnce(staff);

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "golf@tcos.app", password: "correct-horse" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.access_token).toEqual(expect.any(String));
    expect(res.body.data.refresh_token).toBeUndefined();
    expect(res.body.data.staff.password_hash).toBeUndefined();
    expect(res.body.data.staff.email).toBe("Golf@TCOS.app");
    expect(res.headers["set-cookie"][0]).toMatch(/^refresh_token=/);

    // case-insensitive lookup, per doc 02 §6 gap #4
    expect(Staff.findOne).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong password with a generic 401", async () => {
    const staff = makeStaff({ password_hash: await hashed("correct-horse") });
    Staff.findOne.mockResolvedValueOnce(staff);

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: staff.email, password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(res.body.error.message).toBe("Incorrect email or password.");
  });

  it("rejects an unknown email with the SAME generic 401 (no account enumeration)", async () => {
    Staff.findOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "nobody@tcos.app", password: "whatever1" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Incorrect email or password.");
  });

  it("rejects a never-claimed account (password_hash still null) the same way", async () => {
    Staff.findOne.mockResolvedValueOnce(makeStaff({ password_hash: null }));

    const res = await request(app)
      .post("/v1/auth/login")
      .send({ email: "unclaimed@tcos.app", password: "whatever1" });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Incorrect email or password.");
  });

  it("400s on a malformed body before ever touching the Staff model (zod)", async () => {
    const res = await request(app).post("/v1/auth/login").send({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Staff.findOne).not.toHaveBeenCalled();
  });
});

describe("POST /v1/auth/refresh (#3)", () => {
  it("issues a new access token from a valid refresh cookie", async () => {
    const staff = makeStaff();
    Staff.findByPk.mockResolvedValueOnce(staff);
    const refreshToken = JWT.signRefreshToken({ sub: staff._id });

    const res = await request(app).post("/v1/auth/refresh").set("Cookie", [`refresh_token=${refreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toEqual(expect.any(String));
    expect(Staff.findByPk).toHaveBeenCalledWith(staff._id);
  });

  it("401s with no cookie at all", async () => {
    const res = await request(app).post("/v1/auth/refresh");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REFRESH_REQUIRED");
  });

  it("401s a token of the wrong type (an access token reused as a refresh token)", async () => {
    const staff = makeStaff();
    const accessToken = JWT.signAccessToken({ sub: staff._id, role: staff.role, nickname: staff.nickname });

    const res = await request(app).post("/v1/auth/refresh").set("Cookie", [`refresh_token=${accessToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("401s an expired refresh token", async () => {
    const staff = makeStaff();
    const expired = jwt.sign({ sub: staff._id, typ: "refresh" }, keys.jwtPrivateKey, {
      algorithm: "RS256",
      expiresIn: -10,
    });

    const res = await request(app).post("/v1/auth/refresh").set("Cookie", [`refresh_token=${expired}`]);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("401s if the staff row behind a still-valid refresh token is gone", async () => {
    const staff = makeStaff();
    Staff.findByPk.mockResolvedValueOnce(null);
    const refreshToken = JWT.signRefreshToken({ sub: staff._id });

    const res = await request(app).post("/v1/auth/refresh").set("Cookie", [`refresh_token=${refreshToken}`]);

    expect(res.status).toBe(401);
  });
});

describe("GET /v1/auth/me (#4)", () => {
  function bearer(staff) {
    return `Bearer ${JWT.signAccessToken({ sub: staff._id, role: staff.role, nickname: staff.nickname })}`;
  }

  it("returns the real staff record (password_hash stripped) plus scope", async () => {
    const staff = makeStaff({ email: "me@tcos.app" });
    Staff.findByPk.mockResolvedValueOnce(staff);

    const res = await request(app).get("/v1/auth/me").set("Authorization", bearer(staff));

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("me@tcos.app");
    expect(res.body.data.password_hash).toBeUndefined();
    expect(res.body.data.scope).toBeDefined();
  });

  it("401s with no Authorization header", async () => {
    const res = await request(app).get("/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("404s if the staff row was deleted after the token was issued", async () => {
    const staff = makeStaff();
    Staff.findByPk.mockResolvedValueOnce(null);

    const res = await request(app).get("/v1/auth/me").set("Authorization", bearer(staff));

    expect(res.status).toBe(404);
  });
});

describe("POST /v1/auth/logout (#2)", () => {
  it("clears the refresh cookie for an authenticated caller", async () => {
    const staff = makeStaff();
    const token = JWT.signAccessToken({ sub: staff._id, role: staff.role, nickname: staff.nickname });

    const res = await request(app).post("/v1/auth/logout").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(res.headers["set-cookie"][0]).toMatch(/^refresh_token=;/);
  });

  it("401s without a Bearer token", async () => {
    const res = await request(app).post("/v1/auth/logout");
    expect(res.status).toBe(401);
  });
});

describe("POST /v1/auth/password/forgot (#5)", () => {
  it("returns the generic message when the email exists", async () => {
    Staff.findOne.mockResolvedValueOnce(makeStaff({ email: "exists@tcos.app" }));

    const res = await request(app).post("/v1/auth/password/forgot").send({ email: "exists@tcos.app" });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe("If that email exists, a reset link has been sent.");
  });

  it("returns the exact same message when the email does not exist (no account enumeration)", async () => {
    Staff.findOne.mockResolvedValueOnce(null);

    const res = await request(app).post("/v1/auth/password/forgot").send({ email: "nobody@tcos.app" });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe("If that email exists, a reset link has been sent.");
  });

  it("when Email is not configured, never calls sendMail (falls back to logging the link)", async () => {
    Staff.findOne.mockResolvedValueOnce(makeStaff({ email: "exists@tcos.app" }));

    await request(app).post("/v1/auth/password/forgot").send({ email: "exists@tcos.app" });

    expect(Email.sendMail).not.toHaveBeenCalled();
  });

  it("when Email is configured, actually sends the reset email instead of just logging it", async () => {
    Email.configured = true;
    const staff = makeStaff({ email: "exists@tcos.app" });
    Staff.findOne.mockResolvedValueOnce(staff);

    const res = await request(app).post("/v1/auth/password/forgot").send({ email: "exists@tcos.app" });

    expect(res.status).toBe(200);
    expect(Email.sendMail).toHaveBeenCalledTimes(1);
    const call = Email.sendMail.mock.calls[0][0];
    expect(call.to).toBe("exists@tcos.app");
    expect(call.subject).toMatch(/reset/i);
    expect(call.html).toContain("reset-password?token=");
  });

  it("400s a malformed email", async () => {
    const res = await request(app).post("/v1/auth/password/forgot").send({ email: "nope" });
    expect(res.status).toBe(400);
  });
});

describe("POST /v1/auth/password/reset (#6)", () => {
  it("resets the password with a valid reset token and actually persists a new hash", async () => {
    const staff = makeStaff({ password_hash: await hashed("old-password") });
    Staff.findByPk.mockResolvedValueOnce(staff);
    const resetToken = JWT.signResetToken({ sub: staff._id });

    const res = await request(app)
      .post("/v1/auth/password/reset")
      .send({ reset_token: resetToken, password: "brand-new-pw" });

    expect(res.status).toBe(204);
    expect(staff.save).toHaveBeenCalledTimes(1);
    const bcrypt = require("bcrypt");
    await expect(bcrypt.compare("brand-new-pw", staff.password_hash)).resolves.toBe(true);
    await expect(bcrypt.compare("old-password", staff.password_hash)).resolves.toBe(false);
  });

  it("401s a garbage reset token", async () => {
    const res = await request(app)
      .post("/v1/auth/password/reset")
      .send({ reset_token: "not-a-real-token", password: "brand-new-pw" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("401s a token of the wrong type (e.g. an access token)", async () => {
    const staff = makeStaff();
    const accessToken = JWT.signAccessToken({ sub: staff._id, role: staff.role, nickname: staff.nickname });

    const res = await request(app)
      .post("/v1/auth/password/reset")
      .send({ reset_token: accessToken, password: "brand-new-pw" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("400s a too-short password", async () => {
    const res = await request(app)
      .post("/v1/auth/password/reset")
      .send({ reset_token: "irrelevant-here", password: "short" });

    expect(res.status).toBe(400);
  });
});

describe("POST /v1/auth/verify-password (#59, step-up)", () => {
  it("issues a reauth token for the correct password", async () => {
    const staff = makeStaff({ password_hash: await hashed("correct-horse") });
    Staff.findByPk.mockResolvedValueOnce(staff);
    const token = JWT.signAccessToken({ sub: staff._id, role: staff.role, nickname: staff.nickname });

    const res = await request(app)
      .post("/v1/auth/verify-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "correct-horse" });

    expect(res.status).toBe(200);
    expect(res.body.data.reauth_token).toEqual(expect.any(String));
    expect(res.body.data.expires_in).toBe(300);
  });

  it("401s the wrong password", async () => {
    const staff = makeStaff({ password_hash: await hashed("correct-horse") });
    Staff.findByPk.mockResolvedValueOnce(staff);
    const token = JWT.signAccessToken({ sub: staff._id, role: staff.role, nickname: staff.nickname });

    const res = await request(app)
      .post("/v1/auth/verify-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ password: "wrong" });

    expect(res.status).toBe(401);
  });
});

describe("POST /v1/auth/claim (#57)", () => {
  it("sets the password for a provisioned-but-unclaimed staff row", async () => {
    Supabase.verifySupabaseToken.mockResolvedValueOnce({ id: "supa-1", email: "new@tcos.app" });
    const staff = makeStaff({ email: "new@tcos.app", password_hash: null });
    Staff.findOne.mockResolvedValueOnce(staff);

    const res = await request(app)
      .post("/v1/auth/claim")
      .set("Authorization", "Bearer some-supabase-session-token")
      .send({ password: "first-real-pw" });

    expect(res.status).toBe(201);
    expect(res.body.data.access_token).toEqual(expect.any(String));
    expect(staff.save).toHaveBeenCalledTimes(1);
    const bcrypt = require("bcrypt");
    await expect(bcrypt.compare("first-real-pw", staff.password_hash)).resolves.toBe(true);
  });

  it("409s an already-claimed account", async () => {
    Supabase.verifySupabaseToken.mockResolvedValueOnce({ id: "supa-1", email: "already@tcos.app" });
    Staff.findOne.mockResolvedValueOnce(makeStaff({ password_hash: "$2b$04$alreadyset" }));

    const res = await request(app)
      .post("/v1/auth/claim")
      .set("Authorization", "Bearer some-supabase-session-token")
      .send({ password: "first-real-pw" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_CLAIMED");
  });

  it("404s an email with no provisioned staff row", async () => {
    Supabase.verifySupabaseToken.mockResolvedValueOnce({ id: "supa-1", email: "ghost@tcos.app" });
    Staff.findOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/v1/auth/claim")
      .set("Authorization", "Bearer some-supabase-session-token")
      .send({ password: "first-real-pw" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_PROVISIONED");
  });

  it("401s an invalid Supabase session token", async () => {
    const ApiError = require("../src/app/utils/ApiError.util");
    Supabase.verifySupabaseToken.mockRejectedValueOnce(ApiError.unauthorized("Invalid or expired Supabase session."));

    const res = await request(app)
      .post("/v1/auth/claim")
      .set("Authorization", "Bearer garbage")
      .send({ password: "first-real-pw" });

    expect(res.status).toBe(401);
  });
});

describe("POST /v1/auth/login/supabase (#58)", () => {
  it("logs in an already-claimed staff member via a Supabase session", async () => {
    Supabase.verifySupabaseToken.mockResolvedValueOnce({ id: "supa-2", email: "claimed@tcos.app" });
    Staff.findOne.mockResolvedValueOnce(makeStaff({ email: "claimed@tcos.app", password_hash: "$2b$04$alreadyset" }));

    const res = await request(app)
      .post("/v1/auth/login/supabase")
      .set("Authorization", "Bearer some-supabase-session-token");

    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toEqual(expect.any(String));
  });

  it("404s ACCOUNT_NOT_CLAIMED for a provisioned-but-never-claimed row", async () => {
    Supabase.verifySupabaseToken.mockResolvedValueOnce({ id: "supa-3", email: "unclaimed@tcos.app" });
    Staff.findOne.mockResolvedValueOnce(makeStaff({ password_hash: null }));

    const res = await request(app)
      .post("/v1/auth/login/supabase")
      .set("Authorization", "Bearer some-supabase-session-token");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_CLAIMED");
  });

  it("404s the same way for an email with no staff row at all", async () => {
    Supabase.verifySupabaseToken.mockResolvedValueOnce({ id: "supa-4", email: "ghost@tcos.app" });
    Staff.findOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/v1/auth/login/supabase")
      .set("Authorization", "Bearer some-supabase-session-token");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_CLAIMED");
  });
});

// Real unit test, no mocking — proves the guard clause without needing a network call.
describe("Supabase.util.verifySupabaseToken", () => {
  it("rejects a missing token without ever calling fetch", async () => {
    const real = jest.requireActual("../src/app/utils/Supabase.util");
    await expect(real.verifySupabaseToken(undefined)).rejects.toMatchObject({ status: 401 });
  });
});
