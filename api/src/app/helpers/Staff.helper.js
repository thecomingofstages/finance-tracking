const ApiError = require("../utils/ApiError.util");
const R2 = require("../utils/R2.util");
const fixtures = require("../../mocks/fixtures");

class StaffHelper {
  static async list(_query) {
    // TODO: scope to projects the caller manages; join staff_dept for flags.
    const rows = [fixtures.staff(), fixtures.staff({ nickname: "Nok", email: "nok@tcos.app" })];
    return { rows, meta: fixtures.pagination(rows.length) };
  }

  static async getById(staffId) {
    return { ...fixtures.staff({ _id: staffId }), memberships: fixtures.scope().memberships };
  }

  static async updateSelf(staffId, patch) {
    const allowed = ["nickname", "phone", "line_id", "title"];
    const rejected = Object.keys(patch).filter((k) => !allowed.includes(k));
    if (rejected.length) throw ApiError.validation(`Field not editable here: ${rejected[0]}`, rejected[0]);
    return fixtures.staff({ _id: staffId, ...patch });
  }

  static async adminCreate(payload) {
    if (!payload.email || !payload.first_name || !payload.last_name || !payload.nickname) {
      throw ApiError.validation("first_name, last_name, nickname, and email are required.");
    }
    // password_hash intentionally not set — staff sets their own via POST /auth/claim.
    return fixtures.staff({ ...payload, password_hash: undefined });
  }

  static async adminImport(_fileBuffer) {
    // TODO: CSV.util.parse, validate every row before writing anything, all-or-nothing insert.
    return { created: 2, rows: [fixtures.staff(), fixtures.staff({ nickname: "Nok" })] };
  }

  static async adminUpdate(staffId, patch) {
    return fixtures.staff({ _id: staffId, ...patch });
  }

  static async adminDeactivate(_staffId) {
    // Soft-delete only — does not cascade to reimbursements/approvals already attributed here.
    return null;
  }

  static async listBankAccounts(_staffId) {
    return [fixtures.bankAccount({ number: "1234567890" }), fixtures.bankAccount({ provider: "กรุงไทย" })];
  }

  static async addBankAccount(staffId, { name, number, provider }) {
    if (!name || !number || !provider) throw ApiError.validation("name, number, and provider are required.");
    return fixtures.bankAccount({ staff_id: staffId, name, number, provider });
  }

  static async removeBankAccount(_accountId) {
    return null;
  }

  static async uploadSignature(staffId, file) {
    if (!file) throw ApiError.validation("signature file is required.", "signature");
    const key = R2.buildKey("signatures", staffId, "png");
    await R2.upload("signatures", key, file.buffer, file.mimetype);
    return { signature_image: await R2.presignedUrl("signatures", key) };
  }
}

module.exports = StaffHelper;
