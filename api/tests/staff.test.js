const request = require("supertest");

jest.mock("../src/app/models", () => ({
  Staff: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn(),
    bulkCreate: jest.fn(),
  },
  Department: { findAll: jest.fn() },
  StaffDept: { bulkCreate: jest.fn() },
  Project: {},
  BankAccount: { findAll: jest.fn(), findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  sequelize: { transaction: jest.fn((cb) => cb({})) },
}));
jest.mock("../src/app/middleware/RateLimit.middleware", () => ({
  authAttempts: (req, res, next) => next(),
  general: (req, res, next) => next(),
}));

const { Staff, Department, StaffDept, BankAccount, sequelize } = require("../src/app/models");
const { buildApp } = require("./helpers/app");
const { makeStaff } = require("./helpers/factories");
const JWT = require("../src/app/utils/JWT.util");

const app = buildApp();

function bearer(role, staffId = "admin-id") {
  return `Bearer ${JWT.signAccessToken({ sub: staffId, role, nickname: "admin" })}`;
}

function makeBankAccount(overrides = {}) {
  const account = {
    _id: "bank-account-id",
    staff_id: "staff-id",
    name: "Test Staff",
    number: "1234567890",
    provider: "KBank",
    created_at: "2026-08-10T00:00:00.000Z",
    ...overrides,
  };
  account.destroy = jest.fn().mockResolvedValue(account);
  account.toJSON = function toJSON() {
    const { destroy, toJSON: _drop, ...plain } = this;
    return plain;
  };
  return account;
}

function makeMembership(overrides = {}) {
  return {
    _id: "membership-id",
    department_id: "20000000-0000-0000-0000-000000000001",
    is_head: false,
    is_finance: false,
    is_manager: false,
    department: {
      _id: "20000000-0000-0000-0000-000000000001",
      project_id: "10000000-0000-0000-0000-000000000001",
      name: "Finance",
      project: { _id: "10000000-0000-0000-0000-000000000001", name: "TCOS 2026" },
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  sequelize.transaction.mockImplementation((cb) => cb({}));
});

describe("GET /v1/staff (#7)", () => {
  it("returns a paginated staff list with membership flags and no password hash", async () => {
    const staff = makeStaff({
      _id: "staff-target",
      password_hash: "must-never-leak",
      memberships: [makeMembership({ is_manager: true })],
    });
    Staff.findAndCountAll.mockResolvedValueOnce({ rows: [staff], count: 3 });

    const res = await request(app)
      .get("/v1/staff?page=2&limit=1&project_id=10000000-0000-0000-0000-000000000001")
      .set("Authorization", bearer("staff", "manager-id"));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].password_hash).toBeUndefined();
    expect(res.body.data[0].memberships[0]).toEqual(
      expect.objectContaining({
        project_id: "10000000-0000-0000-0000-000000000001",
        department_id: "20000000-0000-0000-0000-000000000001",
        is_manager: true,
      })
    );
    expect(res.body.meta).toEqual({ page: 2, limit: 1, total: 3 });

    const options = Staff.findAndCountAll.mock.calls[0][0];
    expect(options).toEqual(expect.objectContaining({ limit: 1, offset: 1, distinct: true }));
    expect(options.include[0].include[0].where).toEqual({
      project_id: "10000000-0000-0000-0000-000000000001",
    });
  });

  it("400s invalid filters before querying staff", async () => {
    const res = await request(app)
      .get("/v1/staff?project_id=not-a-uuid")
      .set("Authorization", bearer("staff", "manager-id"));

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("project_id");
    expect(Staff.findAndCountAll).not.toHaveBeenCalled();
  });

  it("401s with no bearer token", async () => {
    const res = await request(app).get("/v1/staff");
    expect(res.status).toBe(401);
  });
});

