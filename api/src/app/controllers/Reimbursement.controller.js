const asyncHandler = require("../utils/asyncHandler.util");
const { ok, created, noContent } = require("../utils/Response.util");
const Reimbursement = require("../helpers/Reimbursement.helper");
const Document = require("../helpers/Document.helper");

// MOCK ONLY, still used by #44/#45/#46 (update/cancel/uploadReceipt) — those three stay
// fixture-based this pass. `?mock_status=waiting|head_approve|...` lets FE exercise every
// branch (e.g. hit PATCH with mock_status=head_approve to see the real 422 INVALID_TRANSITION
// response). Defaults to 'waiting'. #47/#48/#49 below read the real row instead — no mock
// status needed there anymore.
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
  ok(res, await Reimbursement.changeStatus(req.params.id, req.body, req.scope))
);

exports.document = asyncHandler(async (req, res) => {
  const { contentType, body } = await Document.render(req.params.id, req.query, req.scope);
  res.setHeader("Content-Type", contentType);
  if (contentType === "application/pdf") {
    res.setHeader("Content-Disposition", `inline; filename="reimburse-${req.params.id}.pdf"`);
  }
  return res.send(body);
});

exports.bulkImport = asyncHandler(async (req, res) => {
  // multipart/form-data: multer's csvFile middleware only consumes the `file` field, so
  // project_id (a plain text field, not the upload) lands on req.body like any other
  // multipart field — no separate JSON body possible alongside a file upload.
  const result = await Reimbursement.bulkImport(req.file?.buffer, req.body?.project_id, req.scope.staffId);
  return created(res, result);
});
