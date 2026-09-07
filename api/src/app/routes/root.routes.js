const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");
const { app: appConf } = require("../config/init");

const swaggerDocument = yaml.load(fs.readFileSync(path.join(__dirname, "..", "..", "..", "swagger.yaml"), "utf8"));

/** Mounts the two routes that sit outside /v1: a plain root info response, and interactive
 *  Swagger UI docs generated straight from swagger.yaml (same file api-docs
 *  scripts/generate-fe-client.js reads — one spec, two consumers). */
function mountRoot(app) {
  app.get("/", (req, res) => {
    res.json({
      success: true,
      data: {
        name: "finance-tracking-api",
        version: require("../../../package.json").version,
        mockMode: appConf.mockMode,
        docs: docsExposed ? `${appConf.baseUrl}/api-docs` : null,
        health: `${appConf.baseUrl}/v1/health`,
      },
    });
  });

  // The UI and the raw spec together enumerate every route, payload shape and error code to an
  // unauthenticated caller. That is fine on a staging box and not fine on the instance holding
  // real finance records, so it is off in production unless explicitly re-enabled.
  const docsExposed = process.env.EXPOSE_API_DOCS
    ? process.env.EXPOSE_API_DOCS === "true"
    : appConf.env !== "production";

  if (docsExposed) {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, { customSiteTitle: "TCOS Finance Tracking API" }));
    // Raw spec, for tools that want the file itself (codegen, Postman import, etc.) rather than the UI.
    app.get("/api-docs.json", (req, res) => res.json(swaggerDocument));
  }
}

module.exports = { mountRoot };
