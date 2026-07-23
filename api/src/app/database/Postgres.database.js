const { Sequelize } = require("sequelize");
const { db, dbKeys } = require("../config/init");

/** Singleton Sequelize instance. sync:false always — Supabase CLI migrations own the schema,
 *  this only maps it. See docs/backend/01-scaffold.md and 02-database.md. */
const sequelize = new Sequelize(db.database, db.username, dbKeys.password, {
  host: db.host,
  port: db.port,
  dialect: "postgres",
  logging: false,
  pool: db.pool,
});

module.exports = sequelize;
