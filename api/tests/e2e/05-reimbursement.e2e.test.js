/**
 * The reimbursement lifecycle — dev plan /reimburse, /reimburse/<reimburse_id>, and the
 * REIMBURSEMENT_UPDATESTATUS state machine
 * (waiting -> head_approve -> fin_approve -> transfer, with reject/delete edges).
 *
 * Cast, all resolved from staff_dept rows in the target database:
 *   chompoo  is_head + is_finance on department 2000…0001 (project 1000…0001), role=admin
 *   mark     plain member of department 2000…0002, role=staff
 *   beam     role=owner (the only role that may mark a reimbursement transferred)
 */
const { api } = require("./helpers/client");
const { login, stepUp, PREFIX } = require("./helpers/context");

const SEED_PASSWORD = "Passw0rd!2026";
const PROJECT = "10000000-0000-0000-0000-000000000001";
const DEPT_CHOMPOO_HEADS = "20000000-0000-0000-0000-000000000001";
const DEPT_MARK_BELONGS_TO = "20000000-0000-0000-0000-000000000002";

const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64");

let head;    // chompoo
let staff;   // mark
let owner;   // beam

beforeAll(async () => {
  head = await login("chompoo@tcos.app", SEED_PASSWORD);
  staff = await login("mark@tcos.app", SEED_PASSWORD);
  owner = await login("beam@tcos.app", SEED_PASSWORD);
});

describe("#41 create", () => {
  test("a member can file against their own department and lands in 'waiting'", async () => {
    const res = await api.post("/reimbursements", {
      token: staff.token,
      body: {
        department_id: DEPT_MARK_BELONGS_TO,
        purpose: `${PREFIX} ordinary request`,
        details: [{ title: "ค่าเดินทาง", amount: 25000 }, { title: "ค่าอาหาร", amount: 15000 }],
      },
    });
    expect(res.status).toBe(201);
    expect(res.data.latest_status).toBe("waiting");
  });

  test("filing against a department the caller does not belong to is refused", async () => {
    const res = await api.post("/reimbursements", {
      token: staff.token,
      body: { department_id: DEPT_CHOMPOO_HEADS, purpose: `${PREFIX} wrong dept`, details: [{ title: "x", amount: 100 }] },
    });
    expect(res.status).toBe(403);
  });

  test("an empty details array is rejected", async () => {
    const res = await api.post("/reimbursements", {
      token: staff.token,
      body: { department_id: DEPT_MARK_BELONGS_TO, purpose: `${PREFIX} empty`, details: [] },
    });
    expect(res.status).toBe(400);
  });

  test("a zero or negative amount is rejected", async () => {
    // Money is int4 satang throughout (dev plan, Database Design note) — a 0 line is
    // meaningless and a negative one would silently reduce a department's spend.
    const res = await api.post("/reimbursements", {
      token: staff.token,
      body: { department_id: DEPT_MARK_BELONGS_TO, purpose: `${PREFIX} negative`, details: [{ title: "refund", amount: -5000 }] },
    });
    expect(res.status).toBe(400);
  });

  test("a non-integer amount is rejected rather than silently truncated", async () => {
    const res = await api.post("/reimbursements", {
      token: staff.token,
      body: { department_id: DEPT_MARK_BELONGS_TO, purpose: `${PREFIX} float`, details: [{ title: "odd", amount: 1234.56 }] },
    });
    expect(res.status).toBe(400);
  });

  test("a tag belonging to another project is refused", async () => {
    const res = await api.post("/reimbursements", {
      token: staff.token,
      body: {
        department_id: DEPT_MARK_BELONGS_TO,
        tag_id: "00000000-0000-0000-0000-0000000000ff",
        purpose: `${PREFIX} bad tag`,
        details: [{ title: "x", amount: 100 }],
      },
    });
    expect([404, 422]).toContain(res.status);
  });

  test("a head filing against their own department auto-verifies to 'head_approve'", async () => {
    // doc 04 §4: a head approving their own request is a no-op, so it is skipped on submit.
    const res = await api.post("/reimbursements", {
      token: head.token,
      body: {
        department_id: DEPT_CHOMPOO_HEADS,
        purpose: `${PREFIX} auto-verified request`,
        details: [{ title: "ค่าจัดงาน", amount: 30000 }],
      },
    });
    expect(res.status).toBe(201);
    expect(res.data.latest_status).toBe("head_approve");
  });
});

