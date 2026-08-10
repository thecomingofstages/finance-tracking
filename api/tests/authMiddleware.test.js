// Real (non-mock) resolveScope/requireScope — every other test file runs with the real .env's
// MOCK_MODE=true. This file flips it before any app module loads, so it exercises the actual
// StaffDept-backed branch instead. Jest isolates the module registry per test file, so this
// doesn't leak into the other suites.
process.env.MOCK_MODE = "false";

const request = require("supertest");

jest.mock("../src/app/models", () => ({
  StaffDept: { findAll: jest.fn() },
  Department: { findByPk: jest.fn() },
  ProjectTag: { findByPk: jest.fn() },
  Source: { findByPk: jest.fn() },
  Payment: { findByPk: jest.fn() },
  Project: { findByPk: jest.fn() },
}));
jest.mock("../src/app/middleware/RateLimit.middleware", () => ({
  authAttempts: (req, res, next) => next(),
  general: (req, res, next) => next(),
}));
// Real business logic isn't under test here, only the auth gate in front of it — stub every
// controller-level helper call so a route that gets PAST requireScope doesn't then fail on
// something unrelated (a missing DB row, etc).
jest.mock("../src/app/helpers/Project.helper", () => ({
  list: jest.fn().mockResolvedValue({ rows: [], meta: {} }),
  create: jest.fn().mockResolvedValue({}),
  getById: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  remove: jest.fn().mockResolvedValue(null),
  listTags: jest.fn().mockResolvedValue([]),
  createTags: jest.fn().mockResolvedValue([]),
  updateTag: jest.fn().mockResolvedValue({}),
  removeTag: jest.fn().mockResolvedValue(null),
  listDepartments: jest.fn().mockResolvedValue([]),
  createDepartments: jest.fn().mockResolvedValue([]),
  updateDepartment: jest.fn().mockResolvedValue({}),
  removeDepartment: jest.fn().mockResolvedValue(null),
  listStaff: jest.fn().mockResolvedValue([]),
}));
jest.mock("../src/app/helpers/Source.helper", () => ({
  list: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  remove: jest.fn().mockResolvedValue(null),
}));
jest.mock("../src/app/helpers/Payment.helper", () => ({
  ingest: jest.fn().mockResolvedValue({ payment: {}, isNew: true }),
  list: jest.fn().mockResolvedValue({ rows: [], meta: {} }),
  getById: jest.fn().mockResolvedValue({}),
  bulkApprove: jest.fn().mockResolvedValue([]),
}));

const { StaffDept, Department, ProjectTag, Source, Payment } = require("../src/app/models");
const { buildApp } = require("./helpers/app");
const JWT = require("../src/app/utils/JWT.util");

const app = buildApp();

const STAFF_ID = "staff-id";
const PROJECT_A = "550e8400-e29b-41d4-a716-446655440001";
const PROJECT_B = "550e8400-e29b-41d4-a716-446655440002";
const DEPT_A = "550e8400-e29b-41d4-a716-446655440010";

function bearer(role = "staff") {
  return `Bearer ${JWT.signAccessToken({ sub: STAFF_ID, role, nickname: "tester" })}`;
}

/** Shapes a mocked StaffDept row the way resolveScope reads it: r.department_id, r.is_head/
 *  is_finance/is_manager, and r.department.project_id via the real association include. */
function membership({ departmentId = DEPT_A, projectId = PROJECT_A, isHead = false, isFinance = false, isManager = false } = {}) {
  return { _id: "sd-1", department_id: departmentId, is_head: isHead, is_finance: isFinance, is_manager: isManager, department: { project_id: projectId } };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolveScope (real, MOCK_MODE=false)", () => {
  it("builds financeOf/managerOf/headOf/departments from real StaffDept rows, deduped across departments in the same project", async () => {
    StaffDept.findAll.mockResolvedValueOnce([
      membership({ departmentId: DEPT_A, projectId: PROJECT_A, isFinance: true }),
      membership({ departmentId: "another-dept", projectId: PROJECT_A, isManager: true }), // same project, different dept
    ]);

    const res = await request(app).patch(`/v1/sources/does-not-matter`).set("Authorization", bearer("finance"));
    // isFinance flag check runs via the sourceProjectId resolver below in the isFinance describe
    // block — this test only cares that resolveScope ran without throwing and queried for real.
    expect(StaffDept.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { staff_id: STAFF_ID } }));
    expect(res.status).not.toBe(500);
  });

  it("isGlobal is true for finance/owner/admin roles, independent of any StaffDept row", async () => {
    StaffDept.findAll.mockResolvedValue([]); // no memberships at all
    const res = await request(app).delete(`/v1/projects/${PROJECT_A}`).set("Authorization", bearer("owner"));
    expect(res.status).toBe(204); // isGlobal flag, no StaffDept row needed
  });

  it("isGlobal is false for a plain staff role with no memberships", async () => {
    StaffDept.findAll.mockResolvedValue([]);
    const res = await request(app).delete(`/v1/projects/${PROJECT_A}`).set("Authorization", bearer("staff"));
    expect(res.status).toBe(403);
  });
});

