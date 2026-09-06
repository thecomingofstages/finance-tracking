import { test, expect } from "@playwright/test";
import { login, navigateInApp, expectNoUnauthorizedLeak, API_URL } from "./helpers";

test.describe("landing page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "head");
  });

  test("lands on the dashboard, not back on the login page", async ({ page }) => {
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("renders without a client-side exception", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test("shows total income and total expense", async ({ page }) => {
    // Dev plan "/": "แสดงรายได้รวม + รายจ่ายรวมของทุก Project รวมกัน".
    await expect(page.locator("body")).toContainText(/รายรับรวม|รายได้รวม/);
    await expect(page.locator("body")).toContainText(/รายจ่ายรวม/);
  });

  test("money is rendered as formatted baht, never NaN or undefined", async ({ page }) => {
    // The stat tiles render from hardcoded defaults first and fill in once the summary call
    // resolves, so wait for a real figure rather than sampling mid-flight.
    await expect(page.locator("body")).toContainText(/฿[\d,]+\.\d{2}/, { timeout: 15000 });
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("NaN");
    expect(body).not.toContain("undefined");
    expect(body).not.toContain("Invalid Date");
  });

  test("the pending-requests tile agrees with the list underneath it", async ({ page }) => {
    // The tile is bound to summary.pending_count, which aliases pending_slips.count (unchecked
    // payment slips). The list beside it counts outstanding_reimbursements. Two different
    // numbers under one heading — "รายการรออนุมัติ/รอโอน" reads as reimbursements, so a user
    // sees "0 รายการ" directly above "รอตรวจ 5 รายการ".
    await expect(page.locator("body")).toContainText(/PENDING REQUESTS/i, { timeout: 15000 });
    await expect(page.locator("body")).toContainText(/รอตรวจ/, { timeout: 15000 });
    const body = await page.locator("body").innerText();
    const tile = body.match(/PENDING REQUESTS\s*([\d,]+)/i);
    const list = body.match(/รอตรวจ\s*([\d,]+)\s*รายการ/);
    test.skip(!tile || !list, "dashboard did not render both counters");
    expect(tile![1].replace(/,/g, "")).toBe(list![1].replace(/,/g, ""));
  });

  test("offers a route through to a project detail page", async ({ page }) => {
    expect(await navigateInApp(page, "/project")).toBe(true);
  });

  test("offers the reimbursement entry point", async ({ page }) => {
    expect(await navigateInApp(page, "/reimburse")).toBe(true);
  });

  test("greets the signed-in user by name", async ({ page }) => {
    await expect(page.locator("body")).toContainText(/chompoo/i);
  });
});

test.describe("role gating", () => {
  test("finance is shown the checkslip entry point", async ({ page }) => {
    await login(page, "head");
    await expect(page.locator('a[href^="/checkslip"]').first()).toBeVisible();
  });

  test("a plain staff member is not shown the checkslip entry point", async ({ page }) => {
    // Dev plan: a button restricted to a role is HIDDEN, never shown-and-refused, and the UI
    // must not explain who may use it.
    await login(page, "staff");
    await expect(page.locator('a[href^="/checkslip"]')).toHaveCount(0);
    await expectNoUnauthorizedLeak(page);
  });

  test("a plain staff member is not offered project creation", async ({ page }) => {
    await login(page, "staff");
    await expect(page.getByRole("button", { name: /เพิ่ม ?project|สร้างโปรเจกต์|new project|create project/i })).toHaveCount(0);
  });

  test("a plain staff member reaching /checkslip directly is redirected, not refused", async ({ page }) => {
    await login(page, "staff");
    await page.evaluate(() => history.pushState({}, "", "/checkslip"));
    await page.goto("/checkslip");
    await page.waitForLoadState("networkidle");
    expect(new URL(page.url()).pathname).not.toBe("/checkslip");
    await expectNoUnauthorizedLeak(page);
  });

  test("an admin without any department membership still gets a usable dashboard", async ({ page }) => {
    // requireScope("isMember"/"isManager") has no isGlobal bypass, so a freshly provisioned
    // administrator is refused the project, staff and checkslip reads the dev plan grants them
    // ("role=Admin ต้องเห็นทุกปุ่ม"). Whatever the UI shows them must at least not be broken.
    const failures: string[] = [];
    page.on("response", (r) => {
      if (r.url().startsWith(API_URL) && r.status() === 403) failures.push(r.url().replace(/.*\/v1/, ""));
    });
    await login(page, "admin");
    await page.waitForTimeout(2000);
    expect(failures).toEqual([]);
  });
});
