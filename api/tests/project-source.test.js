const request = require("supertest");

jest.mock("../src/app/models", () => ({
  Project: { findByPk: jest.fn(), create: jest.fn() },
  ProjectTag: { findByPk: jest.fn(), findOne: jest.fn(), count: jest.fn() },
  Department: { findByPk: jest.fn(), findOne: jest.fn(), count: jest.fn() },
  Source: { findByPk: jest.fn(), findOne: jest.fn(), count: jest.fn(), create: jest.fn() },
  Reimbursement: { count: jest.fn() },
  StaffDept: { count: jest.fn() },
  Payment: { count: jest.fn() },
  sequelize: { query: jest.fn(), QueryTypes: { SELECT: "SELECT" } },
}));
jest.mock("../src/app/middleware/RateLimit.middleware", () => ({
  authAttempts: (req, res, next) => next(),
  general: (req, res, next) => next(),
}));

const { Project, ProjectTag, Department, Source, Reimbursement, StaffDept, Payment, sequelize } = require("../src/app/models");
const { buildApp } = require("./helpers/app");
const JWT = require("../src/app/utils/JWT.util");

const app = buildApp();
const auth = `Bearer ${JWT.signAccessToken({ sub: "staff-id", role: "finance", nickname: "golf" })}`;

/** Generic Sequelize-instance-shaped mock — same idea as factories.js's makeStaff, but for
 *  records with no sensitive fields to strip. */
function makeRecord(overrides = {}) {
  const rec = { _id: "record-id", ...overrides };
  rec.save = jest.fn().mockResolvedValue(rec);
  rec.destroy = jest.fn().mockResolvedValue(rec);
  rec.set = jest.fn(function set(patch) {
    Object.assign(this, patch);
    return this;
  });
  rec.toJSON = function toJSON() {
    const { save, destroy, set, toJSON: _drop, ...plain } = this;
    return plain;
  };
  return rec;
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) — several tests here throw before reaching a
  // mockResolvedValueOnce'd call (e.g. validation failing first), which would otherwise leave
  // it queued and leak into the next test. resetAllMocks clears queued implementations too.
  jest.resetAllMocks();
  sequelize.query.mockResolvedValue([]);
});

