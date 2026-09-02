import { test, expect } from "@playwright/test";
import { login, accounts, API_URL, expectNoUnauthorizedLeak } from "./helpers";

test.describe("login page", () => {
  test("renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
  });

  test("offers Google sign-in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/continue with google/i)).toBeVisible();
  });

  test("uses the Prompt typeface", async ({ page }) => {
    // Frontend tab, Flow & User Interface: "Font = Prompt".
    await page.goto("/login");
    const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(family.toLowerCase()).toContain("prompt");
  });

  test("talks to the deployed API, not localhost", async ({ page }) => {
    // NEXT_PUBLIC_API_URL is inlined at build time; a build made with the local default would
    // produce a frontend that silently fails for every visitor.
    const calls: string[] = [];
    page.on("request", (r) => calls.push(r.url()));
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(accounts.staff.email);
    await page.locator('input[type="password"]').first().fill(accounts.staff.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForResponse((r) => r.url().includes("/auth/login"));
    expect(calls.some((u) => u.startsWith(API_URL))).toBe(true);
    expect(calls.some((u) => u.includes("localhost") || u.includes("127.0.0.1"))).toBe(false);
  });

  test("rejects bad credentials with a visible message", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(accounts.staff.email);
    await page.locator('input[type="password"]').first().fill("wrong-password-here");
    await page.locator('button[type="submit"]').first().click();
    await page.waitForResponse((r) => r.url().includes("/auth/login"));
    await expect(page.locator("body")).toContainText(/ไม่ถูกต้อง|incorrect|invalid|ผิด/i, { timeout: 15000 });
  });

  test("a successful login leaves the login page", async ({ page }) => {
    await login(page, "staff");
    expect(new URL(page.url()).pathname).not.toBe("/login");
  });

  test("a user who already uploaded a signature is not asked for it again", async ({ page }) => {
    // POST /staff/me/signature uploads to R2 and returns a URL but never writes
    // staff.signature_image (Staff.helper.js:379 is still a TODO(mock)), so /auth/me keeps
    // reporting null and login/page.tsx:31 re-opens the modal on every single sign-in. Note
    // this test does NOT use the login() helper — the helper dismisses the modal on purpose so
    // the rest of the suite can reach the app.
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(accounts.staff.email);
    await page.locator('input[type="password"]').first().fill(accounts.staff.password);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST"),
      page.locator('button[type="submit"]').first().click(),
    ]);
    await page.waitForTimeout(4000);
    await expect(page.getByRole("button", { name: /ไว้ทีหลัง|later|skip/i })).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/");
  });
});

test.describe("session persistence", () => {
  test("the session survives a page reload", async ({ page }) => {
    await login(page, "staff");
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).not.toBe("/login");
  });

  test("the refresh cookie is actually sent to the API by a real browser", async ({ page, context }) => {
    // The decisive cross-site check. The cookie is issued by *.up.railway.app while the page
    // is served from *.workers.dev, so a SameSite=Strict/Lax cookie is stored but never
    // attached to the refresh call — the session then dies at the 900s access-token TTL with
    // no way to renew it.
    await login(page, "staff");
    const cookies = await context.cookies();
    const refresh = cookies.find((c) => c.name === "refresh_token");
    expect(refresh, "refresh_token cookie was not stored by the browser at all").toBeDefined();
    expect(refresh!.sameSite).toBe("None");

    const status = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/v1/auth/refresh`, { method: "POST", credentials: "include" });
      return res.status;
    }, API_URL);
    expect(status).toBe(200);
  });
});

test.describe("unauthenticated visitors", () => {
  const guarded = ["/", "/reimburse", "/checkslip", "/project"];

  for (const path of guarded) {
    test(`${path} sends an unauthenticated visitor to the login page`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/login/);
      await expectNoUnauthorizedLeak(page);
    });
  }
});
