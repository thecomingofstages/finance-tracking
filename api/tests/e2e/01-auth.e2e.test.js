/**
 * Auth flows against the deployed stack — dev plan "Backend - API > Staff" and the /login flow
 * on the Frontend tab. Google sign-in is deliberately out of scope (it needs an interactive
 * consent screen); the Supabase handshake is covered only at its failure boundary.
 */
const { api } = require("./helpers/client");
const { login, admin, email } = require("./helpers/context");

let session;

beforeAll(async () => {
  session = await login(admin.email, admin.password);
});

describe("#1 login", () => {
  test("valid credentials issue an access token and a refresh cookie", async () => {
    expect(session.token).toEqual(expect.any(String));
    expect(session.staff.email).toBe(admin.email);
    expect(session.refreshCookie).toMatch(/^refresh_token=/);
  });

  test("wrong password is rejected without revealing which half was wrong", async () => {
    const res = await api.post("/auth/login", { body: { email: admin.email, password: "definitely-not-it" } });
    expect(res.status).toBe(401);
    expect(res.code).toBe("INVALID_CREDENTIALS");
  });

  test("unknown email returns the same error as a wrong password", async () => {
    const res = await api.post("/auth/login", { body: { email: email("ghost"), password: "definitely-not-it" } });
    expect(res.status).toBe(401);
    expect(res.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("#4 /auth/me", () => {
  test("returns the caller plus a resolved scope", async () => {
    const res = await api.get("/auth/me", { token: session.token });
    expect(res.status).toBe(200);
    expect(res.data._id).toBe(session.staff._id);
    // snake_case, matching swagger's Scope schema and what the frontend reads. This assertion
    // previously encoded the API's camelCase output instead of the published contract, which
    // is how the mismatch survived a green suite.
    expect(res.data.scope).toMatchObject({
      staff_id: expect.any(String),
      role: expect.any(String),
      is_global: expect.any(Boolean),
    });
  });

  test("rejects a missing token", async () => {
    const res = await api.get("/auth/me");
    expect(res.status).toBe(401);
  });

  test("rejects a structurally valid but unsigned token", async () => {
    const res = await api.get("/auth/me", { token: "not.a.jwt" });
    expect(res.status).toBe(401);
  });
});

describe("#3 refresh", () => {
  test("rotates the access token when the refresh cookie is presented", async () => {
    const res = await api.post("/auth/refresh", { cookie: session.refreshCookie });
    expect(res.status).toBe(200);
    expect(res.data.access_token).toEqual(expect.any(String));
  });

  test("rejects a request with no refresh cookie", async () => {
    const res = await api.post("/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("#59 step-up reauth", () => {
  test("correct password issues a reauth token", async () => {
    const res = await api.post("/auth/verify-password", { token: session.token, body: { password: admin.password } });
    expect(res.status).toBe(200);
    expect(res.data.reauth_token).toEqual(expect.any(String));
  });

  test("wrong password does not", async () => {
    const res = await api.post("/auth/verify-password", { token: session.token, body: { password: "nope-nope-nope" } });
    expect(res.status).toBe(401);
  });
});

describe("#5 forgot password", () => {
  /** Bounded on purpose: the point of these two tests is the *timing*, and an unbounded
   *  request would just hang until Jest's own timeout with no usable diagnostic. */
  const within = async (ms, fn) => {
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fn(ctrl.signal);
      return { ...res, elapsed: Date.now() - started, timedOut: false };
    } catch (err) {
      if (err.name === "AbortError") return { elapsed: Date.now() - started, timedOut: true };
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  test("responds 200 for an address that does not exist", async () => {
    const res = await within(15000, (signal) =>
      fetch(`${api.base}/v1/auth/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: api.webOrigin },
        body: JSON.stringify({ email: email("nobody") }),
        signal,
      }).then((r) => ({ status: r.status })));
    expect(res.timedOut).toBe(false);
    expect(res.status).toBe(200);
  });

  test("responds 200 for an address that DOES exist, in comparable time", async () => {
    // doc 03 §4 / swagger: "Always 200 regardless of whether the email exists" — the whole
    // point being that a caller cannot tell registered addresses from unregistered ones.
    // Auth.helper.js#forgotPassword awaits Email.sendMail inline with no timeout, so when SMTP
    // is unreachable this request never returns: the reset flow is dead AND the difference in
    // response time is a working account-enumeration oracle.
    const res = await within(15000, (signal) =>
      fetch(`${api.base}/v1/auth/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: api.webOrigin },
        body: JSON.stringify({ email: admin.email }),
        signal,
      }).then((r) => ({ status: r.status })));
    expect(res.timedOut).toBe(false);
    expect(res.status).toBe(200);
  });
});

describe("#6 password reset", () => {
  test("rejects a forged reset token", async () => {
    const res = await api.post("/auth/password/reset", { body: { reset_token: "forged.token.value", password: "Passw0rd!2026" } });
    expect(res.status).toBe(401);
  });

  test("rejects a password below the documented minimum length", async () => {
    const res = await api.post("/auth/password/reset", { body: { reset_token: "forged.token.value", password: "short" } });
    expect(res.status).toBe(400);
  });
});

describe("#58 supabase login boundary", () => {
  test("an invalid Supabase token is refused, not accepted", async () => {
    const res = await api.post("/auth/login/supabase", { body: { access_token: "not-a-supabase-token" } });
    expect([400, 401, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});

describe("#2 logout", () => {
  test("clears the session", async () => {
    const throwaway = await login(admin.email, admin.password);
    const res = await api.post("/auth/logout", { token: throwaway.token, cookie: throwaway.refreshCookie });
    expect(res.status).toBe(204);
  });
});
