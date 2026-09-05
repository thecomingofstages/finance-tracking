-- ---------------------------------------------------------------------------
-- Migration: Convert existing financial records from Baht to Integer Satang
--
-- All monetary amounts in the finance schema are stored as integer Satang
-- (1 THB = 100 Satang). The initial seed data was entered in Baht units
-- (e.g. 500000 instead of 50000000 satang).
--
-- READ BEFORE RUNNING:
-- This script runs inside a transaction and ends with ROLLBACK by default.
-- Inspect the BEFORE and AFTER preview tables, and only change ROLLBACK to
-- COMMIT at the bottom when you are satisfied with the results.
-- ---------------------------------------------------------------------------

SET search_path TO finance, public;

BEGIN;

-- 1. Preview current (before) values ---------------------------------------
SELECT 'project' AS table_name, _id::text, name, allocated_budget, total_income, total_expense
  FROM project WHERE deleted_at IS NULL
UNION ALL
SELECT 'department', _id::text, name, allocated_budget, NULL, total_expense
  FROM department WHERE deleted_at IS NULL
UNION ALL
SELECT 'project_tag', _id::text, name, allocated_budget, total_income, total_expense
  FROM project_tag WHERE deleted_at IS NULL
UNION ALL
SELECT 'source', _id::text, name, expect_amount, actual_amount, NULL
  FROM source WHERE deleted_at IS NULL
UNION ALL
SELECT 'reimbursement_detail', _id::text, title, amount, NULL, NULL
  FROM reimbursement_detail WHERE deleted_at IS NULL;

-- 2. Update monetary columns (x 100) ---------------------------------------

UPDATE project
   SET allocated_budget = allocated_budget * 100,
       total_income     = total_income * 100,
       total_expense    = total_expense * 100
 WHERE deleted_at IS NULL;

UPDATE department
   SET allocated_budget = allocated_budget * 100,
       total_expense    = total_expense * 100
 WHERE deleted_at IS NULL;

UPDATE project_tag
   SET allocated_budget = allocated_budget * 100,
       total_income     = total_income * 100,
       total_expense    = total_expense * 100
 WHERE deleted_at IS NULL;

UPDATE source
   SET expect_amount = expect_amount * 100,
       actual_amount = actual_amount * 100
 WHERE deleted_at IS NULL;

UPDATE payment
   SET expected_amount = expected_amount * 100,
       actual_amount   = actual_amount * 100
 WHERE deleted_at IS NULL;

UPDATE payment_updatestatus
   SET actual_amount = actual_amount * 100
 WHERE actual_amount IS NOT NULL;

UPDATE reimbursement_detail
   SET amount = amount * 100
 WHERE deleted_at IS NULL;

-- 3. Preview updated (after) values ----------------------------------------
SELECT 'project' AS table_name, _id::text, name, allocated_budget, total_income, total_expense
  FROM project WHERE deleted_at IS NULL
UNION ALL
SELECT 'department', _id::text, name, allocated_budget, NULL, total_expense
  FROM department WHERE deleted_at IS NULL
UNION ALL
SELECT 'project_tag', _id::text, name, allocated_budget, total_income, total_expense
  FROM project_tag WHERE deleted_at IS NULL
UNION ALL
SELECT 'source', _id::text, name, expect_amount, actual_amount, NULL
  FROM source WHERE deleted_at IS NULL
UNION ALL
SELECT 'reimbursement_detail', _id::text, title, amount, NULL, NULL
  FROM reimbursement_detail WHERE deleted_at IS NULL;

-- Safety: change ROLLBACK to COMMIT when ready to apply to Supabase
ROLLBACK;
