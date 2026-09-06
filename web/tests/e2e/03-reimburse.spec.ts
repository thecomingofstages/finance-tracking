import { test, expect } from "@playwright/test";
import { login, navigateInApp, expectNoUnauthorizedLeak } from "./helpers";

/** Navigation is always in-app: a page.goto() would drop the in-memory session (see helpers). */
async function openReimburse(page: import("@playwright/test").Page) {
  await login(page, "staff");
  const ok = await navigateInApp(page, "/reimburse");
  expect(ok, "no /reimburse link offered on the dashboard").toBe(true);
  await page.waitForURL(/\/reimburse/, { timeout: 15000 });
}

test.describe("/reimburse — the request form", () => {
  test.beforeEach(async ({ page }) => {
    await openReimburse(page);
  });

  test("reaches the reimbursement area", async ({ page }) => {
    expect(new URL(page.url()).pathname).toMatch(/^\/reimburse/);
  });

  test("offers a way to start a new request", async ({ page }) => {
    await expect(page.getByRole("button", { name: "ขอเบิกเงินใหม่" })).toBeVisible();
  });

  test("renders no NaN or undefined", async ({ page }) => {
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("NaN");
    expect(body).not.toContain("undefined");
    expect(body).not.toContain("Invalid Date");
  });

  test("shows the caller's own requests", async ({ page }) => {
    // Dev plan "/": "รายการการเบิกเงินของคุณ".
    await expect(page.locator("body")).toContainText(/เบิกเงิน/);
  });
});

test.describe("the request form itself", () => {
  test.beforeEach(async ({ page }) => {
    await openReimburse(page);
    const start = page.getByRole("button", { name: "ขอเบิกเงินใหม่" }).first();
    if (await start.count()) {
      await start.click();
      await page.waitForLoadState("networkidle");
    }
  });

  test("offers a department dropdown", async ({ page }) => {
    // Dev plan /reimburse: "Staff ระบุว่าจะเบิกเงินในส่วนของฝ่ายไหน (และ Tag ไหน) — Dropdown".
    await expect(page.locator("select, [role=combobox]").first()).toBeVisible();
  });

  test("offers a purpose field", async ({ page }) => {
    await expect(page.getByText(/วัตถุประสงค์|purpose/i).first()).toBeVisible();
  });

  test("can add more than one line item", async ({ page }) => {
    // "ไม่จำกัดจำนวน" — an unlimited number of lines, so an add control must exist.
    const add = page.getByRole("button", { name: /เพิ่มรายการ|add item|add line/i }).first();
    await expect(add).toBeVisible();
    const before = await page.locator('input[type="number"], input[inputmode="numeric"], input[inputmode="decimal"]').count();
    await add.click();
    await expect
      .poll(async () =>
        page.locator('input[type="number"], input[inputmode="numeric"], input[inputmode="decimal"]').count())
      .toBeGreaterThan(before);
  });

  test("offers a receipt upload control restricted to pdf, jpg and png", async ({ page }) => {
    const file = page.locator('input[type="file"]').first();
    await expect(file).toBeAttached();
    const accept = (await file.getAttribute("accept")) || "";
    expect(accept.toLowerCase()).toMatch(/pdf/);
    expect(accept.toLowerCase()).toMatch(/jpe?g|image/);
    expect(accept.toLowerCase()).toMatch(/png|image/);
  });

  test("offers a payout method — a bank account or cash", async ({ page }) => {
    await expect(page.getByText(/บัญชี|เงินสด|bank|cash/i).first()).toBeVisible();
  });

  test("does not leak an authorization error into the page", async ({ page }) => {
    await expectNoUnauthorizedLeak(page);
  });
});
