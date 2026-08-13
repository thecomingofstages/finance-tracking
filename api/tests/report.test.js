const request = require("supertest");

jest.mock("../src/app/models", () => ({
  sequelize: { query: jest.fn() },
}));
jest.mock("../src/app/middleware/RateLimit.middleware", () => ({
  authAttempts: (req, res, next) => next(),
  general: (req, res, next) => next(),
}));

const { sequelize } = require("../src/app/models");
const { buildApp } = require("./helpers/app");
const Report = require("../src/app/helpers/Report.helper");
const JWT = require("../src/app/utils/JWT.util");

const app = buildApp();
const PROJECT_ID = "550e8400-e29b-41d4-a716-446655440001";
const OTHER_PROJECT_ID = "550e8400-e29b-41d4-a716-446655440002";
const TAG_ID = "550e8400-e29b-41d4-a716-446655440003";
const DEPARTMENT_ID = "550e8400-e29b-41d4-a716-446655440004";
const financeAuth = `Bearer ${JWT.signAccessToken({ sub: "finance-id", role: "finance", nickname: "golf" })}`;

beforeEach(() => {
  jest.resetAllMocks();
  sequelize.query.mockResolvedValue([]);
});

describe("GET /v1/reports/summary (#50)", () => {
  it("returns real aggregate rows with both documented and dashboard-compatible field names", async () => {
    sequelize.query
      .mockResolvedValueOnce([
        {
          total_income: "900",
          total_expense: "300",
          allocated_budget: "500",
          outstanding_count: "2",
          outstanding_amount: "140",
          pending_count: "4",
        },
      ])
      .mockResolvedValueOnce([
        { tag_id: TAG_ID, name: "Venue", allocated_budget: "200", total_income: "50", total_expense: "120" },
      ])
      .mockResolvedValueOnce([
        { department_id: DEPARTMENT_ID, name: "Stage", allocated_budget: "300", total_expense: "180" },
      ]);

    const res = await request(app)
      .get(`/v1/reports/summary?project_id=${PROJECT_ID}&from=2026-07-01&to=2026-07-31`)
      .set("Authorization", financeAuth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        total_income: 900,
        total_expense: 300,
        net_income: 600,
        net_cashflow: 600,
        allocated_budget: 500,
        budget_used_pct: 60,
        pending_slips: { count: 4 },
        pending_count: 4,
        outstanding_reimbursements: { count: 2, amount: 140 },
      })
    );
    expect(res.body.data.by_tag[0]).toEqual(expect.objectContaining({ allocated_budget: 200, total_income: 50, total_expense: 120 }));
    expect(res.body.data.by_department[0]).toEqual(expect.objectContaining({ allocated_budget: 300, total_expense: 180 }));
    const [, options] = sequelize.query.mock.calls[0];
    expect(options.replacements).toEqual(expect.objectContaining({ projectId: PROJECT_ID, from: "2026-07-01", to: "2026-07-31" }));
  });

  it("400s a reversed date range before querying", async () => {
    const res = await request(app)
      .get("/v1/reports/summary?from=2026-08-02&to=2026-08-01")
      .set("Authorization", financeAuth);
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("to");
    expect(sequelize.query).not.toHaveBeenCalled();
  });

  it("rejects a requested project outside a non-global caller's scope", async () => {
    await expect(
      Report.summary(
        { project_id: OTHER_PROJECT_ID },
        { isGlobal: false, memberships: [{ projectId: PROJECT_ID }], financeOf: [], managerOf: [] }
      )
    ).rejects.toMatchObject({ status: 403, code: "NOT_PROJECT_MEMBER" });
    expect(sequelize.query).not.toHaveBeenCalled();
  });
});

