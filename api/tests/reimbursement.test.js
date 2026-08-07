const request = require("supertest");

jest.mock("../src/app/models", () => ({
  Reimbursement: { findByPk: jest.fn(), create: jest.fn() },
  ReimbursementDetail: { bulkCreate: jest.fn(), create: jest.fn() },
  ReimbursementStatus: { create: jest.fn() },
  StaffDept: { findOne: jest.fn() },
  Department: { findByPk: jest.fn(), findOne: jest.fn(), increment: jest.fn() },
  ProjectTag: { findOne: jest.fn(), increment: jest.fn() },
  BankAccount: { findOne: jest.fn() },
  Project: { findByPk: jest.fn(), increment: jest.fn() },
  Staff: { findOne: jest.fn() },
  sequelize: { transaction: jest.fn((cb) => cb({})), query: jest.fn(), QueryTypes: { SELECT: "SELECT" } },
}));
jest.mock("../src/app/middleware/RateLimit.middleware", () => ({
  authAttempts: (req, res, next) => next(),
  general: (req, res, next) => next(),
}));
// Real rendering (real template, real Puppeteer) is verified manually, not in the fast unit
// suite — see PDF.util.js. Mocked here so these tests check what matters for Document.helper.js
// specifically: that it assembles the right real data (auth, masking, NOT_APPROVED) and hands
// it to the renderer, not the renderer's own output.
jest.mock("../src/app/utils/PDF.util", () => ({
  renderHtml: jest.fn().mockResolvedValue("<html>mock</html>"),
  renderPdf: jest.fn().mockResolvedValue(Buffer.from("mock-pdf-bytes")),
}));

const {
  Reimbursement,
  ReimbursementDetail,
  ReimbursementStatus,
  StaffDept,
  Department,
  ProjectTag,
  BankAccount,
  Project,
  Staff,
  sequelize,
} = require("../src/app/models");
const PDF = require("../src/app/utils/PDF.util");
const { buildApp } = require("./helpers/app");
const JWT = require("../src/app/utils/JWT.util");

const app = buildApp();
const STAFF_ID = "requester-id";
const DEPT_ID = "550e8400-e29b-41d4-a716-446655440010";
const TAG_ID = "550e8400-e29b-41d4-a716-446655440011";
const BANK_ID = "550e8400-e29b-41d4-a716-446655440012";
const REIMB_ID = "550e8400-e29b-41d4-a716-446655440020";

function bearer(sub, role) {
  return `Bearer ${JWT.signAccessToken({ sub, role, nickname: "tester" })}`;
}
function reauth(sub) {
  return JWT.signReauthToken({ sub });
}

beforeEach(() => {
  jest.clearAllMocks();
  sequelize.transaction.mockImplementation((cb) => cb({}));
  sequelize.query.mockResolvedValue([{ used: 0 }]);
});

