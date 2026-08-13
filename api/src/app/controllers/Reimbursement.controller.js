const asyncHandler = require("../utils/asyncHandler.util");
const { ok, created, noContent } = require("../utils/Response.util");
const Reimbursement = require("../helpers/Reimbursement.helper");
const Document = require("../helpers/Document.helper");

exports.create = asyncHandler(async (req, res) => {
  const { record, meta } = await Reimbursement.create(req.body, req.scope);
  return created(res, record, meta);
});

exports.list = asyncHandler(async (req, res) => {
  const { rows, meta } = await Reimbursement.list(req.query, req.scope);
  return ok(res, rows, { meta });
});

exports.getById = asyncHandler(async (req, res) => ok(res, await Reimbursement.getById(req.params.id, req.scope)));

exports.update = asyncHandler(async (req, res) => {
  const { record, meta } = await Reimbursement.update(req.params.id, req.body, req.scope);
  return ok(res, record, { meta });
});

exports.cancel = asyncHandler(async (req, res) => {
  await Reimbursement.cancel(req.params.id, req.scope);
  return noContent(res);
});

exports.uploadReceipt = asyncHandler(async (req, res) =>
  ok(res, await Reimbursement.uploadReceipt(req.params.id, req.file, req.scope))
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
