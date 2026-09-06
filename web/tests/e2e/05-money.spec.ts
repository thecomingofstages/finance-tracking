import { test, expect } from "@playwright/test";
import { login, navigateInApp, API_URL, accounts } from "./helpers";

/**
 * Money is stored as INTEGER satang across the whole system — dev plan, Database Design:
 * "All money amounts are in Thai Satang; stores in int4; < 21 million baht", and
 * api/src/app/utils/Money.util.js says the same in its first line.
 *
 * These tests check that the screen and the printed document agree about what a stored integer
 * means. They are the difference between a display quirk and a finance system that prints a
 * different number than it shows.
 */

async function apiJson(path: string, token: string) {
  const res = await fetch(`${API_URL}/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function apiToken(who: keyof typeof accounts) {
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(accounts[who]),
  });
  return (await res.json()).data.access_token;
}

test("the dashboard's total expense equals the API's satang value converted to baht", async ({ page }) => {
  const token = await apiToken("head");
  const summary = (await apiJson("/reports/summary", token)).data;
  const expectedBaht = (summary.total_expense / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  await login(page, "head");
  await expect(page.locator("body")).toContainText(/฿[\d,]+\.\d{2}/, { timeout: 15000 });
  const body = await page.locator("body").innerText();
  expect(body).toContain(`฿${expectedBaht}`);
});

test("the screen and the printed form show the same amount for the same reimbursement", async ({ page }) => {
  // The single most consequential check in this suite: web/src/lib/format.ts prefixes the raw
  // integer with ฿ and never divides, while api/src/app/utils/PDF.util.js#formatBaht divides
  // by 100. The same record therefore reads 100x larger on screen than on the document a
  // member of staff signs and files.
  const token = await apiToken("head");
  const list = (await apiJson("/reimbursements?limit=50", token)).data;
  const target = list.find((r: any) => (r.purpose || "").includes("doc approved")) || list[0];
  test.skip(!target, "no reimbursement available to compare");

  const detail = (await apiJson(`/reimbursements/${target._id}`, token)).data;
  const line = (detail.details || [])[0];
  test.skip(!line, "reimbursement has no line items");

  const docRes = await fetch(`${API_URL}/v1/reimbursements/${target._id}/document?type=request&format=html`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const doc = await docRes.text();
  const asBaht = (line.amount / 100).toLocaleString("th-TH", { minimumFractionDigits: 2 });
  expect(doc, "printed document should render satang as baht").toContain(asBaht);

  await login(page, "head");
  await navigateInApp(page, "/reimburse");
  await page.waitForURL(/\/reimburse/, { timeout: 15000 });
  const screen = await page.locator("body").innerText();
  expect(screen, "the screen must not render the raw satang integer as if it were baht")
    .not.toContain(line.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 }));
});