describe("POST /v1/reimbursements (#41)", () => {
  const payload = { department_id: DEPT_ID, purpose: "ค่าอุปกรณ์", details: [{ title: "ผ้าม่าน", amount: 12000 }] };

  it("creates in 'waiting' for an ordinary member (no auto-verify)", async () => {
    Department.findByPk.mockResolvedValueOnce({ _id: DEPT_ID, project_id: "proj-1", allocated_budget: 100000 });
    StaffDept.findOne.mockResolvedValueOnce({ _id: "sd-1", is_head: false });
    Reimbursement.create.mockResolvedValueOnce({ _id: REIMB_ID });
    Reimbursement.findByPk.mockResolvedValueOnce({
      toJSON: () => ({ _id: REIMB_ID, latest_status: "waiting", details: payload.details }),
    });

    const res = await request(app).post("/v1/reimbursements").set("Authorization", bearer(STAFF_ID, "staff")).send(payload);

    expect(res.status).toBe(201);
    expect(ReimbursementStatus.create).toHaveBeenCalledTimes(1);
    expect(ReimbursementStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "waiting", staff_id: STAFF_ID }),
      expect.anything()
    );
  });

  it("auto-verifies to 'head_approve' when the requester heads the department — two status rows, same requester", async () => {
    Department.findByPk.mockResolvedValueOnce({ _id: DEPT_ID, project_id: "proj-1", allocated_budget: 100000 });
    StaffDept.findOne.mockResolvedValueOnce({ _id: "sd-1", is_head: true });
    Reimbursement.create.mockResolvedValueOnce({ _id: REIMB_ID });
    Reimbursement.findByPk.mockResolvedValueOnce({ toJSON: () => ({ _id: REIMB_ID, latest_status: "head_approve" }) });

    const res = await request(app).post("/v1/reimbursements").set("Authorization", bearer(STAFF_ID, "staff")).send(payload);

    expect(res.status).toBe(201);
    expect(ReimbursementStatus.create).toHaveBeenCalledTimes(2);
    expect(ReimbursementStatus.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: "waiting" }), expect.anything());
    expect(ReimbursementStatus.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: "head_approve" }), expect.anything());
  });

  it("computes a real budget projection from the actual query, not a hardcoded number", async () => {
    Department.findByPk.mockResolvedValueOnce({ _id: DEPT_ID, project_id: "proj-1", allocated_budget: 10000 });
    StaffDept.findOne.mockResolvedValueOnce({ _id: "sd-1", is_head: false });
    Reimbursement.create.mockResolvedValueOnce({ _id: REIMB_ID });
    Reimbursement.findByPk.mockResolvedValueOnce({ toJSON: () => ({ _id: REIMB_ID }) });
    sequelize.query.mockResolvedValueOnce([{ used: 15000 }]);

    const res = await request(app).post("/v1/reimbursements").set("Authorization", bearer(STAFF_ID, "staff")).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.meta.budget).toEqual({ department_allocated: 10000, department_used: 15000, would_exceed: true, over_by: 5000 });
  });

  it("404s an unknown department", async () => {
    Department.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).post("/v1/reimbursements").set("Authorization", bearer(STAFF_ID, "staff")).send(payload);
    expect(res.status).toBe(404);
  });

  it("403s a caller who isn't a member of the department", async () => {
    Department.findByPk.mockResolvedValueOnce({ _id: DEPT_ID, project_id: "proj-1", allocated_budget: 100000 });
    StaffDept.findOne.mockResolvedValueOnce(null);
    const res = await request(app).post("/v1/reimbursements").set("Authorization", bearer(STAFF_ID, "staff")).send(payload);
    expect(res.status).toBe(403);
  });

  it("422s TAG_PROJECT_MISMATCH when tag_id doesn't belong to the department's project", async () => {
    Department.findByPk.mockResolvedValueOnce({ _id: DEPT_ID, project_id: "proj-1", allocated_budget: 100000 });
    StaffDept.findOne.mockResolvedValueOnce({ _id: "sd-1", is_head: false });
    ProjectTag.findOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/v1/reimbursements")
      .set("Authorization", bearer(STAFF_ID, "staff"))
      .send({ ...payload, tag_id: TAG_ID });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("TAG_PROJECT_MISMATCH");
  });

  it("403s a banking_id the caller doesn't own", async () => {
    Department.findByPk.mockResolvedValueOnce({ _id: DEPT_ID, project_id: "proj-1", allocated_budget: 100000 });
    StaffDept.findOne.mockResolvedValueOnce({ _id: "sd-1", is_head: false });
    BankAccount.findOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/v1/reimbursements")
      .set("Authorization", bearer(STAFF_ID, "staff"))
      .send({ ...payload, banking_id: BANK_ID });

    expect(res.status).toBe(403);
  });

  it("400s an empty details array before ever touching the DB (zod)", async () => {
    const res = await request(app)
      .post("/v1/reimbursements")
      .set("Authorization", bearer(STAFF_ID, "staff"))
      .send({ department_id: DEPT_ID, purpose: "x", details: [] });
    expect(res.status).toBe(400);
    expect(Department.findByPk).not.toHaveBeenCalled();
  });
});