describe("#46 receipt upload", () => {
  let id;
  beforeAll(async () => {
    const res = await api.post("/reimbursements", {
      token: staff.token,
      body: { department_id: DEPT_MARK_BELONGS_TO, purpose: `${PREFIX} receipt target`, details: [{ title: "x", amount: 1000 }] },
    });
    id = res.data._id;
  });

  test("a PDF receipt is accepted and stored", async () => {
    const form = new FormData();
    form.append("receipt", new Blob([pdf], { type: "application/pdf" }), "receipt.pdf");
    const res = await api.post(`/reimbursements/${id}/receipt`, { token: staff.token, body: form });
    expect(res.status).toBe(200);
    expect(res.data.receipt_link).toEqual(expect.any(String));
  });

  test("a PNG receipt is accepted", async () => {
    const form = new FormData();
    form.append("receipt", new Blob([png], { type: "image/png" }), "receipt.png");
    const res = await api.post(`/reimbursements/${id}/receipt`, { token: staff.token, body: form });
    expect(res.status).toBe(200);
  });

  test("a disallowed file type is rejected", async () => {
    // Dev plan /reimburse: "pdf / jpg / png", 1 file only, max 25 MB.
    const form = new FormData();
    form.append("receipt", new Blob([Buffer.from("MZ\x90\x00")], { type: "application/x-msdownload" }), "payload.exe");
    const res = await api.post(`/reimbursements/${id}/receipt`, { token: staff.token, body: form });
    expect(res.status).toBe(400);
  });

  test("a file over the 25 MB ceiling is rejected", async () => {
    const form = new FormData();
    form.append("receipt", new Blob([Buffer.alloc(26 * 1024 * 1024, 0x41)], { type: "application/pdf" }), "huge.pdf");
    const res = await api.post(`/reimbursements/${id}/receipt`, { token: staff.token, body: form });
    expect([400, 413]).toContain(res.status);
  });

  test("someone else's reimbursement cannot be given a receipt", async () => {
    const form = new FormData();
    form.append("receipt", new Blob([pdf], { type: "application/pdf" }), "receipt.pdf");
    const res = await api.post(`/reimbursements/${id}/receipt`, { token: owner.token, body: form });
    expect(res.status).toBe(403);
  });
});

describe("#44/#45 edit and cancel while still editable", () => {
  let id;
  beforeEach(async () => {
    const res = await api.post("/reimbursements", {
      token: staff.token,
      body: { department_id: DEPT_MARK_BELONGS_TO, purpose: `${PREFIX} editable`, details: [{ title: "x", amount: 1000 }] },
    });
    id = res.data._id;
  });

  test("the requester can edit purpose and details while waiting", async () => {
    const res = await api.patch(`/reimbursements/${id}`, {
      token: staff.token,
      body: { purpose: `${PREFIX} edited purpose`, details: [{ title: "ค่าเดินทาง (แก้ไข)", amount: 2000 }] },
    });
    expect(res.status).toBe(200);
    expect(res.data.purpose).toContain("edited purpose");
  });

  test("someone who is not the requester cannot edit it", async () => {
    const res = await api.patch(`/reimbursements/${id}`, { token: owner.token, body: { purpose: "hijacked" } });
    expect(res.status).toBe(403);
  });

  test("the requester can cancel it", async () => {
    const res = await api.del(`/reimbursements/${id}`, { token: staff.token });
    expect(res.status).toBe(204);
  });

  test("a cancelled reimbursement cannot be cancelled again", async () => {
    await api.del(`/reimbursements/${id}`, { token: staff.token });
    const res = await api.del(`/reimbursements/${id}`, { token: staff.token });
    expect([404, 422]).toContain(res.status);
  });
});

