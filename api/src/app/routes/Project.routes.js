const { Router } = require("express");
const ctrl = require("../controllers/Project.controller");
const { verifyJWT, resolveScope, requireScope } = require("../middleware/Auth.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Project.schema");
const Target = require("../utils/ScopeTarget.util");

const router = Router();
const auth = [verifyJWT, resolveScope];

// #17
router.get("/", ...auth, ctrl.list);
// #18
router.post("/", ...auth, requireScope("isFinanceOrAdmin", Target.anyProject), Validate.body(schema.create), ctrl.create);
// #19
router.get("/:id", ...auth, requireScope("isMember", Target.param()), ctrl.getById);
// #20
router.patch("/:id", ...auth, requireScope("isManagerOrFinance", Target.param()), Validate.body(schema.update), ctrl.update);
// #21
// isGlobal is a global check by definition (doc 04 §3: "Delete a project | admin | global"),
// so there is no per-project target to resolve.
router.delete("/:id", ...auth, requireScope("isGlobal", Target.anyProject), ctrl.remove);
// #22
router.get("/:id/tags", ...auth, requireScope("isMember", Target.param()), ctrl.listTags);
// #23
router.post("/:id/tags", ...auth, requireScope("isFinance", Target.param()), Validate.body(schema.createTags), ctrl.createTags);
// #26
router.get("/:id/departments", ...auth, requireScope("isMember", Target.param()), ctrl.listDepartments);
// #27
router.post("/:id/departments", ...auth, requireScope("isManager", Target.param()), Validate.body(schema.createDepartments), ctrl.createDepartments);
// #30
router.get("/:id/staff", ...auth, requireScope("isManager", Target.param()), ctrl.listStaff);

// #24, #25, #28, #29 — mounted at top level (/v1/tags/:id, /v1/departments/:id) in routes/init.js
const tagsRouter = Router();
tagsRouter.patch("/:id", ...auth, requireScope("isFinance", Target.projectOfTag), Validate.body(schema.updateTag), ctrl.updateTag);
tagsRouter.delete("/:id", ...auth, requireScope("isFinance", Target.projectOfTag), ctrl.removeTag);

const departmentsRouter = Router();
departmentsRouter.patch("/:id", ...auth, requireScope("isManager", Target.projectOfDepartment), Validate.body(schema.updateDepartment), ctrl.updateDepartment);
departmentsRouter.delete("/:id", ...auth, requireScope("isManager", Target.projectOfDepartment), ctrl.removeDepartment);

module.exports = { projectRouter: router, tagsRouter, departmentsRouter };
