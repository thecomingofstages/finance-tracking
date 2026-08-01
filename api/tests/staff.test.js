const request = require("supertest");

jest.mock("../src/app/models", () => ({
  Staff: { findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn(), bulkCreate: jest.fn() },
  Department: { findAll: jest.fn() },
  StaffDept: { bulkCreate: jest.fn() },
  sequelize: { transaction: jest.fn((cb) => cb({})) },
}));
jest.mock("../src/app/middleware/RateLimit.middleware", () => ({
  authAttempts: (req, res, next) => next(),
  general: (req, res, next) => next(),
}));

const { Staff, Department, StaffDept, sequelize } = require("../src/app/models");
const { buildApp } = require("./helpers/app");
const { makeStaff } = require("./helpers/factories");
const JWT = require("../src/app/utils/JWT.util");

const app = buildApp();

function bearer(role) {
  return `Bearer ${JWT.signAccessToken({ sub: "admin-id", role, nickname: "admin" })}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  sequelize.transaction.mockImplementation((cb) => cb({}));
});

describe("POST /v1/admin/staff (#10)", () => {
  const payload = { first_name: "May", last_name: "Sukjai", nickname: "May", email: "may@tcos.app" };

  it("creates a new staff row with no password_hash", async () => {
    Staff.findOne.mockResolvedValueOnce(null);
    Staff.create.mockResolvedValueOnce(makeStaff({ ...payload, password_hash: null }));

    const res = await request(app).post("/v1/admin/staff").set("Authorization", bearer("admin")).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("may@tcos.app");
    expect(res.body.data.password_hash).toBeUndefined();
    expect(Staff.create).toHaveBeenCalledWith(expect.objectContaining({ email: "may@tcos.app" }));
  });

  it("409s a duplicate email", async () => {
    Staff.findOne.mockResolvedValueOnce(makeStaff({ email: "may@tcos.app" }));

    const res = await request(app).post("/v1/admin/staff").set("Authorization", bearer("admin")).send(payload);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
    expect(Staff.create).not.toHaveBeenCalled();
  });

  it("403s a non-admin caller", async () => {
    const res = await request(app).post("/v1/admin/staff").set("Authorization", bearer("staff")).send(payload);
    expect(res.status).toBe(403);
    expect(Staff.findOne).not.toHaveBeenCalled();
  });

  it("401s with no token", async () => {
    const res = await request(app).post("/v1/admin/staff").send(payload);
    expect(res.status).toBe(401);
  });

  it("400s a missing required field before touching the DB (zod)", async () => {
    const res = await request(app).post("/v1/admin/staff").set("Authorization", bearer("admin")).send({ email: "may@tcos.app" });
    expect(res.status).toBe(400);
    expect(Staff.findOne).not.toHaveBeenCalled();
  });
});

describe("POST /v1/admin/staff/import (#11)", () => {
  const validCsv = "first_name,last_name,nickname,email\nMay,Sukjai,May,may@tcos.app\nNok,Rungrueang,Nok,nok@tcos.app\n";

  it("imports every row in one transaction when the whole file is clean", async () => {
    Staff.findAll.mockResolvedValueOnce([]);
    Staff.bulkCreate.mockResolvedValueOnce([
      makeStaff({ email: "may@tcos.app" }),
      makeStaff({ email: "nok@tcos.app" }),
    ]);

    const res = await request(app)
      .post("/v1/admin/staff/import")
      .set("Authorization", bearer("admin"))
      .attach("file", Buffer.from(validCsv), "staff.csv");

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.rows).toHaveLength(2);
    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(Staff.bulkCreate).toHaveBeenCalledTimes(1);
    // no department_id column at all in this CSV — must not touch Department/StaffDept.
    expect(Department.findAll).not.toHaveBeenCalled();
    expect(StaffDept.bulkCreate).not.toHaveBeenCalled();
  });

  it("assigns staff_dept for rows with a department_id, and skips it for rows that leave it blank", async () => {
    const deptId = "20000000-0000-0000-0000-000000000001";
    const csv =
      "first_name,last_name,nickname,email,department_id\n" +
      `May,Sukjai,May,may@tcos.app,${deptId}\n` +
      "Nok,Rungrueang,Nok,nok@tcos.app,\n"; // blank department_id — must still succeed

    Staff.findAll.mockResolvedValueOnce([]);
    Department.findAll.mockResolvedValueOnce([{ _id: deptId }]);
    const createdMay = makeStaff({ _id: "staff-may", email: "may@tcos.app" });
    const createdNok = makeStaff({ _id: "staff-nok", email: "nok@tcos.app" });
    Staff.bulkCreate.mockResolvedValueOnce([createdMay, createdNok]);

    const res = await request(app)
      .post("/v1/admin/staff/import")
      .set("Authorization", bearer("admin"))
      .attach("file", Buffer.from(csv), "staff.csv");

    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(2);
    expect(StaffDept.bulkCreate).toHaveBeenCalledTimes(1);
    expect(StaffDept.bulkCreate).toHaveBeenCalledWith(
      [{ department_id: deptId, staff_id: "staff-may" }],
      expect.anything()
    );
  });

  it("400s and inserts nothing when a row's department_id doesn't exist", async () => {
    const csv =
      "first_name,last_name,nickname,email,department_id\n" +
      "May,Sukjai,May,may@tcos.app,00000000-0000-0000-0000-000000000099\n";

    Staff.findAll.mockResolvedValueOnce([]);
    Department.findAll.mockResolvedValueOnce([]); // that id doesn't exist

    const res = await request(app)
      .post("/v1/admin/staff/import")
      .set("Authorization", bearer("admin"))
      .attach("file", Buffer.from(csv), "staff.csv");

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("department_id not found") })])
    );
    expect(Staff.bulkCreate).not.toHaveBeenCalled();
  });

  it("400s a malformed department_id (not a UUID) before ever querying the DB", async () => {
    const csv = "first_name,last_name,nickname,email,department_id\n" + "May,Sukjai,May,may@tcos.app,not-a-uuid\n";

    const res = await request(app)
      .post("/v1/admin/staff/import")
      .set("Authorization", bearer("admin"))
      .attach("file", Buffer.from(csv), "staff.csv");

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toMatch(/not a valid UUID/);
    expect(Department.findAll).not.toHaveBeenCalled();
  });

  it("403s a non-admin caller before ever touching the file", async () => {
    const res = await request(app)
      .post("/v1/admin/staff/import")
      .set("Authorization", bearer("staff"))
      .attach("file", Buffer.from(validCsv), "staff.csv");
    expect(res.status).toBe(403);
  });

  it("rejects the whole file with a per-row error list — missing field, bad email, in-file duplicate — and inserts nothing", async () => {
    const badCsv =
      "first_name,last_name,nickname,email\n" +
      ",Sukjai,May,may@tcos.app\n" + // missing first_name
      "Nok,Rungrueang,Nok,not-an-email\n" + // bad email
      "Golf,Finance,Golf,may@tcos.app\n"; // duplicate of row 1's email

    const res = await request(app)
      .post("/v1/admin/staff/import")
      .set("Authorization", bearer("admin"))
      .attach("file", Buffer.from(badCsv), "staff.csv");

    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
    expect(Staff.bulkCreate).not.toHaveBeenCalled();
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it("rejects rows whose email already exists in the live staff table, inserting nothing", async () => {
    Staff.findAll.mockResolvedValueOnce([makeStaff({ email: "may@tcos.app" })]);

    const res = await request(app)
      .post("/v1/admin/staff/import")
      .set("Authorization", bearer("admin"))
      .attach("file", Buffer.from(validCsv), "staff.csv");

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: expect.stringContaining("may@tcos.app") })])
    );
    expect(Staff.bulkCreate).not.toHaveBeenCalled();
  });

  it("400s with no file attached", async () => {
    const res = await request(app).post("/v1/admin/staff/import").set("Authorization", bearer("admin"));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /v1/admin/staff/:id (#12)", () => {
  it("updates whitelisted fields on the target staff", async () => {
    const staff = makeStaff({ _id: "target-id", nickname: "old" });
    Staff.findByPk.mockResolvedValueOnce(staff);

    const res = await request(app)
      .patch("/v1/admin/staff/target-id")
      .set("Authorization", bearer("admin"))
      .send({ nickname: "new", role: "finance" });

    expect(res.status).toBe(200);
    expect(res.body.data.nickname).toBe("new");
    expect(res.body.data.role).toBe("finance");
    expect(staff.save).toHaveBeenCalledTimes(1);
  });

  it("404s an unknown staff id", async () => {
    Staff.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).patch("/v1/admin/staff/ghost-id").set("Authorization", bearer("admin")).send({ nickname: "new" });
    expect(res.status).toBe(404);
  });

  it("409s changing email to one already used by someone else", async () => {
    const staff = makeStaff({ _id: "target-id", email: "old@tcos.app" });
    Staff.findByPk.mockResolvedValueOnce(staff);
    Staff.findOne.mockResolvedValueOnce(makeStaff({ _id: "someone-else-id", email: "taken@tcos.app" }));

    const res = await request(app)
      .patch("/v1/admin/staff/target-id")
      .set("Authorization", bearer("admin"))
      .send({ email: "taken@tcos.app" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
    expect(staff.save).not.toHaveBeenCalled();
  });

  it("allows keeping the same email unchanged (no false conflict against itself)", async () => {
    const staff = makeStaff({ _id: "target-id", email: "same@tcos.app" });
    Staff.findByPk.mockResolvedValueOnce(staff);
    Staff.findOne.mockResolvedValueOnce(staff);

    const res = await request(app)
      .patch("/v1/admin/staff/target-id")
      .set("Authorization", bearer("admin"))
      .send({ email: "same@tcos.app" });

    expect(res.status).toBe(200);
  });

  it("403s a non-admin caller", async () => {
    const res = await request(app).patch("/v1/admin/staff/target-id").set("Authorization", bearer("staff")).send({ nickname: "new" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /v1/admin/staff/:id (#13)", () => {
  it("soft-deletes the target staff", async () => {
    const staff = makeStaff({ _id: "target-id" });
    Staff.findByPk.mockResolvedValueOnce(staff);

    const res = await request(app).delete("/v1/admin/staff/target-id").set("Authorization", bearer("admin"));

    expect(res.status).toBe(204);
    expect(staff.destroy).toHaveBeenCalledTimes(1);
  });

  it("404s an unknown staff id", async () => {
    Staff.findByPk.mockResolvedValueOnce(null);
    const res = await request(app).delete("/v1/admin/staff/ghost-id").set("Authorization", bearer("admin"));
    expect(res.status).toBe(404);
  });

  it("403s a non-admin caller", async () => {
    const res = await request(app).delete("/v1/admin/staff/target-id").set("Authorization", bearer("staff"));
    expect(res.status).toBe(403);
  });
});
