const { fn, col, where: sqlWhere, Op } = require("sequelize");
const ApiError = require("../utils/ApiError.util");
const R2 = require("../utils/R2.util");
const CSV = require("../utils/CSV.util");
const fixtures = require("../../mocks/fixtures");

/**
 * staff.email is plain TEXT UNIQUE, case-sensitive (doc 02 §6 gap #4) — lowercase both sides
 * ourselves. `paranoid: false` is deliberate, not a bug: the UNIQUE constraint isn't scoped to
 * `deleted_at IS NULL`, so a soft-deleted staff row still permanently occupies its email at the
 * DB level (doc 02 §6 gap #10) — Sequelize's default paranoid findOne would miss that row,
 * report the email as free, and then the real insert/update fails with a raw
 * SequelizeUniqueConstraintError (500) instead of a clean 409. Checking with paranoid:false
 * makes this match what the DB actually enforces. Shared by #10/#11/#12 below.
 */
function byEmail(email) {
  const { Staff } = require("../models");
  return Staff.findOne({
    where: sqlWhere(fn("lower", col("email")), String(email).toLowerCase()),
    paranoid: false,
  });
}

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

  /** #10 — POST /admin/staff (doc 03 §5). Real: creates the identity only — no password_hash,
   *  staff set their own via POST /auth/claim (#57). Role check (`role === 'admin'`) happens
   *  in the route via requireRole("admin"), not here. */
  static async adminCreate(payload) {
    if (!payload.email || !payload.first_name || !payload.last_name || !payload.nickname) {
      throw ApiError.validation("first_name, last_name, nickname, and email are required.");
    }
    const { Staff } = require("../models");
    const existing = await byEmail(payload.email);
    if (existing) throw ApiError.conflict("A staff member with this email already exists.", "DUPLICATE_EMAIL");
    const staff = await Staff.create({
      title: payload.title || null,
      first_name: payload.first_name,
      last_name: payload.last_name,
      nickname: payload.nickname,
      email: payload.email,
      phone: payload.phone || null,
    });
    return staff.toSafeJSON();
  }

  /** #11 — POST /admin/staff/import (doc 03 §5). All-or-nothing: every row is validated (required
   *  fields, email format, duplicate-in-file, duplicate-against-live-staff) before anything is
   *  written; any failure returns the full per-row error list and inserts nothing. */
  static async adminImport(fileBuffer) {
    if (!fileBuffer) throw ApiError.validation("A CSV file is required.", "file");
    const { rows, errors: parseErrors } = CSV.parse(fileBuffer);
    if (!rows.length) throw ApiError.validation("CSV has no rows.", "file");

    const rowErrors = parseErrors.map((e) => ({ row: e.row, message: e.message }));
    const seenEmails = new Map(); // lowercase email -> 1-based row number

    rows.forEach((row, i) => {
      const rowNum = i + 1;
      for (const field of ["first_name", "last_name", "nickname", "email"]) {
        if (!row[field] || !String(row[field]).trim()) {
          rowErrors.push({ row: rowNum, message: `${field} is required.` });
        }
      }
      if (row.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
          rowErrors.push({ row: rowNum, message: `Invalid email: ${row.email}` });
        } else {
          const key = row.email.toLowerCase();
          if (seenEmails.has(key)) {
            rowErrors.push({ row: rowNum, message: `Duplicate email in file: ${row.email} (also row ${seenEmails.get(key)})` });
          } else {
            seenEmails.set(key, rowNum);
          }
        }
      }
    });

    const { Staff, sequelize } = require("../models");

    if (rowErrors.length === 0 && seenEmails.size) {
      const existing = await Staff.findAll({
        where: sqlWhere(fn("lower", col("email")), { [Op.in]: [...seenEmails.keys()] }),
        attributes: ["email"],
      });
      for (const row of existing) {
        rowErrors.push({ row: seenEmails.get(row.email.toLowerCase()), message: `Email already exists: ${row.email}` });
      }
    }

    if (rowErrors.length) {
      throw ApiError.validationDetails(`${rowErrors.length} row(s) failed validation — nothing was imported.`, rowErrors);
    }

    const created = await sequelize.transaction((t) =>
      Staff.bulkCreate(
        rows.map((row) => ({
          title: row.title || null,
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          nickname: row.nickname.trim(),
          email: row.email.trim(),
          phone: row.phone || null,
          line_id: row.line_id || null,
        })),
        { transaction: t, returning: true }
      )
    );

    return { created: created.length, rows: created.map((s) => s.toSafeJSON()) };
  }

  /** #12 — PATCH /admin/staff/:id (doc 03 §5). `patch` is already zod-filtered to the allowed
   *  fields (nickname/phone/line_id/title/first_name/last_name/email/role) by the time it gets
   *  here — see Staff.schema.js's adminUpdate. */
  static async adminUpdate(staffId, patch) {
    const { Staff } = require("../models");
    const staff = await Staff.findByPk(staffId);
    if (!staff) throw ApiError.notFound("Staff not found.");
    if (patch.email) {
      const existing = await byEmail(patch.email);
      if (existing && existing._id !== staffId) {
        throw ApiError.conflict("A staff member with this email already exists.", "DUPLICATE_EMAIL");
      }
    }
    staff.set(patch);
    await staff.save();
    return staff.toSafeJSON();
  }

  /** #13 — DELETE /admin/staff/:id (doc 03 §5). Soft-delete only (paranoid:true sets
   *  deleted_at) — does not cascade to reimbursements/approvals already attributed to this
   *  staff member (intentional, not a gap). */
  static async adminDeactivate(staffId) {
    const { Staff } = require("../models");
    const staff = await Staff.findByPk(staffId);
    if (!staff) throw ApiError.notFound("Staff not found.");
    await staff.destroy();
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
