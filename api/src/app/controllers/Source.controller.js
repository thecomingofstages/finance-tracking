const asyncHandler = require("../utils/asyncHandler.util");
const { ok, created, noContent } = require("../utils/Response.util");
const Source = require("../helpers/Source.helper");

exports.list = asyncHandler(async (req, res) => ok(res, await Source.list(req.params.id, req.query)));

exports.create = asyncHandler(async (req, res) => created(res, await Source.create(req.params.id, req.body)));

exports.update = asyncHandler(async (req, res) => ok(res, await Source.update(req.params.id, req.body)));

exports.remove = asyncHandler(async (req, res) => {
  await Source.remove(req.params.id);
  return noContent(res);
});
