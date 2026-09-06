/**
 * Projects, tags and departments — dev plan "Backend - API > Project" and the
 * /project/<project_id> page.
 *
 * The central question this file asks is a delivery question, not a CRUD question: once the
 * system is handed to the owner, can a privileged user create a project and then actually
 * *use* it? Everything else here is ordinary contract coverage.
 */
const { api } = require("./helpers/client");
const { login, admin, PREFIX } = require("./helpers/context");

/** Seeded project every existing membership points at (supabase/seed.sql). */
const SEEDED_PROJECT = "10000000-0000-0000-0000-000000000001";

let adminSession;   // role=admin, NO staff_dept rows at all
let financeSession; // role=admin AND is_finance/is_manager on SEEDED_PROJECT
let staffSession;   // role=staff, member of one department on SEEDED_PROJECT

beforeAll(async () => {
  adminSession = await login(admin.email, admin.password);
  financeSession = await login("chompoo@tcos.app", "Passw0rd!2026");
  staffSession = await login("mark@tcos.app", "Passw0rd!2026");
});

describe("#17 list projects", () => {
  test("any authenticated staff member can list projects", async () => {
    const res = await api.get("/projects?limit=50", { token: staffSession.token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });
});

describe("#18-#27 a newly created project must be usable by the person who created it", () => {
  let projectId;

  test("finance/admin can create a project", async () => {
    const res = await api.post("/projects", {
      token: financeSession.token,
      body: { name: `${PREFIX} Lifecycle`, description: "end-to-end test project", allocated_budget: 100000 },
    });
    expect(res.status).toBe(201);
    projectId = res.data._id;
    expect(projectId).toEqual(expect.any(String));
  });

  test("the creator can read the project back", async () => {
    // requireScope("isMember") — FLAG_CHECKS.isMember has no `scope.isGlobal ||` bypass, unlike
    // its sibling predicates, and a brand-new project has no staff_dept rows by definition.
    const res = await api.get(`/projects/${projectId}`, { token: financeSession.token });
    expect(res.status).toBe(200);
  });

  test("the creator can add departments to it", async () => {
    const res = await api.post(`/projects/${projectId}/departments`, {
      token: financeSession.token,
      body: { departments: [{ name: `${PREFIX} Dept A`, allocated_budget: 50000 }] },
    });
    expect(res.status).toBe(201);
  });

  test("the creator can add tags to it", async () => {
    const res = await api.post(`/projects/${projectId}/tags`, {
      token: financeSession.token,
      body: { tags: [{ name: `${PREFIX} Tag A`, allocated_budget: 25000 }] },
    });
    expect(res.status).toBe(201);
  });

  test("the creator can list its staff", async () => {
    const res = await api.get(`/projects/${projectId}/staff`, { token: financeSession.token });
    expect(res.status).toBe(200);
  });
});

describe("role=admin must reach every read the dev plan grants it", () => {
  // Frontend tab, Flow & User Interface: "role=Admin ต้องเห็นทุกปุ่ม" — admin sees every button.
  // A button the UI shows but the API refuses is worse than a hidden one.
  const reads = [
    ["project detail", `/projects/${SEEDED_PROJECT}`],
    ["departments", `/projects/${SEEDED_PROJECT}/departments`],
    ["tags", `/projects/${SEEDED_PROJECT}/tags`],
    ["project staff", `/projects/${SEEDED_PROJECT}/staff`],
    ["funding sources", `/projects/${SEEDED_PROJECT}/sources`],
    ["staff directory", "/staff"],
    ["checkslip queue", `/payments?project_id=${SEEDED_PROJECT}`],
  ];

  test.each(reads)("admin can read %s", async (_label, path) => {
    const res = await api.get(path, { token: adminSession.token });
    expect(res.status).toBe(200);
  });
});

describe("#19-#29 scoped project access for an ordinary staff member", () => {
  test("a member can read the project they belong to", async () => {
    const res = await api.get(`/projects/${SEEDED_PROJECT}`, { token: staffSession.token });
    expect(res.status).toBe(200);
  });

  test("a member can list its departments", async () => {
    const res = await api.get(`/projects/${SEEDED_PROJECT}/departments`, { token: staffSession.token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("a plain staff member cannot create a project", async () => {
    const res = await api.post("/projects", { token: staffSession.token, body: { name: `${PREFIX} Should Not Exist` } });
    expect(res.status).toBe(403);
  });

  test("a plain staff member cannot add departments", async () => {
    const res = await api.post(`/projects/${SEEDED_PROJECT}/departments`, {
      token: staffSession.token,
      body: { departments: [{ name: `${PREFIX} Nope`, allocated_budget: 1 }] },
    });
    expect(res.status).toBe(403);
  });

  test("a plain staff member cannot delete the project", async () => {
    const res = await api.del(`/projects/${SEEDED_PROJECT}`, { token: staffSession.token });
    expect(res.status).toBe(403);
  });
});

describe("#20 aggregate columns are never client-writable", () => {
  test("total_income in a PATCH body is rejected", async () => {
    const res = await api.patch(`/projects/${SEEDED_PROJECT}`, {
      token: financeSession.token,
      body: { total_income: 999999999 },
    });
    expect(res.status).toBe(400);
  });

  test("total_expense in a PATCH body is rejected", async () => {
    const res = await api.patch(`/projects/${SEEDED_PROJECT}`, {
      token: financeSession.token,
      body: { total_expense: 999999999 },
    });
    expect(res.status).toBe(400);
  });
});

describe("unauthenticated access", () => {
  test("project list requires a session", async () => {
    const res = await api.get("/projects");
    expect(res.status).toBe(401);
  });
});