describe("POST /v1/projects (#18)", () => {
  it("creates a project", async () => {
    Project.create.mockResolvedValueOnce(makeRecord({ name: "TCOS 2026" }));
    const res = await request(app).post("/v1/projects").set("Authorization", auth).send({ name: "TCOS 2026" });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("TCOS 2026");
  });

  it("400s a missing name (zod)", async () => {
    const res = await request(app).post("/v1/projects").set("Authorization", auth).send({});
    expect(res.status).toBe(400);
    expect(Project.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /v1/projects/:id (#20)", () => {
  it("updates a project", async () => {
    const project = makeRecord({ _id: "p1", name: "old" });
    Project.findByPk.mockResolvedValueOnce(project);
    const res = await request(app).patch("/v1/projects/p1").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("new");
    expect(project.save).toHaveBeenCalledTimes(1);
  });

  it("404s an unknown project", async () => {
    Project.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).patch("/v1/projects/ghost").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(404);
  });

  it("400s an attempt to write total_income/total_expense", async () => {
    const res = await request(app).patch("/v1/projects/p1").set("Authorization", auth).send({ total_income: 100 });
    expect(res.status).toBe(400);
    expect(Project.findByPk).not.toHaveBeenCalled();
  });
});

describe("DELETE /v1/projects/:id (#21)", () => {
  it("soft-deletes a project with no dependents", async () => {
    const project = makeRecord({ _id: "p1" });
    Project.findByPk.mockResolvedValueOnce(project);
    ProjectTag.count.mockResolvedValueOnce(0);
    Department.count.mockResolvedValueOnce(0);
    Source.count.mockResolvedValueOnce(0);
    sequelize.query.mockResolvedValueOnce([]);

    const res = await request(app).delete("/v1/projects/p1").set("Authorization", auth);
    expect(res.status).toBe(204);
    expect(project.destroy).toHaveBeenCalledTimes(1);
  });

  it("404s an unknown project", async () => {
    Project.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).delete("/v1/projects/ghost").set("Authorization", auth);
    expect(res.status).toBe(404);
  });

  it("409s when a live tag/department/source still references it", async () => {
    const project = makeRecord({ _id: "p1" });
    Project.findByPk.mockResolvedValueOnce(project);
    ProjectTag.count.mockResolvedValueOnce(1);
    Department.count.mockResolvedValueOnce(0);
    Source.count.mockResolvedValueOnce(0);
    sequelize.query.mockResolvedValueOnce([]);

    const res = await request(app).delete("/v1/projects/p1").set("Authorization", auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PROJECT_HAS_DEPENDENTS");
    expect(project.destroy).not.toHaveBeenCalled();
  });

  it("409s when a live reimbursement is transitively attached via a department", async () => {
    const project = makeRecord({ _id: "p1" });
    Project.findByPk.mockResolvedValueOnce(project);
    ProjectTag.count.mockResolvedValueOnce(0);
    Department.count.mockResolvedValueOnce(0);
    Source.count.mockResolvedValueOnce(0);
    sequelize.query.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await request(app).delete("/v1/projects/p1").set("Authorization", auth);
    expect(res.status).toBe(409);
    expect(project.destroy).not.toHaveBeenCalled();
  });
});

describe("PATCH /v1/tags/:id (#24)", () => {
  it("renames a tag", async () => {
    const tag = makeRecord({ _id: "t1", project_id: "p1", name: "old" });
    ProjectTag.findByPk.mockResolvedValueOnce(tag);
    ProjectTag.findOne.mockResolvedValueOnce(null);
    const res = await request(app).patch("/v1/tags/t1").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("new");
  });

  it("404s an unknown tag", async () => {
    ProjectTag.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).patch("/v1/tags/ghost").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(404);
  });

  it("409s a rename colliding with another tag in the same project", async () => {
    const tag = makeRecord({ _id: "t1", project_id: "p1", name: "old" });
    ProjectTag.findByPk.mockResolvedValueOnce(tag);
    ProjectTag.findOne.mockResolvedValueOnce(makeRecord({ _id: "t2", name: "new" }));
    const res = await request(app).patch("/v1/tags/t1").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_TAG");
    expect(tag.save).not.toHaveBeenCalled();
  });
});

describe("DELETE /v1/tags/:id (#25)", () => {
  it("soft-deletes an unused tag", async () => {
    const tag = makeRecord({ _id: "t1" });
    ProjectTag.findByPk.mockResolvedValueOnce(tag);
    Source.count.mockResolvedValueOnce(0);
    Reimbursement.count.mockResolvedValueOnce(0);
    const res = await request(app).delete("/v1/tags/t1").set("Authorization", auth);
    expect(res.status).toBe(204);
    expect(tag.destroy).toHaveBeenCalledTimes(1);
  });

  it("404s an unknown tag", async () => {
    ProjectTag.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).delete("/v1/tags/ghost").set("Authorization", auth);
    expect(res.status).toBe(404);
  });

  it("409s a tag still used by a source or reimbursement", async () => {
    const tag = makeRecord({ _id: "t1" });
    ProjectTag.findByPk.mockResolvedValueOnce(tag);
    Source.count.mockResolvedValueOnce(1);
    Reimbursement.count.mockResolvedValueOnce(0);
    const res = await request(app).delete("/v1/tags/t1").set("Authorization", auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TAG_HAS_DEPENDENTS");
  });
});

describe("PATCH /v1/departments/:id (#28)", () => {
  it("renames a department", async () => {
    const dept = makeRecord({ _id: "d1", project_id: "p1", name: "old" });
    Department.findByPk.mockResolvedValueOnce(dept);
    Department.findOne.mockResolvedValueOnce(null);
    const res = await request(app).patch("/v1/departments/d1").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("new");
  });

  it("404s an unknown department", async () => {
    Department.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).patch("/v1/departments/ghost").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(404);
  });

  it("409s a rename colliding with another department in the same project", async () => {
    const dept = makeRecord({ _id: "d1", project_id: "p1", name: "old" });
    Department.findByPk.mockResolvedValueOnce(dept);
    Department.findOne.mockResolvedValueOnce(makeRecord({ _id: "d2", name: "new" }));
    const res = await request(app).patch("/v1/departments/d1").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_DEPARTMENT");
  });
});

describe("DELETE /v1/departments/:id (#29)", () => {
  it("soft-deletes an empty department", async () => {
    const dept = makeRecord({ _id: "d1" });
    Department.findByPk.mockResolvedValueOnce(dept);
    StaffDept.count.mockResolvedValueOnce(0);
    sequelize.query.mockResolvedValueOnce([]);
    const res = await request(app).delete("/v1/departments/d1").set("Authorization", auth);
    expect(res.status).toBe(204);
    expect(dept.destroy).toHaveBeenCalledTimes(1);
  });

  it("404s an unknown department", async () => {
    Department.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).delete("/v1/departments/ghost").set("Authorization", auth);
    expect(res.status).toBe(404);
  });

  it("409s a department that still has members", async () => {
    const dept = makeRecord({ _id: "d1" });
    Department.findByPk.mockResolvedValueOnce(dept);
    StaffDept.count.mockResolvedValueOnce(2);
    sequelize.query.mockResolvedValueOnce([]);
    const res = await request(app).delete("/v1/departments/d1").set("Authorization", auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEPARTMENT_HAS_DEPENDENTS");
  });

  it("409s a department with a live reimbursement even with zero current members", async () => {
    const dept = makeRecord({ _id: "d1" });
    Department.findByPk.mockResolvedValueOnce(dept);
    StaffDept.count.mockResolvedValueOnce(0);
    sequelize.query.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await request(app).delete("/v1/departments/d1").set("Authorization", auth);
    expect(res.status).toBe(409);
    expect(dept.destroy).not.toHaveBeenCalled();
  });
});

describe("POST /v1/projects/:id/sources (#34)", () => {
  it("creates a spon source (no reference_id needed)", async () => {
    Project.findByPk.mockResolvedValueOnce(makeRecord({ _id: "p1" }));
    Source.create.mockResolvedValueOnce(makeRecord({ type: "spon", name: "Sponsor A", expect_amount: 5000, actual_amount: 5000 }));

    const res = await request(app)
      .post("/v1/projects/p1/sources")
      .set("Authorization", auth)
      .send({ type: "spon", name: "Sponsor A", expect_amount: 5000 });

    expect(res.status).toBe(201);
    expect(res.body.data.actual_amount).toBe(5000);
    expect(Source.create).toHaveBeenCalledWith(expect.objectContaining({ project_id: "p1", actual_amount: 5000 }));
  });

  it("400s an enroll source missing reference_id", async () => {
    Project.findByPk.mockResolvedValueOnce(makeRecord({ _id: "p1" }));
    const res = await request(app)
      .post("/v1/projects/p1/sources")
      .set("Authorization", auth)
      .send({ type: "enroll", name: "Registration" });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("reference_id");
    expect(Source.create).not.toHaveBeenCalled();
  });

  it("404s an unknown project", async () => {
    Project.findByPk.mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/v1/projects/ghost/sources")
      .set("Authorization", auth)
      .send({ type: "spon", name: "Sponsor A" });
    expect(res.status).toBe(404);
  });

  it("400s a tag_id that doesn't belong to this project", async () => {
    Project.findByPk.mockResolvedValueOnce(makeRecord({ _id: "p1" }));
    ProjectTag.findOne.mockResolvedValueOnce(null);
    const res = await request(app)
      .post("/v1/projects/p1/sources")
      .set("Authorization", auth)
      .send({ type: "spon", name: "Sponsor A", tag_id: "11111111-1111-1111-1111-111111111111" });
    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("tag_id");
    expect(Source.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /v1/sources/:id (#35)", () => {
  it("updates a source", async () => {
    const source = makeRecord({ _id: "s1", name: "old" });
    Source.findByPk.mockResolvedValueOnce(source);
    const res = await request(app).patch("/v1/sources/s1").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("new");
  });

  it("404s an unknown source", async () => {
    Source.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).patch("/v1/sources/ghost").set("Authorization", auth).send({ name: "new" });
    expect(res.status).toBe(404);
  });

  it("400s an attempt to write actual_amount directly", async () => {
    const res = await request(app).patch("/v1/sources/s1").set("Authorization", auth).send({ actual_amount: 999 });
    expect(res.status).toBe(400);
    expect(Source.findByPk).not.toHaveBeenCalled();
  });
});

describe("DELETE /v1/sources/:id (#36)", () => {
  it("soft-deletes a source with no payments", async () => {
    const source = makeRecord({ _id: "s1" });
    Source.findByPk.mockResolvedValueOnce(source);
    Payment.count.mockResolvedValueOnce(0);
    const res = await request(app).delete("/v1/sources/s1").set("Authorization", auth);
    expect(res.status).toBe(204);
    expect(source.destroy).toHaveBeenCalledTimes(1);
  });

  it("404s an unknown source", async () => {
    Source.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).delete("/v1/sources/ghost").set("Authorization", auth);
    expect(res.status).toBe(404);
  });

  it("409s a source that still has payments attached", async () => {
    const source = makeRecord({ _id: "s1" });
    Source.findByPk.mockResolvedValueOnce(source);
    Payment.count.mockResolvedValueOnce(3);
    const res = await request(app).delete("/v1/sources/s1").set("Authorization", auth);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SOURCE_HAS_DEPENDENTS");
  });
});
