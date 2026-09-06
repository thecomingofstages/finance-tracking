/**
 * Funding sources (#33-36) and the /checkslip payment queue (#37-40).
 *
 * Payment *ingestion* (#37) is service-token-only and no SERVICE_TOKEN_ENROLL /
 * SERVICE_TOKEN_MERCH was issued for this run, so the tests below cover the queue, the
 * authorization boundary and the rejection of unauthenticated ingestion — not the creation of
 * new payments. See docs/e2e-report.md, "Not covered".
 */
const { api } = require("./helpers/client");
const { login, stepUp, PREFIX } = require("./helpers/context");

const SEED_PASSWORD = "Passw0rd!2026";
const PROJECT = "10000000-0000-0000-0000-000000000001";

let finance; // chompoo — is_finance on PROJECT
let staff;   // mark — plain member

beforeAll(async () => {
  finance = await login("chompoo@tcos.app", SEED_PASSWORD);
  staff = await login("mark@tcos.app", SEED_PASSWORD);
});

describe("#33/#34 funding sources", () => {
  let sourceId;

  test("finance can list a project's sources", async () => {
    const res = await api.get(`/projects/${PROJECT}/sources`, { token: finance.token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("a plain staff member cannot", async () => {
    const res = await api.get(`/projects/${PROJECT}/sources`, { token: staff.token });
    expect(res.status).toBe(403);
  });

  test("a sponsor source mirrors expect_amount into actual_amount immediately", async () => {
    // Dev plan, SOURCE table: spon/other have no approval step, so actual == expected at once;
    // enroll/merch stay at 0 until Finance approves the slips.
    const res = await api.post(`/projects/${PROJECT}/sources`, {
      token: finance.token,
      body: { type: "spon", name: `${PREFIX} Sponsor`, expect_amount: 75000 },
    });
    expect(res.status).toBe(201);
    sourceId = res.data._id;
    expect(res.data.actual_amount).toBe(75000);
  });

  test("an enroll source requires a reference_id", async () => {
    const res = await api.post(`/projects/${PROJECT}/sources`, {
      token: finance.token,
      body: { type: "enroll", name: `${PREFIX} Activity`, expect_amount: 10000 },
    });
    expect(res.status).toBe(400);
  });

  test("a sponsor source must NOT carry a reference_id", async () => {
    const res = await api.post(`/projects/${PROJECT}/sources`, {
      token: finance.token,
      body: {
        type: "spon",
        name: `${PREFIX} Sponsor with ref`,
        expect_amount: 1000,
        reference_id: "00000000-0000-0000-0000-0000000000cc",
      },
    });
    expect(res.status).toBe(400);
  });

  test("actual_amount is never client-writable", async () => {
    const res = await api.patch(`/sources/${sourceId}`, { token: finance.token, body: { actual_amount: 999999 } });
    expect(res.status).toBe(400);
  });

  test("type is never client-writable", async () => {
    const res = await api.patch(`/sources/${sourceId}`, { token: finance.token, body: { type: "merch" } });
    expect(res.status).toBe(400);
  });

  test("name and expect_amount are editable", async () => {
    const res = await api.patch(`/sources/${sourceId}`, {
      token: finance.token,
      body: { name: `${PREFIX} Sponsor (renamed)`, expect_amount: 80000 },
    });
    expect(res.status).toBe(200);
  });

  test("a plain staff member cannot create a source", async () => {
    const res = await api.post(`/projects/${PROJECT}/sources`, {
      token: staff.token,
      body: { type: "spon", name: `${PREFIX} Nope`, expect_amount: 1 },
    });
    expect(res.status).toBe(403);
  });

  test("finance can delete a source with no dependent payments", async () => {
    const res = await api.del(`/sources/${sourceId}`, { token: finance.token });
    expect(res.status).toBe(204);
  });
});

describe("#37 payment ingestion is service-token only", () => {
  test("a staff bearer token cannot ingest a payment", async () => {
    const res = await api.post("/payments", {
      token: finance.token,
      body: { _id: "00000000-0000-0000-0000-0000000000d1", source_id: "00000000-0000-0000-0000-0000000000d2", expected_amount: 100 },
    });
    expect(res.status).toBe(401);
  });

  test("an unauthenticated caller cannot ingest a payment", async () => {
    const res = await api.post("/payments", {
      body: { _id: "00000000-0000-0000-0000-0000000000d3", source_id: "00000000-0000-0000-0000-0000000000d4", expected_amount: 100 },
    });
    expect(res.status).toBe(401);
  });

  test("a forged service token is refused", async () => {
    const res = await api.post("/payments", {
      headers: { "X-Service-Token": "forged-service-token" },
      body: { _id: "00000000-0000-0000-0000-0000000000d5", source_id: "00000000-0000-0000-0000-0000000000d6", expected_amount: 100 },
    });
    expect(res.status).toBe(401);
  });
});

describe("#38 checkslip queue", () => {
  test("finance sees the queue for their project", async () => {
    const res = await api.get(`/payments?project_id=${PROJECT}`, { token: finance.token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("results are ordered oldest payment first", async () => {
    // Dev plan /checkslip: "เรียงจากเวลาชำระเงิน" — Finance works the backlog in arrival order.
    const res = await api.get(`/payments?project_id=${PROJECT}&limit=50`, { token: finance.token });
    const times = res.data.map((p) => new Date(p.created_at).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  test("project_id is required", async () => {
    const res = await api.get("/payments", { token: finance.token });
    expect(res.status).toBe(400);
  });

  test("a plain staff member cannot read the queue", async () => {
    const res = await api.get(`/payments?project_id=${PROJECT}`, { token: staff.token });
    expect(res.status).toBe(403);
  });
});

describe("#40 bulk approve", () => {
  test("step-up is required", async () => {
    const res = await api.post("/payments/approve", {
      token: finance.token,
      body: { payment_ids: ["00000000-0000-0000-0000-0000000000e1"], status: "approved" },
    });
    expect(res.status).toBe(401);
    expect(res.code).toBe("REAUTH_REQUIRED");
  });

  test("a plain staff member cannot approve payments", async () => {
    const reauth = await stepUp(staff.token, SEED_PASSWORD);
    const res = await api.post("/payments/approve", {
      token: staff.token, reauth,
      body: { payment_ids: ["00000000-0000-0000-0000-0000000000e1"], status: "approved" },
    });
    expect(res.status).toBe(403);
  });
});
