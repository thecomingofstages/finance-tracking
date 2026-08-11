const request = require("supertest");

jest.mock("../src/app/models", () => ({
  Payment: { findByPk: jest.fn(), findOne: jest.fn(), findAndCountAll: jest.fn(), create: jest.fn() },
  PaymentStatus: { findOne: jest.fn(), create: jest.fn() },
  Source: { findByPk: jest.fn(), increment: jest.fn() },
  ProjectTag: { increment: jest.fn() },
  Project: { increment: jest.fn() },
  Staff: {},
  StaffDept: { findOne: jest.fn() },
  Department: {},
  sequelize: { transaction: jest.fn((cb) => cb({})) },
}));
jest.mock("../src/app/middleware/RateLimit.middleware", () => ({
  authAttempts: (req, res, next) => next(),
  general: (req, res, next) => next(),
}));

const { Payment, PaymentStatus, Source, ProjectTag, Project, StaffDept, sequelize } = require("../src/app/models");
const { buildApp } = require("./helpers/app");
const JWT = require("../src/app/utils/JWT.util");

const app = buildApp();
const SERVICE_TOKEN = process.env.SERVICE_TOKEN_ENROLL;
const financeBearer = `Bearer ${JWT.signAccessToken({ sub: "finance-staff-id", role: "finance", nickname: "golf" })}`;

// zod requires real UUID shape for _id/source_id/payment_id — plain strings like "pay-1" 400
// before ever reaching the helper.
const PAYMENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const SOURCE_ID = "550e8400-e29b-41d4-a716-446655440001";

function makePayment(overrides = {}) {
  const p = { _id: PAYMENT_ID, user_id: null, source_id: SOURCE_ID, expected_amount: 50000, promptpay_qr_data: null, ...overrides };
  p.toJSON = function toJSON() {
    const { toJSON: _drop, ...plain } = this;
    return plain;
  };
  return p;
}

beforeEach(() => {
  jest.resetAllMocks();
  sequelize.transaction.mockImplementation((cb) => cb({}));
});

describe("GET /v1/payments (#38, checkslip queue)", () => {
  it("returns the project's paginated payments with current status and source", async () => {
    Payment.findAndCountAll.mockResolvedValueOnce({
      rows: [
        makePayment({
          status: "waiting",
          source: {
            _id: SOURCE_ID,
            project_id: SOURCE_ID,
            type: "enroll",
            name: "Registration",
          },
        }),
      ],
      count: 3,
    });

    const res = await request(app)
      .get(`/v1/payments?project_id=${SOURCE_ID}&status=waiting&page=2&limit=1`)
      .set("Authorization", financeBearer);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        _id: PAYMENT_ID,
        status: "waiting",
        source: expect.objectContaining({ project_id: SOURCE_ID, name: "Registration" }),
      }),
    ]);
    expect(res.body.meta).toEqual({ page: 2, limit: 1, total: 3 });

    const options = Payment.findAndCountAll.mock.calls[0][0];
    expect(options.include[0]).toEqual(
      expect.objectContaining({ as: "source", required: true, where: { project_id: SOURCE_ID } })
    );
    expect(options.order).toEqual([["created_at", "ASC"], ["_id", "ASC"]]);
    expect(options).toEqual(expect.objectContaining({ limit: 1, offset: 1 }));
    expect(options.where).toBeDefined();
  });

  it("treats a payment with no status history as waiting", async () => {
    Payment.findAndCountAll.mockResolvedValueOnce({
      rows: [makePayment({ source: { _id: SOURCE_ID, project_id: SOURCE_ID, name: "Sponsor" } })],
      count: 1,
    });

    const res = await request(app)
      .get(`/v1/payments?project_id=${SOURCE_ID}`)
      .set("Authorization", financeBearer);

    expect(res.status).toBe(200);
    expect(res.body.data[0].status).toBe("waiting");
    expect(Payment.findAndCountAll.mock.calls[0][0].where).toBeUndefined();
  });

  it("400s when project_id is missing", async () => {
    const res = await request(app).get("/v1/payments").set("Authorization", financeBearer);
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("project_id");
    expect(Payment.findAndCountAll).not.toHaveBeenCalled();
  });

  it("400s invalid status or pagination", async () => {
    const res = await request(app)
      .get(`/v1/payments?project_id=${SOURCE_ID}&status=pending&page=0&limit=101`)
      .set("Authorization", financeBearer);
    expect(res.status).toBe(400);
    expect(Payment.findAndCountAll).not.toHaveBeenCalled();
  });

  it("401s without a bearer token", async () => {
    const res = await request(app).get(`/v1/payments?project_id=${SOURCE_ID}`);
    expect(res.status).toBe(401);
  });
});

