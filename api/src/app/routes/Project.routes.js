const { Router } = require("express");
const ctrl = require("../controllers/Project.controller");
const { verifyJWT, resolveScope, requireScope } = require("../middleware/Auth.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Project.schema");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #17
router.get("/", ...auth, ctrl.list);
// #18
router.post("/", ...auth, requireScope("isFinanceOrAdmin"), Validate.body(schema.create), ctrl.create);
// #19
router.get("/:id", ...auth, requireScope("isMember"), ctrl.getById);
// #20
router.patch("/:id", ...auth, requireScope("isManagerOrFinance"), Validate.body(schema.update), ctrl.update);
// #21
router.delete("/:id", ...auth, requireScope("isGlobal"), ctrl.remove);
// #22
router.get("/:id/tags", ...auth, requireScope("isMember"), ctrl.listTags);
// #23
router.post("/:id/tags", ...auth, requireScope("isFinance"), Validate.body(schema.createTags), ctrl.createTags);
// #26
router.get("/:id/departments", ...auth, requireScope("isMember"), ctrl.listDepartments);
// #27
router.post("/:id/departments", ...auth, requireScope("isManager"), Validate.body(schema.createDepartments), ctrl.createDepartments);
// #30
router.get("/:id/staff", ...auth, requireScope("isManager"), ctrl.listStaff);

// #24, #25, #28, #29 — mounted at top level (/v1/tags/:id, /v1/departments/:id) in routes/init.js.
// :id here is the tag/department's own id, not a project id — requireScope needs an explicit
// resolver to look up which project it belongs to (the default req.params.id fallback only
// works when the URL's :id already IS the target).
const tagProjectId = async (req) => {
  const { ProjectTag } = require("../models");
  return (await ProjectTag.findByPk(req.params.id))?.project_id;
};
const departmentProjectId = async (req) => {
  const { Department } = require("../models");
  return (await Department.findByPk(req.params.id))?.project_id;
};

const tagsRouter = Router();
tagsRouter.patch("/:id", ...auth, requireScope("isFinance", tagProjectId), Validate.body(schema.updateTag), ctrl.updateTag);
tagsRouter.delete("/:id", ...auth, requireScope("isFinance", tagProjectId), ctrl.removeTag);

const departmentsRouter = Router();
departmentsRouter.patch("/:id", ...auth, requireScope("isManager", departmentProjectId), Validate.body(schema.updateDepartment), ctrl.updateDepartment);
departmentsRouter.delete("/:id", ...auth, requireScope("isManager", departmentProjectId), ctrl.removeDepartment);

module.exports = { projectRouter: router, tagsRouter, departmentsRouter };
