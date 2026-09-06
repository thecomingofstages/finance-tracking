/**
 * Deployment-shape checks. Nothing here touches business logic — these are the things that
 * only break once the three tiers sit on three different origins (Cloudflare Workers ->
 * Railway -> Supabase Cloud) and that an in-process supertest suite structurally cannot see.
 */
const { api, BASE, WEB_ORIGIN } = require("./helpers/client");

describe("deployment: reachability", () => {
  test("API root reports non-mock mode", async () => {
    const res = await api.get(`${BASE}/`);
    expect(res.status).toBe(200);
    // A deployed stack serving fixtures would make every other test in this suite meaningless.
    expect(res.data.mockMode).toBe(false);
  });

  test("health endpoint is ok", async () => {
    const res = await api.get("/health");
    expect(res.status).toBe(200);
    expect(res.data.status).toBe("ok");
  });

  test("frontend worker responds", async () => {
    const res = await fetch(WEB_ORIGIN);
    expect(res.status).toBe(200);
  });
});

describe("deployment: CORS between Worker and Railway", () => {
  test("preflight allows the Worker origin with credentials", async () => {
    const res = await api.options("/auth/login", {
      headers: { "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
    });
    expect([200, 204]).toContain(res.status);
    expect(res.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  test("preflight allows the headers the client actually sends", async () => {
    // client.ts sends Authorization on every call and X-Reauth-Token on the step-up routes.
    // If they aren't in Access-Control-Allow-Headers the browser blocks the request outright.
    const res = await api.options("/reimbursements", {
      headers: {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type,x-reauth-token",
      },
    });
    const allowed = (res.headers.get("access-control-allow-headers") || "").toLowerCase();
    expect(allowed).toContain("authorization");
    expect(allowed).toContain("x-reauth-token");
  });
});

describe("deployment: refresh cookie must survive a cross-site frontend", () => {
  test("refresh_token cookie is usable from the Worker origin", async () => {
    const res = await api.post("/auth/login", {
      body: { email: process.env.E2E_ADMIN_EMAIL || "admin@example.com", password: process.env.E2E_ADMIN_PASSWORD || "password1234" },
    });
    expect(res.status).toBe(200);
    const cookie = res.setCookie.find((c) => c.startsWith("refresh_token="));
    expect(cookie).toBeDefined();

    // The Worker origin (*.workers.dev) and the API origin (*.up.railway.app) are different
    // registrable domains, so every call the browser makes to the API is cross-site. A
    // SameSite=Strict (or Lax) cookie is never attached to those requests, which means
    // POST /auth/refresh can never see it and the session dies at the access-token TTL.
    expect(cookie).toMatch(/SameSite=None/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/HttpOnly/i);
  });
});

describe("deployment: security headers", () => {
  test("HSTS, nosniff and frame protection are present", async () => {
    const res = await api.get("/health");
    expect(res.headers.get("strict-transport-security")).toBeTruthy();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBeTruthy();
  });

  test("interactive API docs are not publicly exposed in production", async () => {
    // swagger-ui + the raw spec enumerate every route and payload shape for an unauthenticated
    // caller. Fine for a staging box, not for the instance holding real finance records.
    const res = await api.get(`${BASE}/api-docs.json`);
    expect(res.status).toBe(404);
  });
});
