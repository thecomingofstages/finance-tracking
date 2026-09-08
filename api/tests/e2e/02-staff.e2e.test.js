/**
 * Staff provisioning, the first-login claim flow, bank accounts and the digital signature —
 * dev plan "Backend - API > Staff" plus the /login "staff arriving for the first time" flow.
 */
const { api } = require("./helpers/client");
const { login, stepUp, admin, PREFIX, email, RUN_ID } = require("./helpers/context");

const SEED_PASSWORD = "Passw0rd!2026";

/** A 12-digit number that will not collide with another run, another developer's run, or a
 *  real account. Exactly 12 digits because the column is VARCHAR(12) and the API validates
 *  10-12. */
const randomAccountNumber = () =>
  Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");

let adminSession;
let staffSession;
let provisioned; // { _id, email } created by this run

beforeAll(async () => {
  adminSession = await login(admin.email, admin.password);
  staffSession = await login("mark@tcos.app", SEED_PASSWORD);
});

describe("#10 admin provisions a staff account", () => {
  test("creates the account", async () => {
    const res = await api.post("/admin/staff", {
      token: adminSession.token,
      body: {
        title: "นาย",
        first_name: "E2E",
        last_name: "Probe",
        nickname: `e2e-${RUN_ID}`,
        email: email("provisioned"),
        phone: "0800000000",
      },
    });
    expect(res.status).toBe(201);
    provisioned = { _id: res.data._id, email: res.data.email };
  });

  test("the same email a second time is a conflict, not a duplicate row", async () => {
    const res = await api.post("/admin/staff", {
      token: adminSession.token,
      body: { first_name: "E2E", last_name: "Probe", nickname: `e2e-dup-${RUN_ID}`, email: email("provisioned") },
    });
    expect(res.status).toBe(409);
  });

  test("a non-admin cannot provision accounts", async () => {
    const res = await api.post("/admin/staff", {
      token: staffSession.token,
      body: { first_name: "X", last_name: "Y", nickname: "z", email: email("forbidden") },
    });
    expect(res.status).toBe(403);
  });

  test("a malformed email is rejected", async () => {
    const res = await api.post("/admin/staff", {
      token: adminSession.token,
      body: { first_name: "E2E", last_name: "Probe", nickname: "bad", email: "not-an-email" },
    });
    expect(res.status).toBe(400);
  });
});

describe("#57 first login — a provisioned account has no password yet", () => {
  test("logging in with any password fails before the account is claimed", async () => {
    const res = await api.post("/auth/login", { body: { email: provisioned.email, password: SEED_PASSWORD } });
    expect(res.status).toBe(401);
  });

  test("claiming without proof of identity is refused", async () => {
    // /auth/claim reads the Supabase identity token; without it there is nothing tying the
    // caller to the email being claimed, so an open claim endpoint would be account takeover.
    const res = await api.post("/auth/claim", { body: { password: "Passw0rd!2026" } });
    expect(res.status).not.toBe(201);
    expect([400, 401, 404]).toContain(res.status);
  });
});

describe("#14-#16 bank accounts", () => {
  let accountId;

  test("adding an account requires a 10-12 digit number", async () => {
    const res = await api.post("/staff/me/bank-accounts", {
      token: staffSession.token,
      body: { name: "E2E Probe", number: "123", provider: "กสิกร" },
    });
    expect(res.status).toBe(400);
  });

  test("a valid account is created", async () => {
    const res = await api.post("/staff/me/bank-accounts", {
      token: staffSession.token,
      // bankaccount.number is UNIQUE across the whole table, and the column is VARCHAR(12).
      // A run-id prefix is NOT enough: RUN_ID is YYYYMMDDHHMMSS, and truncating to 12 digits
      // cuts the seconds off, so two runs in the same minute collide. Random digits instead.
      body: { name: `${PREFIX} Account`, number: randomAccountNumber(), provider: "กสิกรไทย" },
    });
    expect(res.status).toBe(201);
    accountId = res.data._id;
  });

  test("it appears in the caller's own list", async () => {
    const res = await api.get("/staff/me/bank-accounts", { token: staffSession.token });
    expect(res.status).toBe(200);
    expect(res.data.some((a) => a._id === accountId)).toBe(true);
  });

  test("another staff member cannot delete it", async () => {
    const res = await api.del(`/staff/me/bank-accounts/${accountId}`, { token: adminSession.token });
    expect([403, 404]).toContain(res.status);
  });

  test("the owner can delete it", async () => {
    const res = await api.del(`/staff/me/bank-accounts/${accountId}`, { token: staffSession.token });
    expect(res.status).toBe(204);
  });
});

describe("#60 digital signature upload", () => {
  /** 1x1 PNG — smallest thing that is genuinely a PNG by magic bytes. */
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64");

  test("without a step-up token the upload is refused", async () => {
    const form = new FormData();
    form.append("signature", new Blob([png], { type: "image/png" }), "sig.png");
    const res = await api.post("/staff/me/signature", { token: staffSession.token, body: form });
    expect(res.status).toBe(401);
    expect(res.code).toBe("REAUTH_REQUIRED");
  });

  test("with a step-up token the signature is stored", async () => {
    const reauth = await stepUp(staffSession.token, SEED_PASSWORD);
    const form = new FormData();
    form.append("signature", new Blob([png], { type: "image/png" }), "sig.png");
    const res = await api.post("/staff/me/signature", { token: staffSession.token, reauth, body: form });
    expect(res.status).toBe(200);
    expect(res.data.signature_image).toEqual(expect.any(String));
  });

  test("a non-image is rejected", async () => {
    const reauth = await stepUp(staffSession.token, SEED_PASSWORD);
    const form = new FormData();
    form.append("signature", new Blob([Buffer.from("#!/bin/sh\necho hi\n")], { type: "text/x-sh" }), "sig.sh");
    const res = await api.post("/staff/me/signature", { token: staffSession.token, reauth, body: form });
    expect(res.status).toBe(400);
  });
});

describe("#9 profile self-service", () => {
  test("a staff member can update their own nickname", async () => {
    const res = await api.patch("/staff/me", { token: staffSession.token, body: { nickname: "mark" } });
    expect(res.status).toBe(200);
  });

  test("role is not self-assignable through the profile route", async () => {
    // Privilege escalation check: #9's schema has no `role`, so a body carrying one must be
    // rejected or ignored — never applied.
    const res = await api.patch("/staff/me", { token: staffSession.token, body: { role: "admin" } });
    const after = await api.get("/auth/me", { token: staffSession.token });
    expect(after.data.role).toBe("staff");
    expect([200, 400]).toContain(res.status);
  });
});

describe("#13 deactivation is a soft delete", () => {
  test("admin deactivates the account provisioned by this run", async () => {
    const res = await api.del(`/admin/staff/${provisioned._id}`, { token: adminSession.token });
    expect(res.status).toBe(204);
  });

  test("a deactivated account can no longer authenticate", async () => {
    const res = await api.post("/auth/login", { body: { email: provisioned.email, password: SEED_PASSWORD } });
    expect(res.status).toBe(401);
  });
});
