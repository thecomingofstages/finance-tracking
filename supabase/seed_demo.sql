-- Demo seed for finance-tracking — dashboard-realistic fixtures layered on top of
-- `supabase/seed.sql`. Runs MANUALLY after `supabase db reset`; not auto-loaded by the
-- Supabase CLI (only `supabase/seed.sql` is). The base seed leaves its 6 staff rows
-- untouched and adds:
--
--   - 1 new project: "TCOS Workshop Series 2026" (alongside "TCOS Annual Event 2026")
--   - 4 departments: Finance / IT / Marketing / Operations (×2 on the new project)
--   - 6 new staff personas, each with a real bcrypt (cost 12) hash for Passw0rd!2026
--   - 1 bank account per new staff row
--   - staff_dept rows that exercise every (head / finance / manager) combination
--   - 4 project_tags covering all four source_types (spon / enroll / merch / other)
--   - 9 sources across the four source_types, with a mix of partial and fully-paid actual_amounts
--   - 12 payments + payment_updatestatus history covering every payment_available_status
--     (waiting, approved, rejected) and realistic timing spread over ~6 months
--   - 8 reimbursements + reimbursement_detail + reimbursement_updatestatus history
--     covering every reimbursement_available_status (waiting, head_approve, fin_approve,
--     transfer, rejected, delete) across multiple departments and tags
--
-- IMPORTANT — aggregate maintenance:
--   `docs/backend/02-database.md` §6 (and AGENTS.md §api/) confirm aggregate columns
--   (`project.total_income` / `project.total_expense` / `project_tag.total_income` /
--   `project_tag.total_expense` / `department.total_expense`) are maintained in app code,
--   not by triggers. This seed hand-computes them at the bottom so the dashboard renders
--   correct totals out of the gate. Any real write through the API after seeding will
--   overwrite these via `Payment.helper.js` / `Reimbursement.helper.js` / `Approval.helper.js`
--   — which is the intended behavior.
--
-- Test password for noon / peak / mint / way / ice / po: Passw0rd!2026
-- (Same bcrypt hash the base seed uses for chompoo / mark / golf / beam.)

SET search_path TO finance, public;

-- ----------------------------------------------------------------------------
-- Project
-- ----------------------------------------------------------------------------

INSERT INTO project (_id, name, description, allocated_budget, total_income, total_expense, created_at) VALUES
  ('10000000-0000-0000-0000-000000000002', 'TCOS Workshop Series 2026',
   'Three weekend workshops spread across the year — dashboard-realistic demo data for FE dev/testing',
   350000, 0, 0, '2026-02-15 09:00:00+07');

-- ----------------------------------------------------------------------------
-- Departments on the new project
-- ----------------------------------------------------------------------------

INSERT INTO department (_id, project_id, name, allocated_budget, total_expense, created_at) VALUES
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Finance',     70000,  0, '2026-02-15 09:05:00+07'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'IT',          60000,  0, '2026-02-15 09:05:00+07'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Marketing',  120000,  0, '2026-02-15 09:05:00+07'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'Operations',  80000,  0, '2026-02-15 09:05:00+07');

-- ----------------------------------------------------------------------------
-- Staff — 6 new personas. The 6 base seed rows (chompoo / mark / golf / fah / ploy / beam)
-- are left in place and untouched. These 6 share the same bcrypt hash so anyone can log
-- in via POST /v1/auth/login with email=<nickname>@tcos.app + Passw0rd!2026.
-- ----------------------------------------------------------------------------

INSERT INTO staff (_id, title, first_name, last_name, nickname, email, password_hash, phone, role, created_at) VALUES
  ('30000000-0000-0000-0000-000000000007', 'นางสาว', 'Noon',   'Workshop', 'noon', 'noon@tcos.app',  '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000007', 'admin',   '2026-02-20 10:00:00+07'),
  ('30000000-0000-0000-0000-000000000008', 'นาย',   'Peak',   'Workshop', 'peak', 'peak@tcos.app',  '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000008', 'staff',   '2026-02-20 10:00:00+07'),
  ('30000000-0000-0000-0000-000000000009', 'นางสาว', 'Mint',   'Finance',  'mint', 'mint@tcos.app',  '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000009', 'finance', '2026-02-20 10:00:00+07'),
  ('30000000-0000-0000-0000-00000000000a', 'นาย',   'Way',    'ItStaff',  'way',  'way@tcos.app',   '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000010', 'it',      '2026-02-20 10:00:00+07'),
  ('30000000-0000-0000-0000-00000000000b', 'นางสาว', 'Ice',    'Marketing','ice',  'ice@tcos.app',   '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000011', 'staff',   '2026-02-20 10:00:00+07'),
  ('30000000-0000-0000-0000-00000000000c', 'นาย',   'Po',     'Ops',      'po',   'po@tcos.app',    '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000012', 'staff',   '2026-02-20 10:00:00+07');

