const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const pinoHttp = require("pino-http");
const express = require("express");
const { app: appConf } = require("../config/init");
const logger = require("../utils/Logger.util");

/** Mounts global (pre-route) middleware. Route-specific middleware (Auth, Validate, Upload,
 *  RateLimit) is applied per-router — see routes/*.routes.js. */
function mountGlobal(app) {
  app.use(helmet());
  app.use(cors({ origin: appConf.corsOrigin, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));
}

module.exports = { mountGlobal };