describe("GET /v1/payments/:id (#39)", () => {
  it("returns payment details with the complete chronological status history", async () => {
    Payment.findByPk.mockResolvedValueOnce(
      makePayment({
        source: {
          _id: SOURCE_ID,
          project_id: SOURCE_ID,
          type: "enroll",
          name: "Registration",
        },
        history: [
          {
            _id: "status-1",
            status: "waiting",
            actual_amount: null,
            created_at: "2026-08-01T10:00:00.000Z",
            staff: { _id: "staff-1", nickname: "Golf" },
          },
          {
            _id: "status-2",
            status: "approved",
            actual_amount: 50000,
            created_at: "2026-08-01T11:00:00.000Z",
            staff: { _id: "staff-1", nickname: "Golf" },
          },
        ],
      })
    );

    const res = await request(app).get(`/v1/payments/${PAYMENT_ID}`).set("Authorization", financeBearer);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      _id: PAYMENT_ID,
      status: "approved",
      source: { project_id: SOURCE_ID, name: "Registration" },
    });
    expect(res.body.data.history.map(({ status }) => status)).toEqual(["waiting", "approved"]);

    const options = Payment.findByPk.mock.calls[0][1];
    const historyInclude = options.include.find(({ as }) => as === "history");
    expect(historyInclude).toEqual(
      expect.objectContaining({ separate: true, order: [["created_at", "ASC"]] })
    );
    expect(historyInclude.include[0]).toEqual(
      expect.objectContaining({ as: "staff", attributes: ["_id", "nickname"] })
    );
  });

  it("returns waiting with an empty history before the first decision", async () => {
    Payment.findByPk.mockResolvedValueOnce(
      makePayment({ source: { _id: SOURCE_ID, project_id: SOURCE_ID }, history: [] })
    );
    const res = await request(app).get(`/v1/payments/${PAYMENT_ID}`).set("Authorization", financeBearer);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "waiting", history: [] });
  });

  it("404s an unknown payment", async () => {
    Payment.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).get(`/v1/payments/${PAYMENT_ID}`).set("Authorization", financeBearer);
    expect(res.status).toBe(404);
  });
});

describe("POST /v1/payments (#37, service token)", () => {
  it("401s with no X-Service-Token", async () => {
    const res = await request(app).post("/v1/payments").send({ _id: PAYMENT_ID, source_id: SOURCE_ID });
    expect(res.status).toBe(401);
  });

  it("401s a wrong service token", async () => {
    const res = await request(app)
      .post("/v1/payments")
      .set("X-Service-Token", "not-the-real-token")
      .send({ _id: PAYMENT_ID, source_id: SOURCE_ID });
    expect(res.status).toBe(401);
  });

  it("ingests a new payment (201)", async () => {
    Payment.findByPk.mockResolvedValueOnce(null);
    Source.findByPk.mockResolvedValueOnce({ _id: SOURCE_ID });
    // no promptpay_qr_data sent below -> Payment.findOne's dupe check is never reached, so no
    // mock is queued for it here (an unconsumed queued value would leak into the next test).
    Payment.create.mockResolvedValueOnce(makePayment());

    const res = await request(app)
      .post("/v1/payments")
      .set("X-Service-Token", SERVICE_TOKEN)
      .send({ _id: PAYMENT_ID, source_id: SOURCE_ID, expected_amount: 50000 });

    expect(res.status).toBe(201);
    expect(res.body.data._id).toBe(PAYMENT_ID);
    expect(Payment.create).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — a retry with the same _id returns 200 with the existing row, no second insert", async () => {
    Payment.findByPk.mockResolvedValueOnce(makePayment());

    const res = await request(app)
      .post("/v1/payments")
      .set("X-Service-Token", SERVICE_TOKEN)
      .send({ _id: PAYMENT_ID, source_id: SOURCE_ID });

    expect(res.status).toBe(200);
    expect(Payment.create).not.toHaveBeenCalled();
  });

  it("404s SOURCE_NOT_FOUND when no source is configured", async () => {
    Payment.findByPk.mockResolvedValueOnce(null);
    Source.findByPk.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/v1/payments")
      .set("X-Service-Token", SERVICE_TOKEN)
      .send({ _id: PAYMENT_ID, source_id: SOURCE_ID });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SOURCE_NOT_FOUND");
  });

  it("409s a promptpay_qr_data already attached to a different payment", async () => {
    Payment.findByPk.mockResolvedValueOnce(null);
    Source.findByPk.mockResolvedValueOnce({ _id: SOURCE_ID });
    Payment.findOne.mockResolvedValueOnce(makePayment({ _id: "550e8400-e29b-41d4-a716-446655449999" }));

    const res = await request(app)
      .post("/v1/payments")
      .set("X-Service-Token", SERVICE_TOKEN)
      .send({ _id: PAYMENT_ID, source_id: SOURCE_ID, promptpay_qr_data: "00020101..." });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_QR_DATA");
  });
});