describe("POST /v1/reimbursements/:id/status (#47)", () => {
  function loadedReimbursement(overrides = {}) {
    return {
      _id: REIMB_ID,
      latest_status: "waiting",
      tag_id: null,
      tracking_id: null,
      staffDept: { _id: "sd-1", staff_id: STAFF_ID, department_id: DEPT_ID, department: { _id: DEPT_ID, project_id: "proj-1" } },
      details: [{ amount: 12000 }],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it("401s REAUTH_REQUIRED with no X-Reauth-Token", async () => {
    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer("head-id", "staff"))
      .send({ status: "head_approve" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REAUTH_REQUIRED");
  });

  it("head approves waiting->head_approve for real (isHead resolved via StaffDept)", async () => {
    Reimbursement.findByPk
      .mockResolvedValueOnce(loadedReimbursement())
      .mockResolvedValueOnce({ toJSON: () => ({ _id: REIMB_ID, latest_status: "head_approve" }) });
    StaffDept.findOne.mockResolvedValueOnce({ is_head: true }); // isHead check

    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer("head-id", "staff"))
      .set("X-Reauth-Token", reauth("head-id"))
      .send({ status: "head_approve" });

    expect(res.status).toBe(200);
    expect(ReimbursementStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({ reimbursement_id: REIMB_ID, status: "head_approve", staff_id: "head-id" }),
      expect.anything()
    );
  });

  it("403s someone with none of isHead/isFinance/isOwner/isRequester", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(loadedReimbursement());
    StaffDept.findOne.mockResolvedValue(null); // neither isHead nor isFinance

    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer("random-staff-id", "staff"))
      .set("X-Reauth-Token", reauth("random-staff-id"))
      .send({ status: "head_approve" });

    expect(res.status).toBe(403);
    expect(ReimbursementStatus.create).not.toHaveBeenCalled();
  });

  it("422s an invalid transition (waiting -> transfer)", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(loadedReimbursement());
    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer("owner-id", "owner"))
      .set("X-Reauth-Token", reauth("owner-id"))
      .send({ status: "transfer" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("400s head_approve->fin_approve without tracking_id", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(loadedReimbursement({ latest_status: "head_approve" }));
    StaffDept.findOne.mockResolvedValueOnce({ is_finance: true });

    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer("finance-id", "finance"))
      .set("X-Reauth-Token", reauth("finance-id"))
      .send({ status: "fin_approve" });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("tracking_id");
  });

  it("head_approve->fin_approve assigns tracking_id onto the reimbursement row for real", async () => {
    const record = loadedReimbursement({ latest_status: "head_approve" });
    Reimbursement.findByPk
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce({ toJSON: () => ({ _id: REIMB_ID, latest_status: "fin_approve", tracking_id: "TCOS3-0001" }) });
    StaffDept.findOne.mockResolvedValueOnce({ is_finance: true });

    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer("finance-id", "finance"))
      .set("X-Reauth-Token", reauth("finance-id"))
      .send({ status: "fin_approve", tracking_id: "TCOS3-0001" });

    expect(res.status).toBe(200);
    expect(record.tracking_id).toBe("TCOS3-0001");
    expect(record.save).toHaveBeenCalledTimes(1);
  });

  it("fin_approve->transfer requires the owner role and rolls up department/project/tag totals explicitly", async () => {
    const record = loadedReimbursement({ latest_status: "fin_approve", tag_id: TAG_ID, details: [{ amount: 5000 }, { amount: 2000 }] });
    Reimbursement.findByPk
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce({ toJSON: () => ({ _id: REIMB_ID, latest_status: "transfer" }) });

    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer("owner-id", "owner"))
      .set("X-Reauth-Token", reauth("owner-id"))
      .send({ status: "transfer" });

    expect(res.status).toBe(200);
    expect(Department.increment).toHaveBeenCalledWith("total_expense", expect.objectContaining({ by: 7000 }));
    expect(Project.increment).toHaveBeenCalledWith("total_expense", expect.objectContaining({ by: 7000 }));
    expect(ProjectTag.increment).toHaveBeenCalledWith("total_expense", expect.objectContaining({ by: 7000 }));
  });

  it("403s fin_approve->transfer attempted by a non-owner, even if authenticated", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(loadedReimbursement({ latest_status: "fin_approve" }));
    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer("finance-id", "finance"))
      .set("X-Reauth-Token", reauth("finance-id"))
      .send({ status: "transfer" });
    expect(res.status).toBe(403);
  });

  it("400s ->rejected without a reason", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(loadedReimbursement());
    StaffDept.findOne.mockResolvedValueOnce({ is_head: true });
    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer("head-id", "staff"))
      .set("X-Reauth-Token", reauth("head-id"))
      .send({ status: "rejected" });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("reason");
  });

  it("requester can withdraw (waiting -> delete)", async () => {
    Reimbursement.findByPk
      .mockResolvedValueOnce(loadedReimbursement())
      .mockResolvedValueOnce({ toJSON: () => ({ _id: REIMB_ID, latest_status: "delete" }) });

    const res = await request(app)
      .post(`/v1/reimbursements/${REIMB_ID}/status`)
      .set("Authorization", bearer(STAFF_ID, "staff")) // same staffId as the requester
      .set("X-Reauth-Token", reauth(STAFF_ID))
      .send({ status: "delete" });

    expect(res.status).toBe(200);
  });
});

