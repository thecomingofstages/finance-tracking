/**
 * Reporting endpoints backing the landing page and /project/<project_id>.
 *
 * Out of scope by instruction (requirements still unsettled): #52 /reports/journal,
 * #53 /reports/journal/export, #54 /reports/ledger, and the print-overall-income/expense
 * feature. They are not exercised here.
 */
const { api } = require("./helpers/client");
const { login, admin } = require("./helpers/context");

const SEED_PASSWORD = "Passw0rd!2026";
const PROJECT = "10000000-0000-0000-0000-000000000001";

let finance;
let staff;
let adminSession;

beforeAll(async () => {
  finance = await login("chompoo@tcos.app", SEED_PASSWORD);
  staff = await login("mark@tcos.app", SEED_PASSWORD);
  adminSession = await login(admin.email, admin.password);
});

describe("#50 dashboard summary", () => {
  let summary;

  test("returns the totals the landing page renders", async () => {
    const res = await api.get("/reports/summary", { token: finance.token });
    expect(res.status).toBe(200);
    summary = res.data;
    expect(summary).toMatchObject({
      total_income: expect.any(Number),
      total_expense: expect.any(Number),
      net_income: expect.any(Number),
    });
  });

  test("net_income is genuinely income minus expense", async () => {
    expect(summary.net_income).toBe(summary.total_income - summary.total_expense);
  });

  test("the dashboard aliases agree with the documented fields", async () => {
    // web/ reads net_cashflow and pending_count; swagger documents net_income and
    // pending_slips.count. They are the same numbers under two names — if they ever diverge
    // the dashboard silently shows something different from the API contract.
    expect(summary.net_cashflow).toBe(summary.net_income);
    expect(summary.pending_count).toBe(summary.pending_slips.count);
  });

  test("money fields are integers — satang, never floats", async () => {
    // Database Design note: "All money amounts are in Thai Satang, stores in int4".
    [summary.total_income, summary.total_expense, summary.net_income].forEach((v) => {
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  test("a plain staff member gets a summary scoped to them, not a 500", async () => {
    const res = await api.get("/reports/summary", { token: staff.token });
    expect(res.status).toBe(200);
  });

  test("requires authentication", async () => {
    const res = await api.get("/reports/summary");
    expect(res.status).toBe(401);
  });
});

describe("#51 cashflow", () => {
  test("finance can read a project's cashflow breakdown", async () => {
    const res = await api.get(`/reports/cashflow?project_id=${PROJECT}`, { token: finance.token });
    expect(res.status).toBe(200);
  });

  test("a plain staff member cannot", async () => {
    // swagger: "finance/owner only".
    const res = await api.get(`/reports/cashflow?project_id=${PROJECT}`, { token: staff.token });
    expect(res.status).toBe(403);
  });

  test("an unknown project id is a 404, not an empty 200", async () => {
    const res = await api.get("/reports/cashflow?project_id=00000000-0000-0000-0000-0000000000ff", { token: finance.token });
    expect(res.status).toBe(404);
  });
});

describe("#55 top expenses", () => {
  test("returns line items for a project", async () => {
    const res = await api.get(`/reports/top-expenses?project_id=${PROJECT}&limit=5`, { token: finance.token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("results are ordered most expensive first", async () => {
    const res = await api.get(`/reports/top-expenses?project_id=${PROJECT}&limit=10`, { token: finance.token });
    const amounts = res.data.map((r) => r.amount ?? r.total ?? 0);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  test("the limit is honoured", async () => {
    const res = await api.get(`/reports/top-expenses?project_id=${PROJECT}&limit=3`, { token: finance.token });
    expect(res.data.length).toBeLessThanOrEqual(3);
  });
});

describe("#56 sponsors", () => {
  test("finance can read sponsor detail for a project", async () => {
    const res = await api.get(`/reports/sponsors?project_id=${PROJECT}`, { token: finance.token });
    expect(res.status).toBe(200);
  });

  test("a plain staff member cannot", async () => {
    const res = await api.get(`/reports/sponsors?project_id=${PROJECT}`, { token: staff.token });
    expect(res.status).toBe(403);
  });
});
