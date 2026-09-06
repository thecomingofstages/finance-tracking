# End-to-end test report — deployed stack

**Date:** 2026-09-02
**Branch:** `kkattmos/end-to-end`
**Scope:** the features in *IT - 12 / Development Plan*, tested against the live deployment.

| Tier | Target | State |
|---|---|---|
| Frontend | `https://finance-tracking-web.thecomingofstages.workers.dev` (Cloudflare Workers) | up |
| Backend | `https://finance-tracking-production-83ff.up.railway.app` (**Railway**, not Render) | up, `mockMode: false` |
| Database | `https://gdvmhtvawpqmgexajzwx.supabase.co` (Supabase Cloud) | real data, seed rows present |
| Object storage | Cloudflare R2 (`finance-receipts`, `finance-signatures`) | working |

## Results

| Suite | Command | Total | Passed | Failed |
|---|---|---:|---:|---:|
| API (`api/tests/e2e/`) | `cd api && npm run test:e2e` | 141 | 121 | **20** |
| Browser (`web/tests/e2e/`) | `cd web && npm run test:e2e` | 46 | 40 | **6** |

Every failure below is a real defect. The suites assert the behaviour the development plan
specifies, so a red test is a gap between the plan and the deployment, not a broken test.

**Excluded by instruction** (requirements not settled): `/reports/journal`,
`/reports/journal/export`, `/reports/ledger`, and the print-overall-income/expense feature.

**Not covered, and why:**