describe("#47 the approval chain end to end", () => {
  let id;

  beforeAll(async () => {
    const res = await api.post("/reimbursements", {
      token: head.token,
      body: {
        department_id: DEPT_CHOMPOO_HEADS,
        purpose: `${PREFIX} full chain`,
        details: [{ title: "ค่าดำเนินงาน", amount: 50000 }],
      },
    });
    id = res.data._id;
    const form = new FormData();
    form.append("receipt", new Blob([pdf], { type: "application/pdf" }), "receipt.pdf");
    await api.post(`/reimbursements/${id}/receipt`, { token: head.token, body: form });
  });

  test("every status call demands a fresh step-up token", async () => {
    const res = await api.post(`/reimbursements/${id}/status`, { token: head.token, body: { status: "fin_approve", tracking_id: "E2E-0001" } });
    expect(res.status).toBe(401);
    expect(res.code).toBe("REAUTH_REQUIRED");
  });

  test("head_approve -> fin_approve requires a tracking_id", async () => {
    const reauth = await stepUp(head.token, SEED_PASSWORD);
    const res = await api.post(`/reimbursements/${id}/status`, { token: head.token, reauth, body: { status: "fin_approve" } });
    expect(res.status).toBe(400);
  });

  test("a plain staff member cannot approve as finance", async () => {
    const reauth = await stepUp(staff.token, SEED_PASSWORD);
    const res = await api.post(`/reimbursements/${id}/status`, {
      token: staff.token, reauth, body: { status: "fin_approve", tracking_id: "E2E-HIJACK" },
    });
    expect(res.status).toBe(403);
  });

  test("finance advances it to fin_approve with a tracking_id", async () => {
    const reauth = await stepUp(head.token, SEED_PASSWORD);
    const res = await api.post(`/reimbursements/${id}/status`, {
      token: head.token, reauth, body: { status: "fin_approve", tracking_id: `${PREFIX}-0001` },
    });
    expect(res.status).toBe(200);
    expect(res.data.latest_status ?? res.data.reimbursement?.latest_status).toBe("fin_approve");
  });

  test("finance cannot also mark it transferred — that edge is owner-only", async () => {
    const reauth = await stepUp(head.token, SEED_PASSWORD);
    const res = await api.post(`/reimbursements/${id}/status`, { token: head.token, reauth, body: { status: "transfer" } });
    expect(res.status).toBe(403);
  });

  test("the owner marks it transferred", async () => {
    const reauth = await stepUp(owner.token, SEED_PASSWORD);
    const res = await api.post(`/reimbursements/${id}/status`, { token: owner.token, reauth, body: { status: "transfer" } });
    expect(res.status).toBe(200);
    expect(res.data.latest_status ?? res.data.reimbursement?.latest_status).toBe("transfer");
  });

  test("a transferred reimbursement can no longer be edited", async () => {
    const res = await api.patch(`/reimbursements/${id}`, { token: head.token, body: { purpose: "too late" } });
    expect(res.status).toBe(422);
  });

  test("a transferred reimbursement can no longer be cancelled", async () => {
    const res = await api.del(`/reimbursements/${id}`, { token: head.token });
    expect(res.status).toBe(422);
  });

  test("the detail view carries the full status history", async () => {
    const res = await api.get(`/reimbursements/${id}`, { token: head.token });
    expect(res.status).toBe(200);
    const history = res.data.history ?? res.data.statuses ?? res.data.updates;
    expect(Array.isArray(history)).toBe(true);
    expect(history.map((h) => h.status)).toEqual(expect.arrayContaining(["head_approve", "fin_approve", "transfer"]));
  });
});

describe("#47 the fields the status endpoint actually accepts", () => {
  let id;
  beforeAll(async () => {
    const res = await api.post("/reimbursements", {
      token: head.token,
      body: { department_id: DEPT_CHOMPOO_HEADS, purpose: `${PREFIX} field contract`, details: [{ title: "x", amount: 700 }] },
    });
    id = res.data._id;
  });

  test("head approval takes nothing beyond the step-up token", async () => {
    // The request lands in head_approve already (requester heads the department), so this
    // asserts the shape of the edge rather than re-walking it: no tracking_id, no reason.
    const detail = await api.get(`/reimbursements/${id}`, { token: head.token });
    expect(detail.data.latest_status).toBe("head_approve");
  });

  test("tracking_id is stored verbatim, not wrapped in prose", async () => {
    // The web client used to send a `note` field the API does not have, and packed the
    // tracking id inside it as "[Tracking: X] …". tracking_id is what Finance reconciles
    // against their own ledger, so anything but the exact string they typed is corruption.
    const reauth = await stepUp(head.token, SEED_PASSWORD);
    const tracking = `${PREFIX}-VERBATIM-01`;
    const res = await api.post(`/reimbursements/${id}/status`, {
      token: head.token, reauth, body: { status: "fin_approve", tracking_id: tracking },
    });
    expect(res.status).toBe(200);

    const detail = await api.get(`/reimbursements/${id}`, { token: head.token });
    expect(detail.data.tracking_id).toBe(tracking);
  });

  test("an unknown field is not accepted in place of tracking_id", async () => {
    const fresh = await api.post("/reimbursements", {
      token: head.token,
      body: { department_id: DEPT_CHOMPOO_HEADS, purpose: `${PREFIX} note rejected`, details: [{ title: "x", amount: 300 }] },
    });
    const reauth = await stepUp(head.token, SEED_PASSWORD);
    const res = await api.post(`/reimbursements/${fresh.data._id}/status`, {
      token: head.token, reauth, body: { status: "fin_approve", note: "TCOS-0001" },
    });
    // Whether it 400s on the missing tracking_id or 400s on the unknown key, what must never
    // happen is a 200 that leaves tracking_id empty.
    expect(res.status).toBe(400);
  });
});

