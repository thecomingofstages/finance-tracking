const { app: appConf } = require("../config/init");
const { sequelize } = require("../database/init");

/** Opens a Sequelize transaction and binds it to req.tx; commits/rolls back after the handler. */
function withTransaction() {
  return async (req, res, next) => {
    if (appConf.mockMode) {
      req.tx = null; // helpers check for this and skip the real DB path entirely in mock mode
      return next();
    }
    try {
      req.tx = await sequelize.transaction();
      res.on("finish", async () => {
        if (!req.tx.finished) {
          res.statusCode >= 400 ? await req.tx.rollback() : await req.tx.commit();
        }
      });
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { withTransaction };