- **Payment ingestion (#37)** — needs `SERVICE_TOKEN_ENROLL` / `SERVICE_TOKEN_MERCH`, which
  were not issued for this run. The checkslip queue, its ordering, its authorization boundary
  and the rejection of forged service tokens *are* covered; creating new payments and the
  bulk-approve happy path are not.
- **Google sign-in** — needs an interactive Google consent screen. The email+password and
  `ACCOUNT_NOT_CLAIMED` paths are covered; the Supabase handshake is covered only at its
  failure boundary.
- **Password reset completion** — no access to the test mailbox. The suite asserts the
  request endpoint's contract and the rejection of forged tokens.

---

## Blockers

### B1 — Every amount on screen is 100× too large, and the printed document disagrees

**Severity: critical.** This is a finance system; the screen and the document a member of staff
signs must show the same number.

The whole system stores money as **integer satang** — the development plan says so
("All money amounts are in Thai Satang; stores in int4"), and so does the first line of
`api/src/app/utils/Money.util.js`.

- `api/src/app/utils/PDF.util.js:53` — `formatBaht(satang)` divides by 100. Correct.
- `web/src/lib/format.ts:21` — `formatCurrencyTH` prefixes the raw integer with `฿` and
  **never divides**.

Observed on reimbursement `01a05fde-f858-7e0b-9df0-c6e5395ded7f`, stored line amount `123456`:

| Surface | Renders |
|---|---|
| Web UI | `฿123,456.00` |
| Printed ใบเบิกเงิน | `฿1,234.56` |

The input path has the mirror-image bug: a user typing `1500` meaning ฿1,500 stores `1500`
satang = ฿15. Because input and display are wrong by the same factor, the UI looks
self-consistent — which is what makes this dangerous. It only surfaces when someone prints.

**Source of error:** no single conversion boundary. The API's contract is satang; the frontend
implicitly assumes baht on both read and write.

**Suggested fix:** make `web/src/lib/format.ts` the conversion boundary — `formatCurrencyTH`
divides by 100, and add a `bahtToSatang` for form submission, used by the reimbursement form
and every budget input. Then verify one record end-to-end against its printed document.
Decide explicitly whether existing rows are satang or baht before converting anything: the
seeded values (`allocated_budget: 500000` for a ฿500,000 project) look like they were entered
as **baht**, so a data migration may be needed alongside the code fix.

*Tests:* `web/tests/e2e/05-money.spec.ts`

### B2 — A newly created project can never be used by anyone

**Severity: critical.** The "create project" button produces a permanently dead object.

`POST /projects` succeeds (201). Every subsequent operation on that project returns 403 —
including for the account that just created it, which holds `role=admin` *and* `is_finance` on
other projects:

```
201  POST /projects                      -> 01a05fd8-820b-73f7-938b-e92044db35dd
403  GET  /projects/{id}
403  GET  /projects/{id}/departments
403  GET  /projects/{id}/tags
403  GET  /projects/{id}/staff
403  POST /projects/{id}/departments
403  POST /projects/{id}/tags
```

**Source of error — two faults compounding:**

1. `api/src/app/middleware/Auth.middleware.js:101-104`. Four predicates are missing the
   `scope.isGlobal ||` bypass that every one of their siblings has:

   ```js
   isHead:    (scope, targetId) => scopeIncludes(scope.headOf, targetId),
   isFinance: (scope, targetId) => scopeIncludes(scope.financeOf, targetId),
   isManager: (scope, targetId) => scopeIncludes(scope.managerOf, targetId),
   isMember:  (scope, targetId) => …,
   // vs.
   isFinanceOrAdmin: (scope, targetId) => scope.isGlobal || scopeIncludes(scope.financeOf, targetId),
   ```

   A brand-new project has no `staff_dept` rows by definition, so `isMember`/`isManager`/
   `isFinance` are false for everybody, forever.

2. **`staff_dept` has no API at all.** `is_head`, `is_finance` and `is_manager` are only
   readable (`GET /projects/{id}/staff`), never writable. The development plan assumed this
   ("For staff_dept relation, I will manually input these info directly in supabase") — but
   that means that after delivery, the owner cannot appoint a department head or a project
   finance without someone hand-editing Postgres.

The same root cause makes `role=admin` a second-class citizen, directly against the plan's
**"role=Admin ต้องเห็นทุกปุ่ม"**. A fresh admin account gets 403 on `/staff`,
`/projects/{id}` and its sub-resources, `/projects/{id}/sources`, and `/payments`.

**Suggested fix:** add `scope.isGlobal ||` to all four predicates, then add the missing
`staff_dept` endpoints — at minimum `POST/PATCH/DELETE /projects/{id}/staff` (manager or
global), so a project can be bootstrapped through the product rather than through the
database. Consider also giving the project creator a `staff_dept` row with `is_manager` and
`is_finance` inside the same transaction as `POST /projects`.

*Tests:* `api/tests/e2e/03-project.e2e.test.js`

### B3 — The session does not survive a page reload

**Severity: critical.** Any refresh, bookmark, or pasted URL logs the user out.

The browser stores **no cookie and nothing in localStorage/sessionStorage** after a successful
login — the access token lives only in memory. Recovery would normally come from the refresh
cookie, but that cookie is never stored either:

```
set-cookie: refresh_token=…; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Strict
```

`*.workers.dev` and `*.up.railway.app` are different registrable domains, so every call the
browser makes to the API is **cross-site**. Chrome will not store a `SameSite=Strict` cookie
set from a cross-site XHR, and would never attach it to the refresh call even if it did.
`POST /auth/refresh` therefore can never see it, and the session ends at the 900s access-token
TTL with no way to renew.

This works locally (`localhost:3000` → `localhost:4000` is same-site), which is why it was
never caught.

**Source of error:** the cookie's `SameSite` attribute where the session cookie is issued
(`api/src/app/helpers/Auth.helper.js` / the login controller's `res.cookie` options).

**Suggested fix:** issue the refresh cookie as `SameSite=None; Secure; HttpOnly`. Better still,
put both tiers under one registrable domain (e.g. `app.thecomingofstages.com` and
`api.thecomingofstages.com`) so the cookie can stay `SameSite=Lax` — Safari and Brave treat
`SameSite=None` third-party cookies increasingly harshly, so the custom-domain route is the
durable answer. Note `Access-Control-Allow-Credentials: true` and the CORS origin are already
correct; the cookie attribute is the only blocker.

*Tests:* `api/tests/e2e/00-deployment.e2e.test.js`, `web/tests/e2e/01-login.spec.ts`

### B4 — The digital signature is never saved, so the signature modal blocks every login

**Severity: critical.** No user can reach the dashboard by the intended path.

`POST /staff/me/signature` returns 200 with a working R2 URL — and never writes the row:

```js
// api/src/app/helpers/Staff.helper.js:375-382
static async uploadSignature(staffId, file) {
  const key = R2.buildKey("signatures", staffId, "png");
  await R2.upload("signatures", key, file.buffer, file.mimetype);
  // TODO(mock): $set staff.signature_image = key on the real Staff row.
  return { signature_image: await R2.presignedUrl("signatures", key) };
}
```

`GET /auth/me` keeps reporting `signature_image: null`. `web/src/app/login/page.tsx:31` gates
on `if (!user.signature_image)`, so the upload modal re-opens on **every** sign-in and the app
never routes onward. The only way through is the "ไว้ทีหลัง" (Later) button.

This is the last remaining `TODO(mock)` in the codebase — a check confirmed there are no
others — but it shipped to an instance running `mockMode: false`.

**Suggested fix:** persist `signature_image` (store the R2 **key**, not the presigned URL —
presigned URLs expire) inside the same transaction, and return a freshly presigned URL to the
caller. Add a regression test that `GET /auth/me` reports a non-null `signature_image` after
upload.

*Tests:* `api/tests/e2e/02-staff.e2e.test.js`, `web/tests/e2e/01-login.spec.ts`

### B5 — Password reset hangs forever, and leaks which email addresses are registered

**Severity: high.** The feature does not work, and the failure mode is a security issue.

| Request | Response |
|---|---|
| `POST /auth/password/forgot` with an address that does **not** exist | `200` in **0.5s** |
| `POST /auth/password/forgot` with an address that **does** exist | **never returns** (>45s) |

```js
// api/src/app/helpers/Auth.helper.js:133-139
if (Email.configured) {
  await Email.sendMail({ … });   // no timeout, inline in the request path
}
```

SMTP is configured on Railway but the connection never completes, and nodemailer is created
with no `connectionTimeout`/`greetingTimeout`/`socketTimeout`
(`api/src/app/utils/Email.util.js:21-28`), so the HTTP request hangs until something upstream
kills it.

Two consequences. First, nobody can reset a password. Second, `swagger.yaml` promises
"Always 200 regardless of whether the email exists" precisely to prevent account enumeration —
and the 0.5s-vs-hang difference is a perfectly usable enumeration oracle that defeats it.

**Suggested fix:** stop awaiting the send in the request path — dispatch it and
`.catch(err => logger.error(…))`, returning the generic 200 immediately. Independently, set
`connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000` on the transport, and
run `api/scripts/check-email.js` against the deployed environment to find out why SMTP is
unreachable (Railway blocks outbound SMTP ports on some plans — an HTTP-API provider such as
Resend or SendGrid avoids the problem entirely).

*Tests:* `api/tests/e2e/01-auth.e2e.test.js`

### B6 — PDF generation returns 500 on Railway

**Severity: high.** ใบเบิกเงิน and ใบสำคัญจ่าย cannot be printed — a core objective of the
project ("ช่วยทำเอกสารที่เกี่ยวข้อง").

`format=html` renders correctly. `format=pdf` returns
`{"code":"INTERNAL_ERROR","message":"Unexpected server error."}` for both document types.

**Source of error:** `api/src/app/utils/PDF.util.js:160` —
`puppeteer.launch({ headless: true })` with no `args` and no `executablePath`. The repository
has **no Dockerfile and no nixpacks config**, so Railway builds with auto-detected Nixpacks,
which installs Node but none of Chromium's shared libraries, and runs as a user for whom
Chrome's sandbox is unavailable. Contributing factor: `page.setContent(html, { waitUntil:
"networkidle0" })` at line 177, while the templates load their logo from
`lh3.googleusercontent.com` — an external fetch the render blocks on.

**Suggested fix:** add a `Dockerfile` for `api/` based on a Puppeteer-ready image (or install
`chromium` plus its deps and set `PUPPETEER_EXECUTABLE_PATH`), and launch with
`args: ["--no-sandbox", "--disable-dev-shm-usage"]`. Inline the logo as a `data:` URI so the
render never waits on the network, and set an explicit navigation timeout. Verify with
`GET /reimbursements/{id}/document?type=request&format=pdf` returning `%PDF-` and >5 KB.

*Tests:* `api/tests/e2e/07-documents.e2e.test.js`

---

## High

### H1 — The verification QR code does not exist on any reachable document

The development plan requires "At the bottom right, there should be QR code leading to
`https://<BASE_URL>/reimburse/<id>` for verification". `QR.util.js` exists and works, but it is
only referenced from the **PDF footer template** (`PDF.util.js:186-189`). The `format=html`
output contains no QR at all, and `format=pdf` is 500 (B6) — so in the deployed system the QR
is unreachable by either route.