-- ----------------------------------------------------------------------------
-- Bank accounts — one per new staff row
-- ----------------------------------------------------------------------------

INSERT INTO bankaccount (_id, name, number, provider, staff_id, created_at) VALUES
  ('40000000-0000-0000-0000-000000000003', 'Noon Workshop',  '1110000001', 'kbank', '30000000-0000-0000-0000-000000000007', '2026-02-21 09:00:00+07'),
  ('40000000-0000-0000-0000-000000000004', 'Peak Workshop',  '1110000002', 'scb',   '30000000-0000-0000-0000-000000000008', '2026-02-21 09:00:00+07'),
  ('40000000-0000-0000-0000-000000000005', 'Mint Finance',   '1110000003', 'bbl',   '30000000-0000-0000-0000-000000000009', '2026-02-21 09:00:00+07'),
  ('40000000-0000-0000-0000-000000000006', 'Way ItStaff',    '1110000004', 'kbank', '30000000-0000-0000-0000-00000000000a', '2026-02-21 09:00:00+07'),
  ('40000000-0000-0000-0000-000000000007', 'Ice Marketing',  '1110000005', 'scb',   '30000000-0000-0000-0000-00000000000b', '2026-02-21 09:00:00+07'),
  ('40000000-0000-0000-0000-000000000008', 'Po Ops',         '1110000006', 'bbl',   '30000000-0000-0000-0000-00000000000c', '2026-02-21 09:00:00+07');

-- ----------------------------------------------------------------------------
-- staff_dept — exercises every (head / finance / manager) combination on the new project
-- ----------------------------------------------------------------------------

INSERT INTO staff_dept (_id, staff_id, department_id, is_head, is_finance, is_manager, created_at) VALUES
  -- Finance dept: noon = head + finance + manager (so reimbursements under Finance auto-approve path works for FE)
  ('21000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', TRUE,  TRUE,  TRUE,  '2026-02-22 09:00:00+07'),
  -- Finance dept: mint = finance only (so finance-but-not-head path is exercisable too)
  ('21000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000003', FALSE, TRUE,  FALSE, '2026-02-22 09:00:00+07'),
  -- IT dept: way = head
  ('21000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000004', TRUE,  FALSE, FALSE, '2026-02-22 09:00:00+07'),
  -- IT dept: peak = plain staff
  ('21000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000004', FALSE, FALSE, FALSE, '2026-02-22 09:00:00+07'),
  -- Marketing dept: ice = head + manager
  ('21000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000005', TRUE,  FALSE, TRUE,  '2026-02-22 09:00:00+07'),
  -- Operations dept: po = head + manager
  ('21000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000006', TRUE,  FALSE, TRUE,  '2026-02-22 09:00:00+07');

-- ----------------------------------------------------------------------------
-- Project tags on the new project — four tags, one per source_type
-- ----------------------------------------------------------------------------

INSERT INTO project_tag (_id, project_id, name, allocated_budget, total_income, total_expense, created_at) VALUES
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Ticket Sales',   100000, 0, 0, '2026-02-25 09:00:00+07'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Sponsorship',     80000, 0, 0, '2026-02-25 09:00:00+07'),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Merchandise',     40000, 0, 0, '2026-02-25 09:00:00+07'),
  ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Misc Income',     20000, 0, 0, '2026-02-25 09:00:00+07');

-- ----------------------------------------------------------------------------
-- Sources — 9 rows across all four source_types, expect_amount + actual_amount
-- pre-staged for the payment section below.
--
-- actual_amount totals (per tag) so the aggregate-update block at the bottom is easy
-- to audit:
--   Ticket Sales  (50000000-...-002): 18000 + 22000 + 12000 = 52000
--   Sponsorship   (50000000-...-003): 50000 + 0 + 15000 = 65000
--   Merchandise   (50000000-...-004):  8500 + 3000 = 11500
--   Misc Income   (50000000-...-005):  4500
-- ----------------------------------------------------------------------------

