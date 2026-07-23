/**
 * Shared mock builders. All example values are taken directly from the JSON examples in
 * docs/backend/03-api-spec.md so FE-visible mock data always matches the documented contract.
 * Every builder accepts overrides so controllers can echo request params (like :id) back into
 * the response instead of always returning the same hardcoded UUID.
 */
const { v7: uuidv7 } = require("uuid");

const now = () => new Date().toISOString();

function staff(overrides = {}) {
  return {
    _id: uuidv7(),
    title: "นาย",
    first_name: "สมชาย",
    last_name: "ใจดี",
    nickname: "Golf",
    email: "golf@tcos.app",
    phone: "0812345678",
    line_id: "golf_tcos",
    role: "finance",
    signature_image: "https://mock-r2.tcos.app/finance-signatures/018f.png",
    created_at: now(),
    updated_at: now(),
    ...overrides,
  };
}

function scope(overrides = {}) {
  return {
    memberships: [
      {
        project_id: uuidv7(),
        project_name: "The Coming of Stages 3",
        department_id: uuidv7(),
        department_name: "ฝ่ายการเงิน",
        is_head: false,
        is_finance: true,
        is_manager: false,
      },
    ],
    head_of: [],
    finance_of: [],
    manager_of: [],
    ...overrides,
  };
}

function bankAccount(overrides = {}) {
  return {
    _id: uuidv7(),
    name: "สมชาย ใจดี",
    number: "xxxxxx7890",
    provider: "กสิกรไทย",
    created_at: now(),
    ...overrides,
  };
}

function project(overrides = {}) {
  return {
    _id: uuidv7(),
    name: "The Coming of Stages 3",
    description: "ปีที่ 3",
    allocated_budget: 50000000,
    total_income: 12500000,
    total_expense: 8300000,
    created_at: now(),
    updated_at: now(),
    ...overrides,
  };
}

function tag(overrides = {}) {
  return {
    _id: uuidv7(),
    project_id: uuidv7(),
    name: "ค่าสถานที่",
    allocated_budget: 5000000,
    total_income: 0,
    total_expense: 4800000,
    created_at: now(),
    ...overrides,
  };
}

function department(overrides = {}) {
  return {
    _id: uuidv7(),
    project_id: uuidv7(),
    name: "ฝ่ายเวที",
    allocated_budget: 2000000,
    total_expense: 1900000,
    created_at: now(),
    ...overrides,
  };
}

function source(overrides = {}) {
  return {
    _id: uuidv7(),
    type: "spon",
    name: "บริษัท กล้วยหอมจอมซน จำกัด",
    tag_id: null,
    project_id: uuidv7(),
    expect_amount: 5000000,
    actual_amount: 5000000,
    reference_id: null,
    created_at: now(),
    updated_at: now(),
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    _id: uuidv7(),
    user_id: uuidv7(),
    source_id: uuidv7(),
    expected_amount: 50000,
    promptpay_qr_data: "00020101021229370016A000000677010111...",
    created_at: now(),
    ...overrides,
  };
}

function paymentStatusHistory(paymentId) {
  return [
    { status: "waiting", created_at: now(), staff: null },
    { status: "approved", created_at: now(), staff: { nickname: "Golf" } },
  ].map((row) => ({ payment_id: paymentId, ...row }));
}

function reimbursementDetail(overrides = {}) {
  return { _id: uuidv7(), title: "ผ้าม่านเวที", amount: 120000, created_at: now(), ...overrides };
}

function reimbursement(overrides = {}) {
  return {
    _id: uuidv7(),
    staff_dept_id: uuidv7(),
    tag_id: null,
    purpose: "ค่าอุปกรณ์ประกอบฉากรอบซ้อมใหญ่",
    tracking_id: null,
    banking_id: uuidv7(),
    receipt_link: null,
    latest_status: "waiting",
    details: [reimbursementDetail(), reimbursementDetail({ title: "ค่าขนส่ง", amount: 35000 })],
    created_at: now(),
    updated_at: now(),
    ...overrides,
  };
}

function reimbursementStatusHistory(reimbursementId, latestStatus = "waiting") {
  const chain = ["waiting", "head_approve", "fin_approve", "transfer"];
  const upTo = chain.indexOf(latestStatus) === -1 ? 0 : chain.indexOf(latestStatus);
  return chain.slice(0, upTo + 1).map((status, i) => ({
    reimbursement_id: reimbursementId,
    status,
    staff: i === 0 ? null : { nickname: "Golf" },
    created_at: now(),
  }));
}

function pagination(total = 3, page = 1, limit = 20) {
  return { page, limit, total };
}

module.exports = {
  uuidv7,
  now,
  staff,
  scope,
  bankAccount,
  project,
  tag,
  department,
  source,
  payment,
  paymentStatusHistory,
  reimbursementDetail,
  reimbursement,
  reimbursementStatusHistory,
  pagination,
};
