const pino = require("pino");
const { logLevel } = require("../config/app.conf");

const logger = pino({
  level: logLevel,
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});

module.exports = logger;