**Fix:** move the QR into the shared body builders (`buildRequestHtml` / `buildVoucherHtml`) so
both output formats carry it.

### H2 — File uploads accept any file type

`api/src/app/middleware/Upload.middleware.js` configures multer with a size limit and **no
`fileFilter`**. A shell script uploaded as `sig.sh` with `Content-Type: text/x-sh` was accepted
with 200 and stored in R2. The receipt route rejects bad types further downstream, but the
signature and CSV-import routes do not.

**Fix:** add a `fileFilter` per route — `image/png|image/jpeg` for signatures,
`application/pdf|image/png|image/jpeg` for receipts, `text/csv` for imports — and check magic
bytes, not just the client-supplied MIME type.

### H3 — Receipt size ceiling is 10 MB, but the plan specifies 25 MB

`Upload.middleware.js:7` sets `fileSize: 10 * 1024 * 1024`. The plan says "Max: 25 MB". A
legitimate 20 MB scanned receipt is rejected today.

**Fix:** raise to 25 MB, and confirm Railway's request body limit accommodates it.

### H4 — Swagger UI and the raw spec are publicly readable in production

`GET /api-docs` and `GET /api-docs.json` return 200 to an unauthenticated caller, enumerating
every route, payload shape and error code on the instance that will hold real finance records.

