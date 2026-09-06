/**
 * E2E config — separate from the default `npm test` run on purpose. The unit suite under
 * tests/*.test.js mocks models, email and rate limiting; this one must not, because it talks
 * to the deployed API over the network. One `testMatch`, no setup files, generous timeout
 * (Railway cold starts and Puppeteer renders are both slow).
 */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/e2e/**/*.e2e.test.js"],
  testTimeout: 60000,
  maxWorkers: 1, // shared remote DB — parallel workers would race on the same rows
  verbose: true,
};