describe("GET /v1/reimbursements/:id/document (#48)", () => {
  function fullRecord(overrides = {}) {
    return {
      _id: REIMB_ID,
      purpose: "ค่าอุปกรณ์",
      tracking_id: "TCOS3-0001",
      latest_status: "fin_approve",
      created_at: new Date().toISOString(),
      tag_id: null,
      details: [{ title: "ผ้าม่าน", amount: 12000 }],
      history: [{ status: "waiting", staff: { first_name: "A", last_name: "B", signature_image: null }, created_at: new Date().toISOString() }],
      staffDept: {
        _id: "sd-1",
        staff_id: STAFF_ID,
        department_id: DEPT_ID,
        department: { name: "ฝ่ายเวที", project_id: "proj-1", project: { name: "TCOS3" } },
        staff: { first_name: "Golf", last_name: "Finance", nickname: "golf" },
      },
      tag: null,
      bankAccount: { name: "Golf Finance", provider: "kbank", number: "1234567890", maskedNumber: "xxxxxx7890" },
      ...overrides,
    };
  }

  it("assembles real data for an authorized requester and hands it to the renderer (full account number)", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(fullRecord());

    const res = await request(app)
      .get(`/v1/reimbursements/${REIMB_ID}/document?type=request&format=html`)
      .set("Authorization", bearer(STAFF_ID, "staff"));

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toBe("<html>mock</html>"); // Document.helper.js just returns whatever PDF.util renders
    expect(PDF.renderHtml).toHaveBeenCalledWith(
      "reimbursement-request",
      expect.objectContaining({
        purpose: "ค่าอุปกรณ์",
        details: [{ title: "ผ้าม่าน", amount: 12000 }],
        bank_account: expect.objectContaining({ number: "1234567890" }), // requester sees the full number
      })
    );
  });

  it("masks the bank account for an authorized-but-not-privileged viewer (a head, not the requester/finance/owner)", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(fullRecord());
    // loadForDocument checks isFinanceOfProject (its own StaffDept.findOne) before isHead —
    // queue both in that order: not finance, then yes head.
    StaffDept.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ is_head: true });

    const res = await request(app)
      .get(`/v1/reimbursements/${REIMB_ID}/document?type=request&format=html`)
      .set("Authorization", bearer("some-other-head-id", "staff"));

    expect(res.status).toBe(200);
    expect(PDF.renderHtml).toHaveBeenCalledWith(
      "reimbursement-request",
      expect.objectContaining({ bank_account: expect.objectContaining({ number: "xxxxxx7890" }) })
    );
  });

  it("403s someone with no relationship to the reimbursement", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(fullRecord());
    StaffDept.findOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .get(`/v1/reimbursements/${REIMB_ID}/document?type=request&format=html`)
      .set("Authorization", bearer("stranger-id", "staff"));

    expect(res.status).toBe(403);
  });

  it("422s NOT_APPROVED requesting a voucher before fin_approve", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(fullRecord({ latest_status: "waiting" }));

    const res = await request(app)
      .get(`/v1/reimbursements/${REIMB_ID}/document?type=voucher&format=html`)
      .set("Authorization", bearer(STAFF_ID, "staff"));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("NOT_APPROVED");
  });

  it("400s an invalid type", async () => {
    const res = await request(app)
      .get(`/v1/reimbursements/${REIMB_ID}/document?type=bogus`)
      .set("Authorization", bearer(STAFF_ID, "staff"));
    expect(res.status).toBe(400);
    expect(Reimbursement.findByPk).not.toHaveBeenCalled();
  });

  it("format=pdf calls the real renderer (Puppeteer + the actual company template — verified manually, see PDF.util.js) with the same real data, gated by the same real auth", async () => {
    Reimbursement.findByPk.mockResolvedValueOnce(fullRecord());
    const res = await request(app)
      .get(`/v1/reimbursements/${REIMB_ID}/document?type=request&format=pdf`)
      .set("Authorization", bearer(STAFF_ID, "staff"));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    expect(PDF.renderPdf).toHaveBeenCalledWith("reimbursement-request", expect.objectContaining({ purpose: "ค่าอุปกรณ์" }));
  });
});