**Fix:** gate both behind `mockMode` or an env flag, or behind an admin session.

---

## Medium

| # | Finding | Source | Suggested fix |
|---|---|---|---|
| M1 | Dashboard tile "รายการรออนุมัติ/รอโอน" shows **0** directly above a list reading "รอตรวจ **5** รายการ" | The tile binds to `summary.pending_count`, which aliases `pending_slips.count` (unchecked payment slips); the label describes reimbursements, whose real count is `outstanding_reimbursements.count` | Bind the tile to `outstanding_reimbursements.count`, or relabel it as slips |
| M2 | Project list cards show "ใช้ไป ฿0.00 / 0%" for a project the same API payload reports 81,500 of expense against | `GET /projects` does return `total_expense`; the card is reading a different or unset field | Bind the card to `total_expense` from the list payload |
| M3 | A malformed UUID returns **500**, not 400 | Sequelize's cast error is not translated in the error handler | Validate `:id` as a UUID in `Validate.middleware.js` and return 400 |
| M4 | `GET /reports/cashflow?project_id=<unknown>` returns **200** with empty data | No existence check before the aggregate query | Return 404 when the project does not exist, so the UI can tell "empty" from "wrong id" |
| M5 | A plain staff member sees a tab "รายการที่ต้องตรวจสอบ 7" for items they cannot action | Frontend filters by status rather than by whether the caller holds an approval flag. The API's scoping is correct — this is a labelling problem, not a data leak | Derive the tab from the caller's `scope.headOf` / `financeOf`, and hide it when both are empty |
| M6 | Presigned receipt URLs expire after 300s | `R2.presignedUrl` default | Raise to ~15 min, or re-sign on demand, so a page left open does not show a broken receipt |
| M7 | `web/.env.example` still documents the retired Render URL (`finance-tracking-r0hw.onrender.com`) | Stale after the move to Railway | Update to the Railway URL |
| M8 | The voucher's หัก ณ ที่จ่าย (withholding tax) is always 0 | Nothing in the schema models a tax rate — a known gap, documented in `PDF.util.js` | Out of scope until Finance specifies the rule; keep it visible as a gap |

---

## What works

Worth stating plainly, because most of the system does:

- **The whole reimbursement lifecycle.** 34 tests, including the complete chain
  `waiting → head_approve → fin_approve → transfer`, the head auto-verify shortcut, the
  rejection path and the re-edit that follows it, and every illegal transition refused with
  422. The `fin_approve → transfer` rollup into `department`/`project`/`tag` totals is
  correct — verified by watching a project's `total_expense` move by exactly the transferred
  amount.
- **Authorization on the reimbursement routes.** Step-up reauth is demanded on every status
  call, `tracking_id` is required for `head_approve → fin_approve`, `reason` for any rejection,
  and the owner-only `transfer` edge holds against a finance caller.
- **Funding sources.** `spon`/`other` mirror `expect_amount` into `actual_amount` immediately;
  `enroll`/`merch` require a `reference_id`; `actual_amount`, `type`, `reference_id` and
  `project_id` are all correctly refused as client writes.