describe("POST /v1/payments/approve (#40, step-up + bulk)", () => {
  it("401s REAUTH_REQUIRED with no X-Reauth-Token", async () => {
    const res = await request(app)
      .post("/v1/payments/approve")
      .set("Authorization", financeBearer)
      .send({ decisions: [{ payment_id: PAYMENT_ID, status: "approved", actual_amount: 50000 }] });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REAUTH_REQUIRED");
  });

  function reauthHeader() {
    return JWT.signReauthToken({ sub: "finance-staff-id" });
  }

  it("approves a payment, rolls up source/project actual_amount in one transaction, reports amount_matches", async () => {
    Payment.findByPk.mockResolvedValueOnce(
      makePayment({ source: { _id: SOURCE_ID, project_id: "proj-1", tag_id: "tag-1" } })
    );
    StaffDept.findOne.mockResolvedValueOnce({ _id: "sd-1", is_finance: true });
    PaymentStatus.findOne.mockResolvedValueOnce(null); // no history yet -> implicit waiting

    const res = await request(app)
      .post("/v1/payments/approve")
      .set("Authorization", financeBearer)
      .set("X-Reauth-Token", reauthHeader())
      .send({ decisions: [{ payment_id: PAYMENT_ID, status: "approved", actual_amount: 50000 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.results[0]).toMatchObject({ payment_id: PAYMENT_ID, outcome: "approved", amount_matches: true });
    expect(PaymentStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_id: PAYMENT_ID, status: "approved", actual_amount: 50000, staff_id: "finance-staff-id" }),
      expect.anything()
    );
    expect(Source.increment).toHaveBeenCalledWith("actual_amount", expect.objectContaining({ by: 50000 }));
    expect(ProjectTag.increment).toHaveBeenCalledWith("total_income", expect.objectContaining({ by: 50000 }));
    expect(Project.increment).toHaveBeenCalledWith("total_income", expect.objectContaining({ by: 50000 }));
  });

  it("flags amount_matches: false on a mismatch, but still approves (accept-and-flag, not hard-reject)", async () => {
    Payment.findByPk.mockResolvedValueOnce(makePayment({ source: { _id: SOURCE_ID, project_id: "proj-1", tag_id: null } }));
    StaffDept.findOne.mockResolvedValueOnce({ is_finance: true });
    PaymentStatus.findOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/v1/payments/approve")
      .set("Authorization", financeBearer)
      .set("X-Reauth-Token", reauthHeader())
      .send({ decisions: [{ payment_id: PAYMENT_ID, status: "approved", actual_amount: 30000 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.results[0]).toMatchObject({ outcome: "approved", amount_matches: false });
  });

  it("skips (not errors) a payment someone else already decided", async () => {
    Payment.findByPk.mockResolvedValueOnce(makePayment({ source: { project_id: "proj-1" } }));
    StaffDept.findOne.mockResolvedValueOnce({ is_finance: true });
    PaymentStatus.findOne.mockResolvedValueOnce({ status: "approved" });

    const res = await request(app)
      .post("/v1/payments/approve")
      .set("Authorization", financeBearer)
      .set("X-Reauth-Token", reauthHeader())
      .send({ decisions: [{ payment_id: PAYMENT_ID, status: "rejected" }] });

    expect(res.status).toBe(200);
    expect(res.body.data.results[0].outcome).toBe("skipped");
    expect(PaymentStatus.create).not.toHaveBeenCalled();
  });

  it("skips a payment the caller isn't finance for, per-item (not a batch failure)", async () => {
    Payment.findByPk.mockResolvedValueOnce(makePayment({ source: { project_id: "proj-not-mine" } }));
    StaffDept.findOne.mockResolvedValueOnce(null); // not finance there

    const res = await request(app)
      .post("/v1/payments/approve")
      .set("Authorization", financeBearer)
      .set("X-Reauth-Token", reauthHeader())
      .send({ decisions: [{ payment_id: PAYMENT_ID, status: "approved", actual_amount: 1000 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.results[0].outcome).toBe("skipped");
    expect(res.body.data.results[0].reason).toMatch(/not finance/i);
  });

  it("skips when actual_amount is missing on an approval", async () => {
    const res = await request(app)
      .post("/v1/payments/approve")
      .set("Authorization", financeBearer)
      .set("X-Reauth-Token", reauthHeader())
      .send({ decisions: [{ payment_id: PAYMENT_ID, status: "approved" }] });

    expect(res.status).toBe(200);
    expect(res.body.data.results[0].outcome).toBe("skipped");
    expect(Payment.findByPk).not.toHaveBeenCalled();
  });

  it("400s an empty decisions array", async () => {
    const res = await request(app)
      .post("/v1/payments/approve")
      .set("Authorization", financeBearer)
      .set("X-Reauth-Token", reauthHeader())
      .send({ decisions: [] });
    expect(res.status).toBe(400);
  });
});
