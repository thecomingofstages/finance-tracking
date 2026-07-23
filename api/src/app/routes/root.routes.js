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
        docs: `${appConf.baseUrl}/api-docs`,
        health: `${appConf.baseUrl}/v1/health`,
      },
    });
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, { customSiteTitle: "TCOS Finance Tracking API" }));
  // Raw spec, for tools that want the file itself (codegen, Postman import, etc.) rather than the UI.
  app.get("/api-docs.json", (req, res) => res.json(swaggerDocument));
}

module.exports = { mountRoot };
