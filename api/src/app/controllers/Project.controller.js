const asyncHandler = require("../utils/asyncHandler.util");
const { ok, created, noContent } = require("../utils/Response.util");
const Project = require("../helpers/Project.helper");

exports.list = asyncHandler(async (req, res) => {
  const { rows, meta } = await Project.list(req.query);
  return ok(res, rows, { meta });
});

exports.create = asyncHandler(async (req, res) => created(res, await Project.create(req.body)));

exports.getById = asyncHandler(async (req, res) => ok(res, await Project.getById(req.params.id)));

exports.update = asyncHandler(async (req, res) => ok(res, await Project.update(req.params.id, req.body)));

exports.remove = asyncHandler(async (req, res) => {
  await Project.remove(req.params.id);
  return noContent(res);
});

exports.listTags = asyncHandler(async (req, res) => ok(res, await Project.listTags(req.params.id)));

exports.createTags = asyncHandler(async (req, res) =>
  created(res, await Project.createTags(req.params.id, req.body?.tags))
);

exports.updateTag = asyncHandler(async (req, res) => ok(res, await Project.updateTag(req.params.id, req.body)));

exports.removeTag = asyncHandler(async (req, res) => {
  await Project.removeTag(req.params.id);
  return noContent(res);
});

exports.listDepartments = asyncHandler(async (req, res) => ok(res, await Project.listDepartments(req.params.id)));

exports.createDepartments = asyncHandler(async (req, res) =>
  created(res, await Project.createDepartments(req.params.id, req.body?.departments))
);

exports.updateDepartment = asyncHandler(async (req, res) =>
  ok(res, await Project.updateDepartment(req.params.id, req.body))
);

exports.removeDepartment = asyncHandler(async (req, res) => {
  await Project.removeDepartment(req.params.id);
  return noContent(res);
});

exports.listStaff = asyncHandler(async (req, res) => ok(res, await Project.listStaff(req.params.id)));
