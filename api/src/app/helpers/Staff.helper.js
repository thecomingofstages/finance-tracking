const ApiError = require("../utils/ApiError.util");
const R2 = require("../utils/R2.util");
const fixtures = require("../../mocks/fixtures");

/**
 * Grep this file for `TODO(mock)` to find every spot returning fixture data instead of
 * querying Postgres. Endpoint numbers (#N) match docs/backend/03-api-spec.md §2.
 * `uploadSignature` is the one method here that's already fully real — R2 doesn't mock.
 */
class StaffHelper {
  /** #7 — GET /staff */
  static async list(_query) {
    // TODO(mock): scope to projects the caller manages (requireScope("isManager") only
    // checks the route is reachable in MOCK_MODE, not which staff to actually return);
    // join staff_dept for is_head/is_finance/is_manager flags.
    const rows = [fixtures.staff(), fixtures.staff({ nickname: "Nok", email: "nok@tcos.app" })];
    return { rows, meta: fixtures.pagination(rows.length) };
  }

  /** #8 — GET /staff/:id */
  static async getById(staffId) {
    // TODO(mock): load the real Staff row + real staff_dept memberships instead of a
    // fabricated record and the caller's own mock scope.
    return { ...fixtures.staff({ _id: staffId }), memberships: fixtures.scope().memberships };
  }

  /** #9 — PATCH /staff/me */
  static async updateSelf(staffId, patch) {
    // Real already: the email/role whitelist rejection below is genuine validation, not mocked.
    const allowed = ["nickname", "phone", "line_id", "title"];
    const rejected = Object.keys(patch).filter((k) => !allowed.includes(k));
    if (rejected.length) throw ApiError.validation(`Field not editable here: ${rejected[0]}`, rejected[0]);
    // TODO(mock): $set on the real Staff row instead of echoing the patch onto a fixture.
    return fixtures.staff({ _id: staffId, ...patch });
  }

  /** #10 — POST /admin/staff */
  static async adminCreate(payload) {
    if (!payload.email || !payload.first_name || !payload.last_name || !payload.nickname) {
      throw ApiError.validation("first_name, last_name, nickname, and email are required.");
    }
    // TODO(mock): check email uniqueness (409 DUPLICATE_EMAIL) and actually insert the row.
    // password_hash intentionally not set here for real, not mocked — staff sets their own
    // via POST /auth/claim (#57), per the plan.
    return fixtures.staff({ ...payload, password_hash: undefined });
  }

  /** #11 — POST /admin/staff/import */
  static async adminImport(_fileBuffer) {
    // TODO(mock): CSV.util.parse the real upload, validate every row before writing anything,
    // all-or-nothing insert (doc 03 §5). Currently ignores the file entirely and returns two
    // fixture rows regardless of what was uploaded.
    return { created: 2, rows: [fixtures.staff(), fixtures.staff({ nickname: "Nok" })] };
  }

  /** #12 — PATCH /admin/staff/:id */
  static async adminUpdate(staffId, patch) {
    // TODO(mock): check email uniqueness if email is changing, $set on the real row.
    return fixtures.staff({ _id: staffId, ...patch });
  }

  /** #13 — DELETE /admin/staff/:id */
  static async adminDeactivate(_staffId) {
    // TODO(mock): $set deleted_at on the real row. Soft-delete only — does not cascade to
    // reimbursements/approvals already attributed to this staff member (intentional, not a gap).
    return null;
  }

  /** #14 — GET /staff/me/bank-accounts */
  static async listBankAccounts(_staffId) {
    // TODO(mock): query bankaccount by staff_id instead of returning two fixtures regardless
    // of who's asking.
    return [fixtures.bankAccount({ number: "1234567890" }), fixtures.bankAccount({ provider: "กรุงไทย" })];
  }

  /** #15 — POST /staff/me/bank-accounts */
  static async addBankAccount(staffId, { name, number, provider }) {
    if (!name || !number || !provider) throw ApiError.validation("name, number, and provider are required.");
    // TODO(mock): insert the real row. Check for a duplicate live account first — the
    // shipped schema's UNIQUE on `number` is global, not per-staff (doc 02 §6 gap #7), so a
    // real duplicate-number error here may not mean what it looks like.
    return fixtures.bankAccount({ staff_id: staffId, name, number, provider });
  }

  /** #16 — DELETE /staff/me/bank-accounts/:id */
  static async removeBankAccount(_accountId) {
    // TODO(mock): verify ownership (403 if it belongs to someone else), then $set deleted_at.
    return null;
  }

  /** #60 — POST /staff/me/signature. Already real, not mocked — genuinely uploads to R2 and
   *  returns a real presigned URL (see api/README.md, "R2 storage" is decoupled from
   *  MOCK_MODE). Only the "$set staff.signature_image" write-back is still missing. */
  static async uploadSignature(staffId, file) {
    if (!file) throw ApiError.validation("signature file is required.", "signature");
    const key = R2.buildKey("signatures", staffId, "png");
    await R2.upload("signatures", key, file.buffer, file.mimetype);
    // TODO(mock): $set staff.signature_image = key on the real Staff row. The R2 upload
    // itself above needs no changes when this goes real.
    return { signature_image: await R2.presignedUrl("signatures", key) };
  }
}

module.exports = StaffHelper;
