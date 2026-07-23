const asyncHandler = require("../utils/asyncHandler.util");
const { ok, created, noContent } = require("../utils/Response.util");
const Reimbursement = require("../helpers/Reimbursement.helper");
const Document = require("../helpers/Document.helper");

// MOCK ONLY: there's no real DB holding state between calls yet, so status-dependent routes
// accept `?mock_status=waiting|head_approve|...` to let FE exercise every branch (e.g. hit
// PATCH with mock_status=head_approve to see the real 422 INVALID_TRANSITION response).
// Defaults to 'waiting'. Delete this once Reimbursement.helper.js reads real records.
const currentStatus = (req) => req.query.mock_status || "waiting";

exports.create = asyncHandler(async (req, res) => {
  const { record, meta } = await Reimbursement.create(req.body, req.scope);
  return created(res, record, meta);
});

exports.list = asyncHandler(async (req, res) => {
  const { rows, meta } = await Reimbursement.list(req.query);
  return ok(res, rows, { meta });
});

exports.getById = asyncHandler(async (req, res) => ok(res, await Reimbursement.getById(req.params.id)));

exports.update = asyncHandler(async (req, res) =>
  ok(res, await Reimbursement.update(req.params.id, req.body, currentStatus(req)))
);

exports.cancel = asyncHandler(async (req, res) => {
  await Reimbursement.cancel(req.params.id, currentStatus(req));
  return noContent(res);
});

exports.uploadReceipt = asyncHandler(async (req, res) =>
  ok(res, await Reimbursement.uploadReceipt(req.params.id, req.file, currentStatus(req)))
);

exports.changeStatus = asyncHandler(async (req, res) =>
  ok(res, await Reimbursement.changeStatus(req.params.id, req.body, currentStatus(req)))
);

exports.document = asyncHandler(async (req, res) => {
  const { contentType, body } = await Document.render(req.params.id, req.query);
  res.setHeader("Content-Type", contentType);
  if (contentType === "application/pdf") {
    res.setHeader("Content-Disposition", `inline; filename="reimburse-${req.params.id}.pdf"`);
  }
  return res.send(body);
});

exports.bulkImport = asyncHandler(async (req, res) => {
  const result = await Reimbursement.bulkImport(req.file?.buffer, req.params.id);
  return created(res, result);
});