INSERT INTO source (_id, type, tag_id, project_id, expect_amount, actual_amount, name, created_at) VALUES
  ('60000000-0000-0000-0000-000000000002', 'enroll', '50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 25000, 18000, 'Workshop 1 — Early Bird Tickets',   '2026-03-01 10:00:00+07'),
  ('60000000-0000-0000-0000-000000000003', 'enroll', '50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 30000, 22000, 'Workshop 1 — Regular Tickets',     '2026-03-05 10:00:00+07'),
  ('60000000-0000-0000-0000-000000000004', 'enroll', '50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 15000, 12000, 'Workshop 2 — Early Bird Tickets',   '2026-05-01 10:00:00+07'),
  ('60000000-0000-0000-0000-000000000005', 'spon',   '50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 50000, 50000, 'Sponsor — Acme Co. (Gold)',         '2026-02-28 10:00:00+07'),
  ('60000000-0000-0000-0000-000000000006', 'spon',   '50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 20000,     0, 'Sponsor — Beta Studio (Silver)',    '2026-04-10 10:00:00+07'),
  ('60000000-0000-0000-0000-000000000007', 'spon',   '50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 15000, 15000, 'Sponsor — Gamma Lab (Workshop 2)',  '2026-05-15 10:00:00+07'),
  ('60000000-0000-0000-0000-000000000008', 'merch',  '50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 10000,  8500, 'T-shirt sales — Workshop 1',         '2026-03-20 10:00:00+07'),
  ('60000000-0000-0000-0000-000000000009', 'merch',  '50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002',  5000,  3000, 'Sticker sales — Workshop 2',         '2026-05-20 10:00:00+07'),
  ('60000000-0000-0000-0000-00000000000a', 'other',  '50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002',  5000,  4500, 'Donations box — Workshop 1',         '2026-03-22 10:00:00+07');

-- ----------------------------------------------------------------------------
-- Payments + payment_updatestatus
--   12 payments covering every payment_available_status (waiting / approved / rejected):
--     8 approved (sum matches the per-source actual_amount totals above)
--     2 waiting (no updatestatus row beyond the implicit default; status defaults to 'waiting')
--     2 rejected
-- ----------------------------------------------------------------------------

-- ---- Approved payments (8) ----
INSERT INTO payment (_id, source_id, expected_amount, created_at) VALUES
  ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 18000, '2026-03-02 11:00:00+07'),
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 22000, '2026-03-06 11:00:00+07'),
  ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000004', 12000, '2026-05-02 11:00:00+07'),
  ('70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000005', 50000, '2026-03-01 11:00:00+07'),
  ('70000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000007', 15000, '2026-05-16 11:00:00+07'),
  ('70000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000008',  8500, '2026-03-21 11:00:00+07'),
  ('70000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000009',  3000, '2026-05-21 11:00:00+07'),
  ('70000000-0000-0000-0000-00000000000a', '60000000-0000-0000-0000-00000000000a',  4500, '2026-03-23 11:00:00+07');

INSERT INTO payment_updatestatus (_id, payment_id, status, actual_amount, staff_id, created_at) VALUES
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'approved', 18000, '30000000-0000-0000-0000-000000000009', '2026-03-03 10:00:00+07'),
  ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'approved', 22000, '30000000-0000-0000-0000-000000000009', '2026-03-07 10:00:00+07'),
  ('71000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000004', 'approved', 12000, '30000000-0000-0000-0000-000000000009', '2026-05-03 10:00:00+07'),
  ('71000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000005', 'approved', 50000, '30000000-0000-0000-0000-000000000009', '2026-03-02 10:00:00+07'),
  ('71000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000007', 'approved', 15000, '30000000-0000-0000-0000-000000000009', '2026-05-17 10:00:00+07'),
  ('71000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000008', 'approved',  8500, '30000000-0000-0000-0000-000000000009', '2026-03-22 10:00:00+07'),
  ('71000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000009', 'approved',  3000, '30000000-0000-0000-0000-000000000009', '2026-05-22 10:00:00+07'),
  ('71000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-00000000000a', 'approved',  4500, '30000000-0000-0000-0000-000000000009', '2026-03-24 10:00:00+07');

-- ---- Waiting payments (2) — no updatestatus rows. Status defaults to 'waiting'. ----
INSERT INTO payment (_id, source_id, expected_amount, created_at) VALUES
  ('70000000-0000-0000-0000-00000000000b', '60000000-0000-0000-0000-000000000006', 20000, '2026-04-11 11:00:00+07'),
  ('70000000-0000-0000-0000-00000000000c', '60000000-0000-0000-0000-000000000005',  5000, '2026-07-01 11:00:00+07');

-- ---- Rejected payments (2) ----
INSERT INTO payment (_id, source_id, expected_amount, created_at) VALUES
  ('70000000-0000-0000-0000-00000000000d', '60000000-0000-0000-0000-000000000008', 1500, '2026-03-21 12:00:00+07'),
  ('70000000-0000-0000-0000-00000000000e', '60000000-0000-0000-0000-000000000009', 2000, '2026-05-21 12:00:00+07');

INSERT INTO payment_updatestatus (_id, payment_id, status, actual_amount, staff_id, created_at) VALUES
  ('71000000-0000-0000-0000-00000000000b', '70000000-0000-0000-0000-00000000000d', 'rejected', NULL, '30000000-0000-0000-0000-000000000009', '2026-03-22 14:00:00+07'),
  ('71000000-0000-0000-0000-00000000000c', '70000000-0000-0000-0000-00000000000e', 'rejected', NULL, '30000000-0000-0000-0000-000000000009', '2026-05-22 14:00:00+07');

-- ----------------------------------------------------------------------------
-- Reimbursements + reimbursement_detail + reimbursement_updatestatus
--   8 reimbursements covering every reimbursement_available_status across multiple
--   departments and tags. Timing spread across ~6 months.
--
--   Latest status targets:
--     - waiting       : RB-D-001 (peak / IT, pending head review)
--     - head_approve  : RB-D-002 (peak / IT, head approved, finance not yet)
--     - fin_approve   : RB-D-003 (ice / Marketing, finance approved, not transferred)
--     - transfer      : RB-D-004 (ice / Marketing, fully done)
--     - transfer      : RB-D-005 (po / Operations, fully done)
--     - rejected      : RB-D-006 (peak / IT, rejected by head)
--     - delete        : RB-D-007 (po / Operations, deleted)
--     - waiting       : RB-D-008 (noon / Finance, just submitted)
--
--   Status rows are inserted in time order so the
--   sync_reimbursement_latest_status trigger writes the correct latest_status.
-- ----------------------------------------------------------------------------

-- RB-D-001 — peak / IT, status: waiting (just submitted)
INSERT INTO reimbursement (_id, staff_dept_id, tag_id, purpose, tracking_id, created_at) VALUES
  ('80000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000004', 'สาย HDMI + ปลั๊กพ่วง',                 'RB-2026-D001', '2026-06-01 13:00:00+07');
INSERT INTO reimbursement_detail (_id, reimbursement_id, title, amount, created_at) VALUES
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'สาย HDMI x2',     1200, '2026-06-01 13:00:00+07'),
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', 'ปลั๊กพ่วง x1',     350, '2026-06-01 13:00:00+07');
INSERT INTO reimbursement_updatestatus (_id, reimbursement_id, status, staff_id, created_at) VALUES
  ('82000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'waiting', '30000000-0000-0000-0000-000000000008', '2026-06-01 13:00:00+07');

-- RB-D-002 — peak / IT, status: head_approve
INSERT INTO reimbursement (_id, staff_dept_id, tag_id, purpose, tracking_id, created_at) VALUES
  ('80000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000004', 'เมาส์ไร้สา� + คีย์บอร์ด',               'RB-2026-D002', '2026-06-10 13:00:00+07');
INSERT INTO reimbursement_detail (_id, reimbursement_id, title, amount, created_at) VALUES
  ('81000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000003', 'เมาส์ไร้สาย x2',   1800, '2026-06-10 13:00:00+07'),
  ('81000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000003', 'คีย์บอร์ด x1',    1200, '2026-06-10 13:00:00+07');
INSERT INTO reimbursement_updatestatus (_id, reimbursement_id, status, staff_id, created_at) VALUES
  ('82000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003', 'waiting',      '30000000-0000-0000-0000-000000000008', '2026-06-10 13:00:00+07'),
  ('82000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000003', 'head_approve', '30000000-0000-0000-0000-00000000000a', '2026-06-11 10:00:00+07');

-- RB-D-003 — ice / Marketing, status: fin_approve
INSERT INTO reimbursement (_id, staff_dept_id, tag_id, purpose, tracking_id, created_at) VALUES
  ('80000000-0000-0000-0000-000000000004', '21000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000003', 'ค่าพิมพ์โปสเตอร์',                       'RB-2026-D003', '2026-04-05 13:00:00+07');
INSERT INTO reimbursement_detail (_id, reimbursement_id, title, amount, created_at) VALUES
  ('81000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000004', 'โปสเ�อร์ A2 x50',   2500, '2026-04-05 13:00:00+07');
INSERT INTO reimbursement_updatestatus (_id, reimbursement_id, status, staff_id, created_at) VALUES
  ('82000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000004', 'waiting',      '30000000-0000-0000-0000-00000000000b', '2026-04-05 13:00:00+07'),
  ('82000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000004', 'head_approve', '30000000-0000-0000-0000-00000000000b', '2026-04-06 10:00:00+07'),
  ('82000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000004', 'fin_approve',  '30000000-0000-0000-0000-000000000009', '2026-04-08 10:00:00+07');

-- RB-D-004 — ice / Marketing, status: transfer (fully done)
INSERT INTO reimbursement (_id, staff_dept_id, tag_id, purpose, tracking_id, created_at) VALUES
  ('80000000-0000-0000-0000-000000000005', '21000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000003', 'ค่าโฆษณา Facebook Ads',               'RB-2026-D004', '2026-03-12 13:00:00+07');
INSERT INTO reimbursement_detail (_id, reimbursement_id, title, amount, created_at) VALUES
  ('81000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000005', 'FB Ads — Workshop 1',  5000, '2026-03-12 13:00:00+07');
INSERT INTO reimbursement_updatestatus (_id, reimbursement_id, status, staff_id, created_at) VALUES
  ('82000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000005', 'waiting',      '30000000-0000-0000-0000-00000000000b', '2026-03-12 13:00:00+07'),
  ('82000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000005', 'head_approve', '30000000-0000-0000-0000-00000000000b', '2026-03-13 10:00:00+07'),
  ('82000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-000000000005', 'fin_approve',  '30000000-0000-0000-0000-000000000009', '2026-03-15 10:00:00+07'),
  ('82000000-0000-0000-0000-00000000000b', '80000000-0000-0000-0000-000000000005', 'transfer',     '30000000-0000-0000-0000-000000000009', '2026-03-16 14:00:00+07');

-- RB-D-005 — po / Operations, status: transfer
INSERT INTO reimbursement (_id, staff_dept_id, tag_id, purpose, tracking_id, created_at) VALUES
  ('80000000-0000-0000-0000-000000000006', '21000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000005', 'ค่าอาหารว่าง — Workshop 1',            'RB-2026-D005', '2026-03-25 13:00:00+07');
INSERT INTO reimbursement_detail (_id, reimbursement_id, title, amount, created_at) VALUES
  ('81000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000006', 'ขนม + กาแฟ x40',     2200, '2026-03-25 13:00:00+07');
INSERT INTO reimbursement_updatestatus (_id, reimbursement_id, status, staff_id, created_at) VALUES
  ('82000000-0000-0000-0000-00000000000c', '80000000-0000-0000-0000-000000000006', 'waiting',      '30000000-0000-0000-0000-00000000000c', '2026-03-25 13:00:00+07'),
  ('82000000-0000-0000-0000-00000000000d', '80000000-0000-0000-0000-000000000006', 'head_approve', '30000000-0000-0000-0000-00000000000c', '2026-03-26 10:00:00+07'),
  ('82000000-0000-0000-0000-00000000000e', '80000000-0000-0000-0000-000000000006', 'fin_approve',  '30000000-0000-0000-0000-000000000009', '2026-03-28 10:00:00+07'),
  ('82000000-0000-0000-0000-00000000000f', '80000000-0000-0000-0000-000000000006', 'transfer',     '30000000-0000-0000-0000-000000000009', '2026-03-30 14:00:00+07');

-- RB-D-006 — peak / IT, status: rejected by head
INSERT INTO reimbursement (_id, staff_dept_id, tag_id, purpose, tracking_id, created_at) VALUES
  ('80000000-0000-0000-0000-000000000007', '21000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000004', 'เก้าอี้เกมมิ่ง (เกินงบ)',              'RB-2026-D006', '2026-06-20 13:00:00+07');
INSERT INTO reimbursement_detail (_id, reimbursement_id, title, amount, created_at) VALUES
  ('81000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000007', 'เก้าอี้เกมมิ่ง x1',  6500, '2026-06-20 13:00:00+07');
INSERT INTO reimbursement_updatestatus (_id, reimbursement_id, status, staff_id, created_at) VALUES
  ('82000000-0000-0000-0000-000000000010', '80000000-0000-0000-0000-000000000007', 'waiting',  '30000000-0000-0000-0000-000000000008', '2026-06-20 13:00:00+07'),
  ('82000000-0000-0000-0000-000000000011', '80000000-0000-0000-0000-000000000007', 'rejected', '30000000-0000-0000-0000-00000000000a', '2026-06-21 10:00:00+07');

-- RB-D-007 — po / Operations, status: delete
INSERT INTO reimbursement (_id, staff_dept_id, tag_id, purpose, tracking_id, created_at, deleted_at) VALUES
  ('80000000-0000-0000-0000-000000000008', '21000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000005', 'ค่าของชำร่วย (ยกเลิก)',                'RB-2026-D007', '2026-04-15 13:00:00+07', '2026-04-16 10:00:00+07');
INSERT INTO reimbursement_detail (_id, reimbursement_id, title, amount, created_at, deleted_at) VALUES
  ('81000000-0000-0000-0000-00000000000a', '80000000-0000-0000-0000-000000000008', 'ของชำร่วย x30',  3000, '2026-04-15 13:00:00+07', '2026-04-16 10:00:00+07');
INSERT INTO reimbursement_updatestatus (_id, reimbursement_id, status, staff_id, created_at) VALUES
  ('82000000-0000-0000-0000-000000000012', '80000000-0000-0000-0000-000000000008', 'waiting', '30000000-0000-0000-0000-00000000000c', '2026-04-15 13:00:00+07'),
  ('82000000-0000-0000-0000-000000000013', '80000000-0000-0000-0000-000000000008', 'delete',  '30000000-0000-0000-0000-00000000000c', '2026-04-16 10:00:00+07');

-- RB-D-008 — noon / Finance, status: waiting (just submitted today-ish)
INSERT INTO reimbursement (_id, staff_dept_id, tag_id, purpose, tracking_id, created_at) VALUES
  ('80000000-0000-0000-0000-000000000009', '21000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000004', 'ค่าซองเอกสาร + กาว',                   'RB-2026-D008', '2026-08-10 13:00:00+07');
INSERT INTO reimbursement_detail (_id, reimbursement_id, title, amount, created_at) VALUES
  ('81000000-0000-0000-0000-00000000000b', '80000000-0000-0000-0000-000000000009', 'ซอง A4 x100',         450, '2026-08-10 13:00:00+07'),
  ('81000000-0000-0000-0000-00000000000c', '80000000-0000-0000-0000-000000000009', 'กาวแท่ง x20',        180, '2026-08-10 13:00:00+07');
INSERT INTO reimbursement_updatestatus (_id, reimbursement_id, status, staff_id, created_at) VALUES
  ('82000000-0000-0000-0000-000000000014', '80000000-0000-0000-0000-000000000009', 'waiting', '30000000-0000-0000-0000-000000000007', '2026-08-10 13:00:00+07');

-- ----------------------------------------------------------------------------
-- Aggregate maintenance
--   App helpers (Payment.helper.js, Reimbursement.helper.js, Approval.helper.js)
--   own these columns in production. For seed data we hand-compute them so the
--   dashboard totals match reality out of the gate.
--
--   project_tag.total_income  = SUM(source.actual_amount) per tag
--   project_tag.total_expense = SUM(reimbursement_detail.amount) per tag
--     (only counting reimbursements that are NOT in rejected / delete / deleted)
--   project.total_income      = SUM(source.actual_amount) per project
--   project.total_expense     = SUM(reimbursement_detail.amount) per project
--     (same exclusion rules)
--   department.total_expense  = SUM(reimbursement_detail.amount) per dept
--     (joined via reimbursement.staff_dept_id → staff_dept.department_id,
--      excluding rejected / delete / deleted)
--
--   Numbers (audit trail):
--     project_tag.total_income:
--       Ticket Sales  (002): 18000 + 22000 + 12000            =  52000
--       Sponsorship   (003): 50000 + 0 + 15000                =  65000
--       Merchandise   (004):  8500 + 3000                     =  11500
--       Misc Income   (005):  4500                            =   4500
--     project_tag.total_expense (excluding rejected/delete/deleted):
--       Ticket Sales  (002): (no reimbursements)              =      0
--       Sponsorship   (003): RB-D-003 (2500) + RB-D-004 (5000)=   7500
--       Merchandise   (004): RB-D-001 (1200+350) +
--                            RB-D-002 (1800+1200) +
--                            RB-D-006 (6500 — rejected, EXCLUDED)
--                                                              =   4550
--       Misc Income   (005): RB-D-005 (2200) +
--                            RB-D-007 (3000 — deleted, EXCLUDED)
--                                                              =   2200
--     project.total_income     = 52000 + 65000 + 11500 + 4500 = 133000
--     project.total_expense    = 0 + 7500 + 4550 + 2200       =  14250
--     department.total_expense (excluding rejected/delete/deleted):
--       Finance     (003): RB-D-008 (450+180)                 =    630
--       IT          (004): RB-D-001 (1200+350) +
--                          RB-D-002 (1800+1200)               =   4550
--       Marketing   (005): RB-D-003 (2500) + RB-D-004 (5000) =   7500
--       Operations  (006): RB-D-005 (2200)                   =   2200
-- ----------------------------------------------------------------------------

UPDATE project_tag pt SET
  total_income = COALESCE(s.sum_actual, 0),
  total_expense = COALESCE(rd.sum_amount, 0)
FROM project_tag t
LEFT JOIN (
  SELECT tag_id, SUM(actual_amount) AS sum_actual
  FROM source
  WHERE deleted_at IS NULL
  GROUP BY tag_id
) s ON s.tag_id = t._id
LEFT JOIN (
  SELECT r.tag_id, SUM(rd_inner.amount) AS sum_amount
  FROM reimbursement r
  JOIN reimbursement_detail rd_inner ON rd_inner.reimbursement_id = r._id
  WHERE r.deleted_at IS NULL
    AND r.latest_status NOT IN ('rejected', 'delete')
    AND rd_inner.deleted_at IS NULL
  GROUP BY r.tag_id
) rd ON rd.tag_id = t._id
WHERE pt._id = t._id
  AND pt._id IN (
    '50000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000005'
  );

UPDATE project p SET
  total_income = COALESCE(s.sum_actual, 0),
  total_expense = COALESCE(rd.sum_amount, 0)
FROM project proj
LEFT JOIN (
  SELECT project_id, SUM(actual_amount) AS sum_actual
  FROM source
  WHERE deleted_at IS NULL
  GROUP BY project_id
) s ON s.project_id = proj._id
LEFT JOIN (
  SELECT r.project_id, SUM(rd_inner.amount) AS sum_amount
  FROM reimbursement r
  JOIN reimbursement_detail rd_inner ON rd_inner.reimbursement_id = r._id
  WHERE r.deleted_at IS NULL
    AND r.latest_status NOT IN ('rejected', 'delete')
    AND rd_inner.deleted_at IS NULL
  GROUP BY r.project_id
) rd ON rd.project_id = proj._id
WHERE p._id = proj._id
  AND p._id = '10000000-0000-0000-0000-000000000002';

UPDATE department d SET
  total_expense = COALESCE(rd.sum_amount, 0)
FROM department dept
LEFT JOIN (
  SELECT sd.department_id, SUM(rd_inner.amount) AS sum_amount
  FROM reimbursement r
  JOIN staff_dept sd ON sd._id = r.staff_dept_id
  JOIN reimbursement_detail rd_inner ON rd_inner.reimbursement_id = r._id
  WHERE r.deleted_at IS NULL
    AND r.latest_status NOT IN ('rejected', 'delete')
    AND rd_inner.deleted_at IS NULL
  GROUP BY sd.department_id
) rd ON rd.department_id = dept._id
WHERE d._id = dept._id
  AND d._id IN (
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000006'
  );

select now() as demo_seeded_at;