describe("POST /v1/reimbursements/import (#49)", () => {
  const csv =
    "requester_email,department,purpose,title,amount\n" +
    "requester@tcos.app,ฝ่ายเวที,ค่าอุปกรณ์,ผ้าม่าน,12000\n";

  it("403s a non-finance importer before ever parsing the file", async () => {
    Project.findByPk.mockResolvedValueOnce({ _id: "proj-1" });
    StaffDept.findOne.mockResolvedValueOnce(null); // not finance

    const res = await request(app)
      .post("/v1/reimbursements/import")
      .set("Authorization", bearer("not-finance-id", "staff"))
      .field("project_id", "proj-1")
      .attach("file", Buffer.from(csv), "import.csv");

    expect(res.status).toBe(403);
  });

  it("imports a clean CSV — resolves requester by email, department by name, creates real rows", async () => {
    Project.findByPk.mockResolvedValueOnce({ _id: "proj-1" });
    StaffDept.findOne
      .mockResolvedValueOnce({ is_finance: true }) // importer's own isFinanceOfProject check
      .mockResolvedValueOnce({ _id: "sd-req-1", is_head: false }); // requester's membership in the row
    Staff.findOne.mockResolvedValueOnce({ _id: "requester-real-id", email: "requester@tcos.app" });
    Department.findOne.mockResolvedValueOnce({ _id: DEPT_ID, name: "ฝ่ายเวที" });
    Reimbursement.create.mockResolvedValueOnce({ _id: REIMB_ID });

    const res = await request(app)
      .post("/v1/reimbursements/import")
      .set("Authorization", bearer("finance-importer-id", "finance"))
      .field("project_id", "proj-1")
      .attach("file", Buffer.from(csv), "import.csv");

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(1);
    expect(ReimbursementDetail.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "ผ้าม่าน", amount: 12000 }),
      expect.anything()
    );
    expect(ReimbursementStatus.create).toHaveBeenCalledTimes(1); // not head -> only 'waiting'
  });

  it("rejects the whole file and creates nothing when a row's requester email doesn't resolve", async () => {
    Project.findByPk.mockResolvedValueOnce({ _id: "proj-1" });
    StaffDept.findOne.mockResolvedValueOnce({ is_finance: true });
    Staff.findOne.mockResolvedValueOnce(null); // unknown email

    const res = await request(app)
      .post("/v1/reimbursements/import")
      .set("Authorization", bearer("finance-importer-id", "finance"))
      .field("project_id", "proj-1")
      .attach("file", Buffer.from(csv), "import.csv");

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toMatch(/No staff found/);
    expect(Reimbursement.create).not.toHaveBeenCalled();
  });

  it("400s with no project_id", async () => {
    const res = await request(app)
      .post("/v1/reimbursements/import")
      .set("Authorization", bearer("finance-importer-id", "finance"))
      .attach("file", Buffer.from(csv), "import.csv");
    expect(res.status).toBe(400);
  });
});