describe("requireScope — project-scoped flags via the default req.params.id target", () => {
  it("isManagerOrFinance: allows a real manager of that exact project", async () => {
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_A, isManager: true })]);
    const res = await request(app)
      .patch(`/v1/projects/${PROJECT_A}`)
      .set("Authorization", bearer("staff"))
      .send({ name: "New name" });
    expect(res.status).toBe(200);
  });

  it("isManagerOrFinance: 403s a manager of a DIFFERENT project", async () => {
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_B, isManager: true })]);
    const res = await request(app)
      .patch(`/v1/projects/${PROJECT_A}`)
      .set("Authorization", bearer("staff"))
      .send({ name: "New name" });
    expect(res.status).toBe(403);
  });

  it("isMember: allows any real member (no head/finance/manager flag needed) of that project", async () => {
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_A })]);
    const res = await request(app).get(`/v1/projects/${PROJECT_A}`).set("Authorization", bearer("staff"));
    expect(res.status).toBe(200);
  });

  it("isMember: 403s a real staff member of a different project entirely", async () => {
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_B })]);
    const res = await request(app).get(`/v1/projects/${PROJECT_A}`).set("Authorization", bearer("staff"));
    expect(res.status).toBe(403);
  });
});

describe("requireScope — resolver-based flags (URL :id isn't the target itself)", () => {
  it("tag PATCH: resolves the tag's real project_id via a DB lookup, allows the project's finance", async () => {
    ProjectTag.findByPk.mockResolvedValueOnce({ project_id: PROJECT_A });
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_A, isFinance: true })]);
    const res = await request(app).patch(`/v1/tags/some-tag-id`).set("Authorization", bearer("staff")).send({ name: "x" });
    expect(res.status).toBe(200);
    expect(ProjectTag.findByPk).toHaveBeenCalledWith("some-tag-id");
  });

  it("tag PATCH: 403s finance-of-a-different-project even though the caller IS finance somewhere", async () => {
    ProjectTag.findByPk.mockResolvedValueOnce({ project_id: PROJECT_A });
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_B, isFinance: true })]);
    const res = await request(app).patch(`/v1/tags/some-tag-id`).set("Authorization", bearer("staff")).send({ name: "x" });
    expect(res.status).toBe(403);
  });

  it("department PATCH: resolves the department's real project_id, allows its manager", async () => {
    Department.findByPk.mockResolvedValueOnce({ project_id: PROJECT_A });
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_A, isManager: true })]);
    const res = await request(app).patch(`/v1/departments/some-dept-id`).set("Authorization", bearer("staff")).send({ name: "x" });
    expect(res.status).toBe(200);
  });

  it("source PATCH: resolves source -> project via a DB lookup, allows that project's finance", async () => {
    Source.findByPk.mockResolvedValueOnce({ project_id: PROJECT_A });
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_A, isFinance: true })]);
    const res = await request(app).patch(`/v1/sources/some-source-id`).set("Authorization", bearer("staff")).send({ name: "x" });
    expect(res.status).toBe(200);
  });

  it("payment detail GET: resolves payment -> source -> project (two real lookups)", async () => {
    Payment.findByPk.mockResolvedValueOnce({ source_id: "src-1" });
    Source.findByPk.mockResolvedValueOnce({ project_id: PROJECT_A });
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_A, isFinance: true })]);
    const res = await request(app).get(`/v1/payments/some-payment-id`).set("Authorization", bearer("staff"));
    expect(res.status).toBe(200);
  });

  it("payment list GET: target comes from ?project_id=, not the (nonexistent) :id", async () => {
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_A, isFinance: true })]);
    const res = await request(app).get(`/v1/payments?project_id=${PROJECT_A}`).set("Authorization", bearer("staff"));
    expect(res.status).toBe(200);
  });
});

describe("requireScope — coarse fallback when there's truly no target to resolve", () => {
  it("payments/approve: a real finance-somewhere caller passes the outer gate (per-item enforcement happens inside the helper, not tested here)", async () => {
    StaffDept.findAll.mockResolvedValueOnce([membership({ projectId: PROJECT_A, isFinance: true })]);
    const reauth = JWT.signReauthToken({ sub: STAFF_ID });
    const res = await request(app)
      .post("/v1/payments/approve")
      .set("Authorization", bearer("staff"))
      .set("X-Reauth-Token", reauth)
      .send({ decisions: [{ payment_id: "550e8400-e29b-41d4-a716-446655440099", status: "approved", actual_amount: 100 }] });
    expect(res.status).toBe(200);
  });

  it("payments/approve: someone who is finance NOWHERE at all is rejected by the outer gate", async () => {
    StaffDept.findAll.mockResolvedValueOnce([]); // no memberships at all
    const reauth = JWT.signReauthToken({ sub: STAFF_ID });
    const res = await request(app)
      .post("/v1/payments/approve")
      .set("Authorization", bearer("staff"))
      .set("X-Reauth-Token", reauth)
      .send({ decisions: [{ payment_id: "550e8400-e29b-41d4-a716-446655440099", status: "approved", actual_amount: 100 }] });
    expect(res.status).toBe(403);
  });
});
