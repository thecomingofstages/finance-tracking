import { test, expect } from "@playwright/test";
import { login, navigateInApp, expectNoUnauthorizedLeak } from "./helpers";

/** The sidebar link lands on the project LIST; the detail page is one click further in. */
async function openProject(page: import("@playwright/test").Page, who: "head" | "staff") {
  await login(page, who);
  const ok = await navigateInApp(page, "/project");
  expect(ok, "no /project link offered on the dashboard").toBe(true);
  await page.waitForURL(/\/project/, { timeout: 15000 });
  const detail = page.locator('a[href^="/project/"]').first();
  await expect(detail).toBeVisible({ timeout: 15000 });
  await detail.click();
  await page.waitForURL(/\/project\/[0-9a-f-]{36}/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

test.describe("/project/<id>", () => {
  test("a member reaches a project detail page", async ({ page }) => {
    await openProject(page, "head");
    expect(new URL(page.url()).pathname).toMatch(/^\/project\/[0-9a-f-]{36}$/);
  });

  test("the project card's spent figure matches the project's real expense", async ({ page }) => {
    // GET /projects returns total_expense per project; the list card renders "ใช้ไป ฿0.00" for
    // a project the same payload reports 81,500 satang of expense against.
    await login(page, "head");
    await navigateInApp(page, "/project");
    await page.waitForURL(/\/project/, { timeout: 15000 });
    // The cards render from an async GET /projects, so wait for a real figure before sampling
    // innerText — otherwise this reads the placeholder state and reports a defect that isn't.
    await expect(page.locator("body")).toContainText(/ใช้ไป\s*฿[\d,]+\.\d{2}/, { timeout: 15000 });
    const body = await page.locator("body").innerText();
    const spent = [...body.matchAll(/ใช้ไป\s*฿([\d,]+\.\d{2})/g)].map((m) => m[1].replace(/,/g, ""));
    expect(spent.length).toBeGreaterThan(0);
    // At least one project in this database has a non-zero expense, so an all-zero column
    // means the card is bound to a field the list payload never fills in.
    expect(spent.some((v) => Number(v) > 0)).toBe(true);
  });

  test("shows the project's income and expense", async ({ page }) => {
    await openProject(page, "head");
    await expect(page.locator("body")).toContainText(/รายรับ|รายได้/);
    await expect(page.locator("body")).toContainText(/รายจ่าย/);
  });

  test("shows funding sources", async ({ page }) => {
    // Dev plan /project/<project_id>, Staff: "ดูแหล่งเงินได้ทั้งหมด แยกตาม Category".
    await openProject(page, "head");
    await expect(page.locator("body")).toContainText(/แหล่งเงินได้|สปอนเซอร์|source|sponsor/i);
  });

  test("shows departments and tags", async ({ page }) => {
    await openProject(page, "head");
    await expect(page.locator("body")).toContainText(/ฝ่าย/);
    await expect(page.locator("body")).toContainText(/tag|แท็ก/i);
  });

  test("renders no NaN or undefined in its figures", async ({ page }) => {
    await openProject(page, "head");
    await expect(page.locator("body")).toContainText(/฿[\d,]+/, { timeout: 15000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("NaN");
    expect(body).not.toContain("undefined");
  });

  test("a plain staff member is not offered source management", async ({ page }) => {
    await openProject(page, "staff");
    await expect(page.getByRole("button", { name: /เพิ่มแหล่งเงินได้|add source/i })).toHaveCount(0);
    await expectNoUnauthorizedLeak(page);
  });
});

test.describe("responsive layout", () => {
  test("the dashboard does not scroll sideways on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page, "head");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
