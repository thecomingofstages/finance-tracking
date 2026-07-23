const asyncHandler = require("../utils/asyncHandler.util");
const { ok, created, noContent } = require("../utils/Response.util");
const Staff = require("../helpers/Staff.helper");

exports.list = asyncHandler(async (req, res) => {
  const { rows, meta } = await Staff.list(req.query);
  return ok(res, rows, { meta });
});

exports.getById = asyncHandler(async (req, res) => ok(res, await Staff.getById(req.params.id)));

exports.updateSelf = asyncHandler(async (req, res) =>
  ok(res, await Staff.updateSelf(req.auth.staffId, req.body))
);

exports.adminCreate = asyncHandler(async (req, res) => created(res, await Staff.adminCreate(req.body)));

exports.adminImport = asyncHandler(async (req, res) => {
  const result = await Staff.adminImport(req.file?.buffer);
  return created(res, result);
});

exports.adminUpdate = asyncHandler(async (req, res) =>
  ok(res, await Staff.adminUpdate(req.params.id, req.body))
);

exports.adminDeactivate = asyncHandler(async (req, res) => {
  await Staff.adminDeactivate(req.params.id);
  return noContent(res);
});

exports.listBankAccounts = asyncHandler(async (req, res) =>
  ok(res, await Staff.listBankAccounts(req.auth.staffId))
);

exports.addBankAccount = asyncHandler(async (req, res) =>
  created(res, await Staff.addBankAccount(req.auth.staffId, req.body))
);

exports.removeBankAccount = asyncHandler(async (req, res) => {
  await Staff.removeBankAccount(req.params.id);
  return noContent(res);
});

exports.uploadSignature = asyncHandler(async (req, res) =>
  ok(res, await Staff.uploadSignature(req.auth.staffId, req.file))
);
