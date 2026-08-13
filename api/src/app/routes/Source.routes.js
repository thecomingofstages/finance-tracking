const { Router } = require("express");
const ctrl = require("../controllers/Source.controller");
const { verifyJWT, resolveScope, requireScope } = require("../middleware/Auth.middleware");
const Validate = require("../middleware/Validate.middleware");
const schema = require("../schemas/Source.schema");

const auth = [verifyJWT, resolveScope];

// Nested under /v1/projects/:id/sources — mounted in routes/init.js
const projectSourcesRouter = Router();
projectSourcesRouter.get("/:id/sources", ...auth, requireScope("isFinance"), Validate.query(schema.list), ctrl.list); // #33
projectSourcesRouter.post("/:id/sources", ...auth, requireScope("isFinance"), Validate.body(schema.create), ctrl.create); // #34

// Top level — /v1/sources/:id. :id is the source's own id, not a project id — resolve it.
const sourceProjectId = async (req) => {
  const { Source } = require("../models");
  return (await Source.findByPk(req.params.id))?.project_id;
};

const sourcesRouter = Router();
sourcesRouter.patch("/:id", ...auth, requireScope("isFinance", sourceProjectId), Validate.body(schema.update), ctrl.update); // #35
sourcesRouter.delete("/:id", ...auth, requireScope("isFinance", sourceProjectId), ctrl.remove); // #36

module.exports = { projectSourcesRouter, sourcesRouter };