- **Receipts and R2.** Upload, storage and retrieval all work; the object comes back 200.
- **Reports.** `/reports/summary`, `/cashflow`, `/top-expenses` and `/sponsors` return correct,
  correctly ordered, correctly role-gated data. `net_income` genuinely equals
  `total_income - total_expense`.
- **Admin staff provisioning**, duplicate-email conflicts, the unclaimed-account boundary,
  bank-account CRUD with ownership checks, and the refusal of role self-assignment.
- **CORS, HSTS, `nosniff`, `X-Frame-Options`**, and the frontend correctly built against the
  Railway API (the build-time `NEXT_PUBLIC_API_URL` inlining is right).
- **The UI itself**, once reachable: Thai throughout, Prompt font, Buddhist-era dates, formatted
  baht, no `NaN`/`undefined`/`Invalid Date` anywhere, no horizontal scroll at 375 px, and
  role-gated controls correctly **hidden** rather than shown-and-refused.

---

## Running the suites

```bash
cd api && npm run test:e2e     # 141 tests against the deployed API
cd web && npm run test:e2e     # 46 browser tests against the deployed Worker
```

Both default to the current deployment; override with `E2E_API_URL`, `E2E_WEB_URL`,
`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`.

**Accounts used** (seeded, already in the target database):

| Account | Role | Why it is needed |
|---|---|---|
| `admin@example.com` | `admin`, **no** `staff_dept` rows | the freshly-provisioned-administrator case |
| `chompoo@tcos.app` | `admin`, `is_head` + `is_finance` on dept `2000…0001` | requester (auto-verify) and finance approver |
| `mark@tcos.app` | `staff`, member of dept `2000…0002` | ordinary requester, negative authorization cases |
| `beam@tcos.app` | `owner` | the only role that may mark a reimbursement transferred |

## Cleanup

Everything these suites write is named `E2E-<runId> …` or uses an `@example.invalid` email, and
nothing pre-existing was modified or deleted. `scripts/e2e-cleanup.sql` soft-deletes those rows
and **recomputes** the affected `total_expense` aggregates (the `transfer` rollup is done in
application code, so soft-deleting a reimbursement does not reverse it).

The script opens a transaction, prints what it is about to remove, and ends in `ROLLBACK` —
inspect the output, then change the last line to `COMMIT`. R2 objects are left in place;
they are orphaned once the rows are gone.

---

## Fix prompt

Paste into Claude Code on a fresh branch off `kkattmos/end-to-end`. Work the blockers in
order — B2 and B3 gate the ability to verify anything else by hand.

````text
Read docs/e2e-report.md first. It is the output of a full end-to-end run against the deployed
stack (Cloudflare Workers frontend, Railway backend, Supabase Cloud database) and every claim
in it is backed by a failing test in api/tests/e2e/ or web/tests/e2e/.

Fix the six blockers, in this order. After each one, re-run the specific failing test named in
the report and confirm it goes green without weakening the assertion. Do not change a test to
match the current behaviour — the tests encode the development plan.

B1 — money is rendered 100x too large and the screen disagrees with the printed document.
  The system stores integer satang (api/src/app/utils/Money.util.js line 1). PDF.util.js
  divides by 100; web/src/lib/format.ts does not. Make web/src/lib/format.ts the single
  conversion boundary: formatCurrencyTH divides by 100, and add a bahtToSatang used by every
  form that submits an amount (the reimbursement form, budget inputs). Before changing
  anything, work out whether the rows already in Supabase are satang or baht — the seeded
  values look like they were entered as baht — and say what you find. If a data migration is
  needed, write it as a reviewable SQL script, do not run it.
  Test: cd web && npx playwright test tests/e2e/05-money.spec.ts

B2 — a newly created project is permanently unusable; role=admin is refused most reads.
  In api/src/app/middleware/Auth.middleware.js the FLAG_CHECKS predicates isHead, isFinance,
  isManager and isMember are missing the `scope.isGlobal ||` bypass that every sibling
  predicate has. Add it. Then add the missing staff_dept management endpoints — there is
  currently no way to appoint a department head or project finance except by hand-editing
  Postgres, which is not acceptable for a system about to be handed to its owner. At minimum
  POST/PATCH/DELETE on /projects/{id}/staff, gated on isManager-or-global. Also give the
  creator of a project a staff_dept row with is_manager and is_finance in the same transaction
  as POST /projects. Update api/swagger.yaml first, then the backend doc, then run
  `npm run gen:client` in api/.
  Test: cd api && npx jest --config jest.e2e.config.js tests/e2e/03-project.e2e.test.js

