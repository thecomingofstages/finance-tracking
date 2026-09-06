import { Page, expect } from "@playwright/test";

export const API_URL = process.env.E2E_API_URL || "https://finance-tracking-production-83ff.up.railway.app";

export const accounts = {
  /** role=admin, is_head + is_finance on department 2000…0001 of project 1000…0001. */
  head: { email: "chompoo@tcos.app", password: "Passw0rd!2026" },
  /** role=staff, plain member of department 2000…0002. */
  staff: { email: "mark@tcos.app", password: "Passw0rd!2026" },
  /** role=owner — the only role that may mark a reimbursement transferred. */
  owner: { email: "beam@tcos.app", password: "Passw0rd!2026" },
  /** role=admin with NO staff_dept rows — a freshly provisioned administrator. */
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || "admin@example.com",
    password: process.env.E2E_ADMIN_PASSWORD || "password1234",
  },
};

/**
 * Signs in and leaves the browser on the dashboard.
 *
 * Two deployment defects are worked around here on purpose, so that the rest of the suite
 * tests the application rather than re-testing the same two failures thirty times over. Both
 * are asserted directly in 01-login.spec.ts:
 *
 *  1. The signature modal is unconditionally shown after every login, because
 *     POST /staff/me/signature never persists signature_image — so `user.signature_image` is
 *     always null and login/page.tsx:31 never releases. Dismissed via "ไว้ทีหลัง".
 *  2. The access token lives only in memory (no cookie, no storage) and the refresh cookie is
 *     never stored, so any full page load logs the user out. Navigation below therefore has to
 *     happen through in-app links, never page.goto().
 */
export async function login(page: Page, who: keyof typeof accounts) {
  const { email, password } = accounts[who];
  await page.goto("/login");
  // Selected by input type, not label: the password label is separated from its control by
  // the "ลืมรหัสผ่าน?" button, so getByLabel is not reliably associated here.
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/login") && r.request().method() === "POST"),
    page.locator('button[type="submit"]').first().click(),
  ]);
  await page.waitForLoadState("networkidle");

  // The modal is rendered by a useEffect that first has to resolve GET /auth/me, so it can
  // appear a beat after the login response settles. Wait for whichever happens first: the
  // modal, or the app deciding to route us onward by itself.
  const later = page.getByRole("button", { name: /ไว้ทีหลัง|later|skip/i });
  await Promise.race([
    later.first().waitFor({ state: "visible", timeout: 15000 }).catch(() => {}),
    page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 15000 }).catch(() => {}),
  ]);
  if (await later.count()) {
    await later.first().click();
  }
  await page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 15000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
}

/** Follows an in-app link, because a hard navigation would drop the in-memory session. Returns
 *  false when the current role is not offered that destination at all. */
export async function navigateInApp(page: Page, hrefPrefix: string): Promise<boolean> {
  const link = page.locator(`a[href^="${hrefPrefix}"]`).first();
  if (!(await link.count())) return false;
  await link.click();
  await page.waitForLoadState("networkidle");
  return true;
}

/** The dev plan forbids telling a user a page exists but is off-limits: an unreachable route
 *  redirects to `/` and never renders the word "Unauthorized". */
export async function expectNoUnauthorizedLeak(page: Page) {
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("unauthorized");
  expect(body).not.toContain("403");
  expect(body).not.toContain("forbidden");
}
