const asyncHandler = require("../utils/asyncHandler.util");
const { ok, created } = require("../utils/Response.util");
const Payment = require("../helpers/Payment.helper");

exports.ingest = asyncHandler(async (req, res) => created(res, await Payment.ingest(req.body)));

exports.list = asyncHandler(async (req, res) => {
  const { rows, meta } = await Payment.list(req.query.project_id, req.query);
  return ok(res, rows, { meta });
});

exports.getById = asyncHandler(async (req, res) => ok(res, await Payment.getById(req.params.id)));

exports.bulkApprove = asyncHandler(async (req, res) => {
  const results = await Payment.bulkApprove(req.body?.decisions);
  return ok(res, { results });
});
