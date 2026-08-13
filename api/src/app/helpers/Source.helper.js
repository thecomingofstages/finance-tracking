const ApiError = require("../utils/ApiError.util");

function toPlain(record) {
  return typeof record?.toJSON === "function" ? record.toJSON() : record;
}

/**
 * Endpoint numbers (#N) match docs/backend/03-api-spec.md §2.
 */
class SourceHelper {
  /** #33 — GET /projects/:id/sources */
  static async list(projectId, { type, tag_id }) {
    const { Project, Source } = require("../models");
    const project = await Project.findByPk(projectId);
    if (!project) throw ApiError.notFound("Project not found.");

    const rows = await Source.findAll({
      where: {
        project_id: projectId,
        ...(type && { type }),
        ...(tag_id && { tag_id }),
      },
      order: [["created_at", "DESC"], ["_id", "ASC"]],
    });
    return rows.map(toPlain);
  }

  /** #34 — POST /projects/:id/sources (doc 03 §6). Real. */
  static async create(projectId, { type, name, tag_id, expect_amount, reference_id }) {
    // Real already: the enroll/merch reference_id requirement is genuine validation, not mocked.
    if (!type || !name) throw ApiError.validation("type and name are required.");
    const needsReference = ["enroll", "merch"].includes(type);
    if (needsReference && !reference_id) throw ApiError.validation("reference_id is required for enroll/merch sources.", "reference_id");
    if (!needsReference && reference_id) throw ApiError.validation("reference_id must be omitted for spon/other sources.", "reference_id");

    const { Project, ProjectTag, Source } = require("../models");
    const project = await Project.findByPk(projectId);
    if (!project) throw ApiError.notFound("Project not found.");
    if (tag_id) {
      const tag = await ProjectTag.findOne({ where: { _id: tag_id, project_id: projectId } });
      if (!tag) throw ApiError.validation("tag_id does not belong to this project.", "tag_id");
    }

    // Real already: this mirroring is standing in for the trigger that doesn't exist yet
    // (doc 02 §6 gap #1) — spon/other sources should always have actual_amount ===
    // expect_amount, so this logic needs to move into the real insert path unchanged, not
    // be thrown away when the mock is.
    const actual_amount = needsReference ? 0 : expect_amount || 0;
    const source = await Source.create({
      project_id: projectId,
      type,
      name,
      tag_id: tag_id ?? null,
      expect_amount: expect_amount ?? 0,
      reference_id: reference_id ?? null,
      actual_amount,
    });
    return source.toJSON();
  }

  /** #35 — PATCH /sources/:id (doc 03 §6). Real. */
  static async update(sourceId, patch) {
    // Real already: the actual_amount/type/reference_id/project_id write-protection is genuine.
    const forbidden = ["actual_amount", "type", "reference_id", "project_id"];
    const rejected = Object.keys(patch).filter((k) => forbidden.includes(k));
    if (rejected.length) throw ApiError.validation(`Field not editable via this route: ${rejected[0]}`, rejected[0]);
    const { Source } = require("../models");
    const source = await Source.findByPk(sourceId);
    if (!source) throw ApiError.notFound("Source not found.");
    source.set(patch);
    await source.save();
    return source.toJSON();
  }

  /** #36 — DELETE /sources/:id (doc 03 §6). Real: 409 if any live payment references it. */
  static async remove(sourceId) {
    const { Source, Payment } = require("../models");
    const source = await Source.findByPk(sourceId);
    if (!source) throw ApiError.notFound("Source not found.");
    const paymentCount = await Payment.count({ where: { source_id: sourceId } });
    if (paymentCount) {
      throw ApiError.conflict("Can't delete a source that still has payments attached.", "SOURCE_HAS_DEPENDENTS");
    }
    await source.destroy();
    return null;
  }
}

module.exports = SourceHelper;
