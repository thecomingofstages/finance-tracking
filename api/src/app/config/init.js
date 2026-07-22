const { z } = require("zod");
const app = require("./app.conf");
const keys = require("./app.keys");
const db = require("./db.conf");
const dbKeys = require("./db.keys");
const r2 = require("./r2.conf");
const r2Keys = require("./r2.keys");

const schema = z.object({
  port: z.number().int().positive(),
  baseUrl: z.string().url(),
});

function validate() {
  schema.parse({ port: app.port, baseUrl: app.baseUrl });
  if (!keys.jwtPrivateKey || !keys.jwtPublicKey) {
    throw new Error(
      "JWT keypair missing. Set JWT_PRIVATE_KEY/JWT_PUBLIC_KEY, or run with MOCK_MODE=true " +
        "to get an ephemeral dev keypair (see app.keys.js)."
    );
  }
  if (!app.mockMode && !dbKeys.password) {
    throw new Error("DB_PASSWORD is required when MOCK_MODE=false.");
  }
}

module.exports = { app, keys, db, dbKeys, r2, r2Keys, validate };