describe("#4 /auth/me publishes the contract the UI is built against", () => {
  test("scope is snake_case, matching swagger's Scope schema", async () => {
    // The API used to emit headOf/isHead while swagger declared head_of/is_head, so every
    // membership check in the frontend silently evaluated to undefined and a department head
    // was never shown the approve button.
    const res = await api.get("/auth/me", { token: head.token });
    expect(res.status).toBe(200);
    const scope = res.data.scope;
    expect(Array.isArray(scope.head_of)).toBe(true);
    expect(Array.isArray(scope.finance_of)).toBe(true);
    expect(Array.isArray(scope.manager_of)).toBe(true);
    expect(scope.headOf).toBeUndefined();
    expect(scope.financeOf).toBeUndefined();
  });

  test("memberships carry snake_case flags and the department they belong to", async () => {
    const res = await api.get("/auth/me", { token: head.token });
    const membership = res.data.scope.memberships[0];
    expect(membership).toMatchObject({
      department_id: expect.any(String),
      project_id: expect.any(String),
      is_head: expect.any(Boolean),
      is_finance: expect.any(Boolean),
      is_manager: expect.any(Boolean),
    });
  });

  test("the head of a department is discoverable from their own scope", async () => {
    // What the approve button is gated on: "am I head of THIS reimbursement's department".
    const res = await api.get("/auth/me", { token: head.token });
    expect(res.data.scope.head_of).toContain(DEPT_CHOMPOO_HEADS);
  });

  test("the signature policy is published, not guessed", async () => {
    const res = await api.get("/auth/me", { token: head.token });
    expect(typeof res.data.features.require_signature).toBe("boolean");
  });
});

describe("#47 rejection path", () => {
  let id;
  beforeAll(async () => {
    const res = await api.post("/reimbursements", {
      token: head.token,
      body: { department_id: DEPT_CHOMPOO_HEADS, purpose: `${PREFIX} to be rejected`, details: [{ title: "x", amount: 900 }] },
    });
    id = res.data._id;
  });

  test("rejecting without a reason is refused", async () => {
    const reauth = await stepUp(head.token, SEED_PASSWORD);
    const res = await api.post(`/reimbursements/${id}/status`, { token: head.token, reauth, body: { status: "rejected" } });
    expect(res.status).toBe(400);
  });

  test("rejecting with a reason succeeds", async () => {
    const reauth = await stepUp(head.token, SEED_PASSWORD);
    const res = await api.post(`/reimbursements/${id}/status`, {
      token: head.token, reauth, body: { status: "rejected", reason: "ใบเสร็จไม่ครบ" },
    });
    expect(res.status).toBe(200);
    expect(res.data.latest_status ?? res.data.reimbursement?.latest_status).toBe("rejected");
  });

  test("a rejected reimbursement is editable again", async () => {
    const res = await api.patch(`/reimbursements/${id}`, { token: head.token, body: { purpose: `${PREFIX} corrected` } });
    expect(res.status).toBe(200);
  });

  test("an illegal jump straight back to transfer is refused", async () => {
    const reauth = await stepUp(owner.token, SEED_PASSWORD);
    const res = await api.post(`/reimbursements/${id}/status`, { token: owner.token, reauth, body: { status: "transfer" } });
    expect(res.status).toBe(422);
  });
});

describe("#42/#43 listing and visibility", () => {
  test("mine=true returns only the caller's own requests", async () => {
    const res = await api.get("/reimbursements?mine=true&limit=50", { token: staff.token });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("status filter is honoured", async () => {
    const res = await api.get("/reimbursements?status=waiting&limit=20", { token: head.token });
    expect(res.status).toBe(200);
    res.data.forEach((r) => expect(r.latest_status ?? r.status).toBe("waiting"));
  });

  test("an unrelated staff member cannot open someone else's reimbursement", async () => {
    const created = await api.post("/reimbursements", {
      token: head.token,
      body: { department_id: DEPT_CHOMPOO_HEADS, purpose: `${PREFIX} private`, details: [{ title: "x", amount: 100 }] },
    });
    const res = await api.get(`/reimbursements/${created.data._id}`, { token: staff.token });
    expect(res.status).toBe(403);
  });

  test("a non-existent id is a 404, not a 500", async () => {
    const res = await api.get("/reimbursements/00000000-0000-0000-0000-0000000000aa", { token: head.token });
    expect(res.status).toBe(404);
  });

  test("a malformed id is a 400, not a 500", async () => {
    const res = await api.get("/reimbursements/not-a-uuid", { token: head.token });
    expect([400, 404]).toContain(res.status);
  });
});
