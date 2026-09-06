import { defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E against the DEPLOYED Worker, not a local `next dev`.
 *
 * That distinction is the whole point of this config: the frontend and the API sit on
 * different registrable domains in production (*.workers.dev vs *.up.railway.app), so cookie
 * SameSite behaviour, CORS and the build-time-inlined NEXT_PUBLIC_* values only behave
 * realistically here. Point E2E_WEB_URL at a preview deploy to run it elsewhere.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // one shared remote database
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_WEB_URL || "https://finance-tracking-web.thecomingofstages.workers.dev",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "th-TH",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
