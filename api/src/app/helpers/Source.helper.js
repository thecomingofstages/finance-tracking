const ApiError = require("../utils/ApiError.util");
const fixtures = require("../../mocks/fixtures");

class SourceHelper {
  static async list(projectId, _query) {
    return [fixtures.source({ project_id: projectId }), fixtures.source({ project_id: projectId, type: "enroll", reference_id: fixtures.uuidv7(), actual_amount: 0 })];
  }

  static async create(projectId, { type, name, tag_id, expect_amount, reference_id }) {
    if (!type || !name) throw ApiError.validation("type and name are required.");
    const needsReference = ["enroll", "merch"].includes(type);
    if (needsReference && !reference_id) throw ApiError.validation("reference_id is required for enroll/merch sources.", "reference_id");
    if (!needsReference && reference_id) throw ApiError.validation("reference_id must be omitted for spon/other sources.", "reference_id");

    // Intended trigger behavior (doc 02 §6 gap #1): spon/other mirror actual_amount immediately.
    const actual_amount = needsReference ? 0 : expect_amount || 0;
    return fixtures.source({ project_id: projectId, type, name, tag_id: tag_id ?? null, expect_amount, reference_id: reference_id ?? null, actual_amount });
  }

  static async update(sourceId, patch) {
    const forbidden = ["actual_amount", "type", "reference_id", "project_id"];
    const rejected = Object.keys(patch).filter((k) => forbidden.includes(k));
    if (rejected.length) throw ApiError.validation(`Field not editable via this route: ${rejected[0]}`, rejected[0]);
    return fixtures.source({ _id: sourceId, ...patch });
  }

  static async remove(_sourceId) {
    // TODO: 409 CONFLICT if any live payment references this source.
    return null;
  }
}

module.exports = SourceHelper;
