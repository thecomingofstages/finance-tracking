const ApiError = require("../utils/ApiError.util");
const fixtures = require("../../mocks/fixtures");

/**
 * Grep this file for `TODO(mock)` to find every spot returning fixture data instead of
 * querying Postgres. Endpoint numbers (#N) match docs/backend/03-api-spec.md §2.
 */
class SourceHelper {
  /** #33 — GET /projects/:id/sources */
  static async list(projectId, _query) {
    // TODO(mock): query source by project_id (+ optional type/tag_id filters) instead of
    // two hardcoded fixtures.
    return [fixtures.source({ project_id: projectId }), fixtures.source({ project_id: projectId, type: "enroll", reference_id: fixtures.uuidv7(), actual_amount: 0 })];
  }

  /** #34 — POST /projects/:id/sources */
  static async create(projectId, { type, name, tag_id, expect_amount, reference_id }) {
    // Real already: the enroll/merch reference_id requirement is genuine validation, not mocked.
    if (!type || !name) throw ApiError.validation("type and name are required.");
    const needsReference = ["enroll", "merch"].includes(type);
    if (needsReference && !reference_id) throw ApiError.validation("reference_id is required for enroll/merch sources.", "reference_id");
    if (!needsReference && reference_id) throw ApiError.validation("reference_id must be omitted for spon/other sources.", "reference_id");

    // Real already: this mirroring is standing in for the trigger that doesn't exist yet
    // (doc 02 §6 gap #1) — spon/other sources should always have actual_amount ===
    // expect_amount, so this logic needs to move into the real insert path unchanged, not
    // be thrown away when the mock is.
    const actual_amount = needsReference ? 0 : expect_amount || 0;
    // TODO(mock): insert the real row instead of echoing the input onto a fixture.
    return fixtures.source({ project_id: projectId, type, name, tag_id: tag_id ?? null, expect_amount, reference_id: reference_id ?? null, actual_amount });
  }

  /** #35 — PATCH /sources/:id */
  static async update(sourceId, patch) {
    // Real already: the actual_amount/type/reference_id/project_id write-protection is genuine.
    const forbidden = ["actual_amount", "type", "reference_id", "project_id"];
    const rejected = Object.keys(patch).filter((k) => forbidden.includes(k));
    if (rejected.length) throw ApiError.validation(`Field not editable via this route: ${rejected[0]}`, rejected[0]);
    // TODO(mock): $set on the real row instead of echoing the patch onto a fixture.
    return fixtures.source({ _id: sourceId, ...patch });
  }

  /** #36 — DELETE /sources/:id */
  static async remove(_sourceId) {
    // TODO(mock): 409 CONFLICT if any live payment references this source, else $set deleted_at.
    return null;
  }
}

module.exports = SourceHelper;
