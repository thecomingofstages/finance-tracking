-- Persist the rejection reason.
--
-- `reason` has been required by the API on every `-> rejected` transition since the contract
-- was written (swagger.yaml, Reimbursement.schema.js, and Approval.helper.js's TRANSITIONS all
-- demand it), but reimbursement_updatestatus never had a column for it. The value was
-- validated, then dropped on the floor: a head could type "ใบเสร็จไม่ครบ", the rejection would
-- succeed, and the requester would see that they were rejected but never why.
--
-- Nullable on purpose. The column is meaningless for the approving transitions, and existing
-- rows genuinely have no reason to backfill — NULL is the honest value for both, and a NOT NULL
-- default would invent history that did not happen.

ALTER TABLE finance.reimbursement_updatestatus
  ADD COLUMN IF NOT EXISTS reason TEXT;

COMMENT ON COLUMN finance.reimbursement_updatestatus.reason IS
  'Why this transition was made. Required by the API for any transition to ''rejected'', NULL for every other status.';
