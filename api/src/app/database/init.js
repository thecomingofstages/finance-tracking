const logger = require("../utils/Logger.util");
const { app: appConf } = require("../config/init");
const sequelize = require("./Postgres.database");

/**
 * Attempts a real Postgres connection. Never throws — in MOCK_MODE (the default), a missing
 * local Supabase is expected and the server should keep serving mock responses regardless.
 * Call this from index.js; check the return value if a route actually needs a live DB.
 */
async function connect() {
  try {
    // Loading models/index.js is what actually runs Sequelize.init() for every table.
    require("../models");
    await sequelize.authenticate();
    logger.info("Postgres connected");
    return true;
  } catch (err) {
    if (appConf.mockMode) {
      logger.warn({ err: err.message }, "Postgres not reachable — continuing in MOCK_MODE");
      return false;
    }
    throw err;
  }
}

async function close() {
  await sequelize.close();
}

module.exports = { connect, close, sequelize };
