-- ---------------------------------------------------------------------------
-- Cleanup for artefacts written by the deployed-stack E2E suites.
--
-- Everything those suites create is named `E2E-<runId> …` (projects, sources,
-- reimbursement purposes) or uses an `@example.invalid` email (staff), so this
-- script never has to guess at which rows are real.
--
-- READ BEFORE RUNNING. This touches the shared Supabase project. It is written
-- to be inspected first: run it inside the transaction as-is, look at the two
-- SELECTs, and only then swap ROLLBACK for COMMIT at the bottom.
--
-- What it does NOT do:
--   * hard-delete anything — every table here uses `deleted_at` soft deletes,
--     and this script stays consistent with the application's own semantics
--   * touch R2 — receipts and signatures uploaded during a run stay in the
--     `finance-receipts` / `finance-signatures` buckets. They are addressed by
--     reimbursement/staff id and orphaned once these rows are soft-deleted;
--     remove them separately if bucket size matters.
-- ---------------------------------------------------------------------------

SET search_path TO finance, public;

BEGIN;

-- 1. What is about to be removed -------------------------------------------
SELECT 'project' AS kind, _id::text, name          FROM project        WHERE name    LIKE 'E2E-%' AND deleted_at IS NULL
UNION ALL
SELECT 'source',          _id::text, name          FROM source         WHERE name    LIKE 'E2E-%' AND deleted_at IS NULL
UNION ALL
SELECT 'reimbursement',   _id::text, purpose       FROM reimbursement  WHERE purpose LIKE 'E2E-%' AND deleted_at IS NULL
UNION ALL
SELECT 'staff',           _id::text, email         FROM staff          WHERE email   LIKE '%@example.invalid' AND deleted_at IS NULL
UNION ALL
SELECT 'bankaccount',     b._id::text, b.name      FROM bankaccount b  WHERE b.name  LIKE 'E2E-%' AND b.deleted_at IS NULL
ORDER BY kind, name;

-- 2. Soft-delete the reimbursements and their details -----------------------
--    Details first, so nothing is left pointing at a deleted parent.
UPDATE reimbursement_detail d
   SET deleted_at = now()
  FROM reimbursement r
 WHERE d.reimbursement_id = r._id
   AND r.purpose LIKE 'E2E-%'
   AND d.deleted_at IS NULL;

UPDATE reimbursement
   SET deleted_at = now()
 WHERE purpose LIKE 'E2E-%'
   AND deleted_at IS NULL;

-- 3. Soft-delete projects and sources created by the suites ------------------
UPDATE source        SET deleted_at = now() WHERE name LIKE 'E2E-%' AND deleted_at IS NULL;
UPDATE project_tag   SET deleted_at = now() WHERE name LIKE 'E2E-%' AND deleted_at IS NULL;
UPDATE department    SET deleted_at = now() WHERE name LIKE 'E2E-%' AND deleted_at IS NULL;
UPDATE project       SET deleted_at = now() WHERE name LIKE 'E2E-%' AND deleted_at IS NULL;

-- 4. Soft-delete the throwaway staff accounts and their bank accounts --------
UPDATE bankaccount b
   SET deleted_at = now()
  FROM staff s
 WHERE b.staff_id = s._id
   AND s.email LIKE '%@example.invalid'
   AND b.deleted_at IS NULL;

UPDATE bankaccount SET deleted_at = now() WHERE name LIKE 'E2E-%' AND deleted_at IS NULL;

UPDATE staff_dept sd
   SET deleted_at = now()
  FROM staff s
 WHERE sd.staff_id = s._id
   AND s.email LIKE '%@example.invalid'
   AND sd.deleted_at IS NULL;

UPDATE staff SET deleted_at = now() WHERE email LIKE '%@example.invalid' AND deleted_at IS NULL;

-- 5. Rebuild the aggregate columns ------------------------------------------
--    fin_approve->transfer rolls a reimbursement's total into
--    department/project/tag total_expense in application code (no trigger
--    exists — docs/backend/02-database.md §6 gap #1). Soft-deleting the rows
--    above does NOT reverse that, so the totals are recomputed here from what
--    actually survives rather than decremented by a guessed amount.
WITH live_expense AS (
  SELECT sd.department_id,
         SUM(d.amount) AS total
    FROM reimbursement r
    JOIN staff_dept sd          ON sd._id = r.staff_dept_id
    JOIN reimbursement_detail d ON d.reimbursement_id = r._id
   WHERE r.deleted_at IS NULL
     AND d.deleted_at IS NULL
     AND r.latest_status = 'transfer'
   GROUP BY sd.department_id
)
UPDATE department dep
   SET total_expense = COALESCE(le.total, 0)
  FROM (SELECT _id FROM department WHERE deleted_at IS NULL) keep
  LEFT JOIN live_expense le ON le.department_id = keep._id
 WHERE dep._id = keep._id;

WITH live_expense AS (
  SELECT dep.project_id,
         SUM(d.amount) AS total
    FROM reimbursement r
    JOIN staff_dept sd          ON sd._id = r.staff_dept_id
    JOIN department dep         ON dep._id = sd.department_id
    JOIN reimbursement_detail d ON d.reimbursement_id = r._id
   WHERE r.deleted_at IS NULL
     AND d.deleted_at IS NULL
     AND r.latest_status = 'transfer'
   GROUP BY dep.project_id
)
UPDATE project p
   SET total_expense = COALESCE(le.total, 0)
  FROM (SELECT _id FROM project WHERE deleted_at IS NULL) keep
  LEFT JOIN live_expense le ON le.project_id = keep._id
 WHERE p._id = keep._id;

WITH live_expense AS (
  SELECT r.tag_id,
         SUM(d.amount) AS total
    FROM reimbursement r
    JOIN reimbursement_detail d ON d.reimbursement_id = r._id
   WHERE r.deleted_at IS NULL
     AND d.deleted_at IS NULL
     AND r.tag_id IS NOT NULL
     AND r.latest_status = 'transfer'
   GROUP BY r.tag_id
)
UPDATE project_tag t
   SET total_expense = COALESCE(le.total, 0)
  FROM (SELECT _id FROM project_tag WHERE deleted_at IS NULL) keep
  LEFT JOIN live_expense le ON le.tag_id = keep._id
 WHERE t._id = keep._id;

-- 6. What the totals look like afterwards -----------------------------------
SELECT p.name, p.allocated_budget, p.total_income, p.total_expense
  FROM project p
 WHERE p.deleted_at IS NULL
 ORDER BY p.name;

-- Inspect the output above, then replace this with COMMIT.
ROLLBACK;