describe("GET /v1/staff/:id (#8)", () => {
  it("returns the full profile, memberships, and masked bank-account summaries", async () => {
    Staff.findByPk.mockResolvedValueOnce(
      makeStaff({
        _id: "staff-target",
        password_hash: "must-never-leak",
        memberships: [makeMembership({ is_head: true })],
        bankAccounts: [makeBankAccount({ number: "1234567890" })],
      })
    );

    const res = await request(app)
      .get("/v1/staff/staff-target")
      .set("Authorization", bearer("staff", "manager-id"));

    expect(res.status).toBe(200);
    expect(res.body.data.password_hash).toBeUndefined();
    expect(res.body.data.memberships[0].is_head).toBe(true);
    expect(res.body.data.bank_accounts[0].number).toBe("xxxxxx7890");
    expect(res.body.data.bank_accounts[0].staff_id).toBeUndefined();
  });

  it("404s an unknown staff id", async () => {
    Staff.findByPk.mockResolvedValueOnce(null);
    const res = await request(app)
      .get("/v1/staff/missing-id")
      .set("Authorization", bearer("staff", "manager-id"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /v1/staff/me (#9)", () => {
  it("updates only self-editable fields and returns the current scope", async () => {
    const staff = makeStaff({ _id: "self-id", nickname: "old", password_hash: "secret" });
    Staff.findByPk.mockResolvedValueOnce(staff);

    const res = await request(app)
      .patch("/v1/staff/me")
      .set("Authorization", bearer("staff", "self-id"))
      .send({ nickname: "new", phone: "0812345678" });

    expect(res.status).toBe(200);
    expect(staff.set).toHaveBeenCalledWith({ nickname: "new", phone: "0812345678" });
    expect(staff.save).toHaveBeenCalledTimes(1);
    expect(res.body.data.nickname).toBe("new");
    expect(res.body.data.password_hash).toBeUndefined();
    expect(res.body.data.scope.staffId).toBe("self-id");
  });

  it("400s email instead of silently stripping the forbidden field", async () => {
    const res = await request(app)
      .patch("/v1/staff/me")
      .set("Authorization", bearer("staff", "self-id"))
      .send({ email: "changed@tcos.app" });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("email");
    expect(Staff.findByPk).not.toHaveBeenCalled();
  });

  it("400s an invalid phone number before querying staff", async () => {
    const res = await request(app)
      .patch("/v1/staff/me")
      .set("Authorization", bearer("staff", "self-id"))
      .send({ phone: "123" });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("phone");
    expect(Staff.findByPk).not.toHaveBeenCalled();
  });

  it("404s if the staff row behind the token no longer exists", async () => {
    Staff.findByPk.mockResolvedValueOnce(null);
    const res = await request(app)
      .patch("/v1/staff/me")
      .set("Authorization", bearer("staff", "self-id"))
      .send({ nickname: "new" });
    expect(res.status).toBe(404);
  });
});

describe("GET /v1/staff/me/bank-accounts (#14)", () => {
  it("returns only the caller's live accounts with full account numbers", async () => {
    BankAccount.findAll.mockResolvedValueOnce([
      makeBankAccount({ staff_id: "self-id", number: "1234567890" }),
      makeBankAccount({ _id: "bank-2", staff_id: "self-id", number: "9876543210" }),
    ]);

    const res = await request(app)
      .get("/v1/staff/me/bank-accounts")
      .set("Authorization", bearer("staff", "self-id"));

    expect(res.status).toBe(200);
    expect(res.body.data.map((account) => account.number)).toEqual(["1234567890", "9876543210"]);
    expect(res.body.data[0].staff_id).toBeUndefined();
    expect(BankAccount.findAll).toHaveBeenCalledWith({
      where: { staff_id: "self-id" },
      order: [["created_at", "ASC"]],
    });
  });

  it("returns an empty array when the caller has no account", async () => {
    BankAccount.findAll.mockResolvedValueOnce([]);
    const res = await request(app)
      .get("/v1/staff/me/bank-accounts")
      .set("Authorization", bearer("staff", "self-id"));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("POST /v1/staff/me/bank-accounts (#15)", () => {
  const payload = { name: "Test Staff", number: "1234567890", provider: "KBank" };

  it("creates an immutable bank account owned by the caller", async () => {
    BankAccount.findOne.mockResolvedValueOnce(null);
    BankAccount.create.mockResolvedValueOnce(makeBankAccount({ staff_id: "self-id", ...payload }));

    const res = await request(app)
      .post("/v1/staff/me/bank-accounts")
      .set("Authorization", bearer("staff", "self-id"))
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.number).toBe("1234567890");
    expect(BankAccount.create).toHaveBeenCalledWith({ staff_id: "self-id", ...payload });
  });

  it("409s a duplicate live account number owned by the caller", async () => {
    BankAccount.findOne.mockResolvedValueOnce(makeBankAccount({ staff_id: "self-id" }));

    const res = await request(app)
      .post("/v1/staff/me/bank-accounts")
      .set("Authorization", bearer("staff", "self-id"))
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_BANK_ACCOUNT");
    expect(BankAccount.create).not.toHaveBeenCalled();
  });

  it("400s a non-numeric or short account number before querying the DB", async () => {
    const res = await request(app)
      .post("/v1/staff/me/bank-accounts")
      .set("Authorization", bearer("staff", "self-id"))
      .send({ ...payload, number: "ABC123" });

    expect(res.status).toBe(400);
    expect(res.body.error.field).toBe("number");
    expect(BankAccount.findOne).not.toHaveBeenCalled();
  });
});

describe("DELETE /v1/staff/me/bank-accounts/:id (#16)", () => {
  it("soft-deletes an account owned by the caller", async () => {
    const account = makeBankAccount({ _id: "bank-1", staff_id: "self-id" });
    BankAccount.findByPk.mockResolvedValueOnce(account);

    const res = await request(app)
      .delete("/v1/staff/me/bank-accounts/bank-1")
      .set("Authorization", bearer("staff", "self-id"));

    expect(res.status).toBe(204);
    expect(account.destroy).toHaveBeenCalledTimes(1);
  });

  it("404s an unknown bank account", async () => {
    BankAccount.findByPk.mockResolvedValueOnce(null);
    const res = await request(app)
      .delete("/v1/staff/me/bank-accounts/missing-id")
      .set("Authorization", bearer("staff", "self-id"));
    expect(res.status).toBe(404);
  });

  it("403s an account owned by another staff member", async () => {
    const account = makeBankAccount({ _id: "bank-1", staff_id: "someone-else" });
    BankAccount.findByPk.mockResolvedValueOnce(account);

    const res = await request(app)
      .delete("/v1/staff/me/bank-accounts/bank-1")
      .set("Authorization", bearer("staff", "self-id"));

    expect(res.status).toBe(403);
    expect(account.destroy).not.toHaveBeenCalled();
  });
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
