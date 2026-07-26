const express = require("express");
const { mountGlobal } = require("../../src/app/middleware/init");
const { mountRoot } = require("../../src/app/routes/root.routes");
const { mountV1 } = require("../../src/app/routes/init");
const { errorHandler, notFoundHandler } = require("../../src/app/middleware/ErrorHandler.middleware");

/** Same Express app as src/index.js minus DB connect() and app.listen() — see
 *  docs/backend/01-scaffold.md's testing section. Callers mock src/app/models (and anything
 *  else that talks to the outside world) before requiring this. */
function buildApp() {
  const app = express();
  mountGlobal(app);
  mountRoot(app);
  mountV1(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { buildApp };
