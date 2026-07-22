const { Router } = require("express");
const ctrl = require("../controllers/Source.controller");
const { verifyJWT, resolveScope, requireScope } = require("../middleware/Auth.middleware");

const auth = [verifyJWT, resolveScope];

// Nested under /v1/projects/:id/sources — mounted in routes/init.js
const projectSourcesRouter = Router();
projectSourcesRouter.get("/:id/sources", ...auth, requireScope("isFinance"), ctrl.list); // #33
projectSourcesRouter.post("/:id/sources", ...auth, requireScope("isFinance"), ctrl.create); // #34

// Top level — /v1/sources/:id
const sourcesRouter = Router();
sourcesRouter.patch("/:id", ...auth, requireScope("isFinance"), ctrl.update); // #35
sourcesRouter.delete("/:id", ...auth, requireScope("isFinance"), ctrl.remove); // #36

module.exports = { projectSourcesRouter, sourcesRouter };
