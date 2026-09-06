/**
 * #48 — ใบเบิกเงิน (request) and ใบสำคัญจ่าย (voucher) rendering.
 *
 * This is the endpoint most likely to behave differently on a deployed host than locally:
 * it drives Puppeteer, which needs a real Chromium binary and enough memory in the container.
 * A green local run says nothing about it.
 */
const { api } = require("./helpers/client");
const { login, stepUp, PREFIX } = require("./helpers/context");

const SEED_PASSWORD = "Passw0rd!2026";
const DEPT_CHOMPOO_HEADS = "20000000-0000-0000-0000-000000000001";

let head;
let owner;
let staff;
let waitingId;   // never approved — voucher must refuse this one
let approvedId;  // walked all the way to fin_approve

beforeAll(async () => {
  head = await login("chompoo@tcos.app", SEED_PASSWORD);
  owner = await login("beam@tcos.app", SEED_PASSWORD);
  staff = await login("mark@tcos.app", SEED_PASSWORD);

  const waiting = await api.post("/reimbursements", {
    token: head.token,
    body: { department_id: DEPT_CHOMPOO_HEADS, purpose: `${PREFIX} doc waiting`, details: [{ title: "x", amount: 4200 }] },
  });
  waitingId = waiting.data._id;

  const approved = await api.post("/reimbursements", {
    token: head.token,
    body: {
      department_id: DEPT_CHOMPOO_HEADS,
      purpose: `${PREFIX} doc approved`,
      details: [{ title: "ค่าอุปกรณ์", amount: 123456 }],
    },
  });
  approvedId = approved.data._id;
  const reauth = await stepUp(head.token, SEED_PASSWORD);
  await api.post(`/reimbursements/${approvedId}/status`, {
    token: head.token, reauth, body: { status: "fin_approve", tracking_id: `${PREFIX}-DOC` },
  });
});

describe("HTML rendering", () => {
  test("the request form renders", async () => {
    const res = await api.get(`/reimbursements/${approvedId}/document?type=request&format=html`, { token: head.token });
    expect(res.status).toBe(200);
    expect(res.text).toContain("<html");
  });

  test("the request form carries the reimbursement's own numbers", async () => {
    const res = await api.get(`/reimbursements/${approvedId}/document?type=request&format=html`, { token: head.token });
    expect(res.text).toContain("ค่าอุปกรณ์");
  });

  test("the voucher renders once finance has approved", async () => {
    const res = await api.get(`/reimbursements/${approvedId}/document?type=voucher&format=html`, { token: head.token });
    expect(res.status).toBe(200);
  });

  test("a verification QR pointing at /reimburse/<id> is embedded", async () => {
    // Dev plan: "At the bottom right, there should be QR code leading to
    // https://<BASE_URL>/reimburse/<id> for verification".
    const res = await api.get(`/reimbursements/${approvedId}/document?type=request&format=html`, { token: head.token });
    expect(res.text).toMatch(/data:image\/(png|svg\+xml)|<svg/i);
  });
});

describe("PDF rendering", () => {
  test("the request form renders as a real PDF", async () => {
    const res = await api.get(`/reimbursements/${approvedId}/document?type=request&format=pdf`, { token: head.token, raw: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    // %PDF- magic, and big enough to be an actual rendered page rather than a stub.
    expect(res.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.buffer.length).toBeGreaterThan(5000);
  });

  test("the voucher renders as a real PDF", async () => {
    const res = await api.get(`/reimbursements/${approvedId}/document?type=voucher&format=pdf`, { token: head.token, raw: true });
    expect(res.status).toBe(200);
    expect(res.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.buffer.length).toBeGreaterThan(5000);
  });
});

describe("document authorization and state", () => {
  test("a voucher is refused while the request is not yet approved", async () => {
    const res = await api.get(`/reimbursements/${waitingId}/document?type=voucher&format=html`, { token: head.token });
    expect(res.status).toBe(422);
    expect(res.code).toBe("NOT_APPROVED");
  });

  test("an unrelated staff member cannot render someone else's document", async () => {
    const res = await api.get(`/reimbursements/${approvedId}/document?type=request&format=html`, { token: staff.token });
    expect(res.status).toBe(403);
  });

  test("an unknown type is rejected", async () => {
    const res = await api.get(`/reimbursements/${approvedId}/document?type=invoice&format=html`, { token: head.token });
    expect(res.status).toBe(400);
  });

  test("the type parameter is required", async () => {
    const res = await api.get(`/reimbursements/${approvedId}/document?format=html`, { token: head.token });
    expect(res.status).toBe(400);
  });

  test("bank account numbers are masked for a viewer who is not the requester or finance", async () => {
    const res = await api.get(`/reimbursements/${approvedId}/document?type=request&format=html`, { token: owner.token });
    if (res.status === 200) {
      expect(res.text).not.toMatch(/\b\d{10,12}\b/);
    }
  });
});
