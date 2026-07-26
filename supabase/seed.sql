-- Dev/test fixtures for finance-tracking. Runs after migrations on `supabase db reset`
-- (local) or when pasted manually into the hosted project's SQL Editor.
--
-- 4 of 6 staff rows have a real password_hash (bcrypt, cost 12) for the shared test password
-- below — log in with any of them via POST /v1/auth/login. The other 2 are left unclaimed
-- (password_hash NULL) to exercise POST /v1/auth/claim.
--
-- Test password for chompoo / mark / golf / beam: Passw0rd!2026

SET search_path TO finance, public;

INSERT INTO project (_id, name, description, allocated_budget, total_income, total_expense) VALUES
  ('10000000-0000-0000-0000-000000000001', 'TCOS Annual Event 2026', 'Flagship annual event — mock seed data for BE dev/testing', 500000, 0, 0);

INSERT INTO department (_id, project_id, name, allocated_budget, total_expense) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Finance', 100000, 0),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'IT', 80000, 0);

INSERT INTO staff (_id, title, first_name, last_name, nickname, email, password_hash, phone, role) VALUES
  ('30000000-0000-0000-0000-000000000001', 'นางสาว', 'Chompoo', 'Lead', 'chompoo', 'chompoo@tcos.app', '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000001', 'admin'),
  ('30000000-0000-0000-0000-000000000002', 'นาย', 'Mark', 'Junior', 'mark', 'mark@tcos.app', '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000002', 'staff'),
  ('30000000-0000-0000-0000-000000000003', 'นาย', 'Golf', 'Finance', 'golf', 'golf@tcos.app', '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000003', 'finance'),
  ('30000000-0000-0000-0000-000000000004', 'นางสาว', 'Fah', 'ItStaff', 'fah', 'fah@tcos.app', NULL, '0810000004', 'it'),
  ('30000000-0000-0000-0000-000000000005', 'นางสาว', 'Ploy', 'Hr', 'ploy', 'ploy@tcos.app', NULL, '0810000005', 'hr'),
  ('30000000-0000-0000-0000-000000000006', 'นาย', 'Beam', 'Owner', 'beam', 'beam@tcos.app', '$2b$12$KtwdC0ICihYvazLMW.q48O1tL6/zCDkDBa19zkQ/8vklk5p0Sa5j2', '0810000006', 'owner');

INSERT INTO bankaccount (_id, name, number, provider, staff_id) VALUES
  ('40000000-0000-0000-0000-000000000001', 'Chompoo Lead', '1234567890', 'kbank', '30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', 'Golf Finance', '9876543210', 'scb', '30000000-0000-0000-0000-000000000003');

INSERT INTO staff_dept (_id, staff_id, department_id, is_head, is_finance, is_manager) VALUES
  ('21000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', TRUE, TRUE, TRUE),
  ('21000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', FALSE, TRUE, FALSE),
  ('21000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', FALSE, FALSE, TRUE),
  ('21000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', FALSE, FALSE, FALSE),
  ('21000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', TRUE, FALSE, FALSE);

INSERT INTO project_tag (_id, project_id, name, allocated_budget) VALUES
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sponsorship Booth', 50000);

INSERT INTO source (_id, type, tag_id, project_id, expect_amount, actual_amount, name) VALUES
  ('60000000-0000-0000-0000-000000000001', 'spon', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 50000, 20000, 'Booth Sponsor A');

INSERT INTO payment (_id, source_id, expected_amount) VALUES
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 20000);

INSERT INTO payment_updatestatus (_id, payment_id, status, actual_amount, staff_id) VALUES
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'approved', 20000, '30000000-0000-0000-0000-000000000003');

INSERT INTO reimbursement (_id, staff_dept_id, purpose, tracking_id) VALUES
  ('80000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000004', 'อุปกรณ์ IT สำหรับบูธ', 'RB-2026-0001');

INSERT INTO reimbursement_detail (_id, reimbursement_id, title, amount) VALUES
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'สาย HDMI x2', 500);

INSERT INTO reimbursement_updatestatus (_id, reimbursement_id, status, staff_id) VALUES
  ('82000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'waiting', '30000000-0000-0000-0000-000000000002');

select now() as seeded_at;
