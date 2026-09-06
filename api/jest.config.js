/**
 * Default `npm test` — the offline unit suite only.
 *
 * tests/e2e/ matches Jest's default testMatch too, so without this ignore `npm test` silently
 * fires the deployed-stack suite at the live API: slow, network-dependent, and it writes rows
 * to a shared database. Those run explicitly via `npm run test:e2e` (jest.e2e.config.js).
 */
module.exports = {
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/tests/e2e/"],
};
