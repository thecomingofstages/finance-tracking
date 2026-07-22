const express = require("express");
const { app: appConf, validate } = require("./app/config/init");
const { mountGlobal } = require("./app/middleware/init");
const { mountV1 } = require("./app/routes/init");
const { errorHandler, notFoundHandler } = require("./app/middleware/ErrorHandler.middleware");
const { connect } = require("./app/database/init");
const logger = require("./app/utils/Logger.util");

async function main() {
  validate();

  const app = express();
  mountGlobal(app);
  mountV1(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Never fatal in MOCK_MODE — see database/init.js. Real DB wiring happens as helpers stop
  // reading from src/mocks/fixtures.js.
  await connect();

  app.listen(appConf.port, () => {
    logger.info(
      { port: appConf.port, mockMode: appConf.mockMode },
      `finance-tracking-api listening on http://localhost:${appConf.port} (MOCK_MODE=${appConf.mockMode})`
    );
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});
