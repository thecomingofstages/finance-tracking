#!/usr/bin/env node
/**
 * Generates TypeScript types straight from swagger.yaml directly into web/ — FE's typed API
 * layer is a build artifact of the spec, not a hand-maintained copy of it. Regenerate after
 * every swagger.yaml change: `npm run gen:client` (from api/).
 *
 * Only types.gen.ts is generated. web/src/lib/api/client.ts (the openapi-fetch wrapper) is
 * hand-written once and doesn't change when routes do.
 */
const path = require("node:path");
const openapiTS = require("openapi-typescript").default;
const fs = require("node:fs/promises");

async function main() {
  const specPath = path.join(__dirname, "..", "swagger.yaml");
  const outDir = path.join(__dirname, "..", "..", "web", "src", "lib", "api");
  const outFile = path.join(outDir, "types.gen.ts");

  const ast = await openapiTS(new URL(`file://${specPath.replace(/\\/g, "/")}`));
  const output = require("openapi-typescript").astToString
    ? require("openapi-typescript").astToString(ast)
    : ast; // openapi-typescript@7 returns an AST; astToString renders it

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, output, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Generated ${path.relative(process.cwd(), outFile)} from swagger.yaml`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