B3 — the session does not survive a page reload.
  The refresh cookie is issued SameSite=Strict, but the Worker frontend and the Railway API are
  different registrable domains, so the browser never stores or sends it. Issue it as
  SameSite=None; Secure; HttpOnly. Then say clearly in your summary that the durable fix is to
  put both tiers under one registrable domain (app./api. of the same custom domain) so the
  cookie can stay SameSite=Lax, because Safari and Brave restrict third-party cookies.
  Test: cd api && npx jest --config jest.e2e.config.js tests/e2e/00-deployment.e2e.test.js
        cd web && npx playwright test tests/e2e/01-login.spec.ts

B4 — the digital signature is never persisted, so the signature modal blocks every login.
  api/src/app/helpers/Staff.helper.js:379 is still a TODO(mock) on an instance running
  mockMode=false. Persist signature_image on the staff row inside the same transaction. Store
  the R2 KEY, not the presigned URL — presigned URLs expire. Return a freshly presigned URL to
  the caller.
  Test: cd api && npx jest --config jest.e2e.config.js tests/e2e/02-staff.e2e.test.js

B5 — POST /auth/password/forgot hangs forever for an address that exists, and that timing
  difference is an account-enumeration oracle that defeats the endpoint's stated design.
  In api/src/app/helpers/Auth.helper.js stop awaiting Email.sendMail in the request path —
  dispatch it and .catch(err => logger.error(...)), returning the generic 200 immediately. In
  api/src/app/utils/Email.util.js set connectionTimeout, greetingTimeout and socketTimeout on
  the transport. Then run api/scripts/check-email.js against the deployed environment and
  report why SMTP is unreachable; Railway blocks outbound SMTP ports on some plans, in which
  case recommend an HTTP-API provider instead of debugging the socket.
  Test: cd api && npx jest --config jest.e2e.config.js tests/e2e/01-auth.e2e.test.js

B6 — PDF rendering returns 500 on Railway (HTML renders fine).
  api/src/app/utils/PDF.util.js:160 calls puppeteer.launch({headless:true}) with no args and no
  executablePath, and the repo has no Dockerfile or nixpacks config, so Railway's auto-detected
  Node image has no Chromium and no usable sandbox. Add a Dockerfile for api/ based on a
  Puppeteer-ready image (or install chromium and set PUPPETEER_EXECUTABLE_PATH), and launch
  with args ["--no-sandbox", "--disable-dev-shm-usage"]. Separately, the templates load their
  logo from lh3.googleusercontent.com while setContent waits for networkidle0 — inline the logo
  as a data: URI and set an explicit navigation timeout.
  While you are in this file, fix H1: the verification QR is only in the PDF footerTemplate
  (lines 186-189), so format=html has no QR at all. Move it into buildRequestHtml and
  buildVoucherHtml so both formats carry it. The plan requires a QR to
  https://<BASE_URL>/reimburse/<id>.
  Test: cd api && npx jest --config jest.e2e.config.js tests/e2e/07-documents.e2e.test.js

Then the High findings: H2 (multer has no fileFilter on any route — a shell script was accepted
as a signature and stored in R2), H3 (receipt ceiling is 10 MB, the plan says 25 MB), H4
(/api-docs and /api-docs.json are publicly readable in production).

Constraints:
- api/swagger.yaml is the running contract. Change it first, then docs/backend/03-api-spec.md,
  then docs/frontend/api-reference.md, then run `npm run gen:client` in api/. Never hand-edit
  web/src/lib/api/types.gen.ts.
- All money math goes through api/src/app/utils/Money.util.js; all frontend money and date
  formatting goes through web/src/lib/format.ts. Do not reintroduce per-component formatters.
- Do not add parallel router.push("/") calls in LoginForm.onSuccess or
  ClaimAccountForm.onSuccess — post-login routing is owned by web/src/app/login/page.tsx alone.
- The target Supabase project is shared and becomes production on delivery. Do not run
  destructive SQL against it; write migrations and cleanup as reviewable scripts.
- Update the matching bullet in AGENTS.md for anything you change that is documented there.
````