describe("GET /v1/reports/cashflow (#51)", () => {
  it("returns income, expense, monthly, and budget-vs-actual views", async () => {
    sequelize.query
      .mockResolvedValueOnce([{ type: "enroll", amount: "700" }, { type: "spon", amount: "200" }])
      .mockResolvedValueOnce([
        { department_id: DEPARTMENT_ID, name: "Stage", allocated_budget: "500", total_expense: "300" },
      ])
      .mockResolvedValueOnce([{ tag_id: TAG_ID, name: "Venue", allocated_budget: "250", total_expense: "120" }])
      .mockResolvedValueOnce([{ month: "2026-07", income: "700", expense: "300" }]);

    const res = await request(app)
      .get(`/v1/reports/cashflow?project_id=${PROJECT_ID}&from=2026-07-01&to=2026-07-31`)
      .set("Authorization", financeAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.income_by_source_type).toEqual({ enroll: 700, merch: 0, spon: 200, other: 0 });
    expect(res.body.data.expense_by_department[0].total_expense).toBe(300);
    expect(res.body.data.expense_by_tag[0].total_expense).toBe(120);
    expect(res.body.data.monthly).toEqual([{ month: "2026-07", income: 700, expense: 300 }]);
    expect(res.body.data.budget_vs_actual[0]).toEqual(
      expect.objectContaining({ allocated_budget: 500, actual_expense: 300, remaining_budget: 200 })
    );
    expect(sequelize.query).toHaveBeenCalledTimes(4);
  });

  it("400s malformed dates", async () => {
    const res = await request(app).get("/v1/reports/cashflow?from=2026-02-31").set("Authorization", financeAuth);
    expect(res.status).toBe(400);
    expect(sequelize.query).not.toHaveBeenCalled();
  });
});

describe("GET /v1/reports/journal (#52)", () => {
  it("runs the documented income/expense UNION and normalizes money values", async () => {
    sequelize.query.mockResolvedValueOnce([
      { entry_date: "2026-07-01", side: "income", description: "Tickets", amount: "900", tag: null, project: "TCOS3" },
      { entry_date: "2026-07-02", side: "expense", description: "Curtain", amount: "300", tag: "Venue", project: "TCOS3" },
    ]);

    const res = await request(app)
      .get(`/v1/reports/journal?project_id=${PROJECT_ID}&month=2026-07`)
      .set("Authorization", financeAuth);

    expect(res.status).toBe(200);
    expect(res.body.data.map((row) => row.amount)).toEqual([900, 300]);
    const [sql, options] = sequelize.query.mock.calls[0];
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("r.latest_status = 'transfer'");
    expect(sql).toContain("ps.status = 'approved'");
    expect(options.replacements).toEqual(
      expect.objectContaining({ projectId: PROJECT_ID, monthFrom: "2026-07-01", monthTo: "2026-08-01" })
    );
  });

  it("400s month combined with from/to", async () => {
    const res = await request(app)
      .get("/v1/reports/journal?month=2026-07&from=2026-07-01")
      .set("Authorization", financeAuth);
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("month");
    expect(sequelize.query).not.toHaveBeenCalled();
  });
});

describe("GET /v1/reports/top-expenses (#55)", () => {
  it("returns transferred reimbursement details ordered by amount with a validated limit", async () => {
    sequelize.query.mockResolvedValueOnce([
      { detail_id: "detail-1", title: "Curtain", amount: "1200", purpose: "Stage", department: "Production", tag: "Venue" },
    ]);

    const res = await request(app)
      .get(`/v1/reports/top-expenses?project_id=${PROJECT_ID}&limit=3`)
      .set("Authorization", financeAuth);

    expect(res.status).toBe(200);
    expect(res.body.data[0].amount).toBe(1200);
    const [sql, options] = sequelize.query.mock.calls[0];
    expect(sql).toContain("r.latest_status = 'transfer'");
    expect(sql).toContain("ORDER BY rd.amount DESC");
    expect(options.replacements).toEqual(expect.objectContaining({ projectId: PROJECT_ID, limit: 3 }));
  });

  it("400s a limit over 100", async () => {
    const res = await request(app).get("/v1/reports/top-expenses?limit=101").set("Authorization", financeAuth);
    expect(res.status).toBe(400);
    expect(sequelize.query).not.toHaveBeenCalled();
  });
});

describe("GET /v1/reports/sponsors (#56)", () => {
  it("returns sponsor expected/actual amounts and tag context", async () => {
    sequelize.query.mockResolvedValueOnce([
      {
        source_id: "source-1",
        name: "ACME",
        expect_amount: "5000",
        actual_amount: "5000",
        amount: "5000",
        tag_id: TAG_ID,
        tag: "Sponsor",
        project_id: PROJECT_ID,
        project: "TCOS3",
      },
    ]);

    const res = await request(app)
      .get(`/v1/reports/sponsors?project_id=${PROJECT_ID}`)
      .set("Authorization", financeAuth);

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({ name: "ACME", expect_amount: 5000, actual_amount: 5000, amount: 5000, tag: "Sponsor" })
    );
    const [sql, options] = sequelize.query.mock.calls[0];
    expect(sql).toContain("s.type = 'spon'");
    expect(options.replacements.projectId).toBe(PROJECT_ID);
  });
});
