const { z } = require("zod");

const detailItem = z.object({
  title: z.string().min(1),
  amount: z.number().int().positive(),
});

const create = z.object({
  department_id: z.string().uuid(),
  tag_id: z.string().uuid().nullable().optional(),
  purpose: z.string().min(1),
  banking_id: z.string().uuid().nullable().optional(),
  details: z.array(detailItem).min(1),
});

const update = z.object({
  purpose: z.string().min(1).optional(),
  tag_id: z.string().uuid().nullable().optional(),
  banking_id: z.string().uuid().nullable().optional(),
  details: z.array(detailItem).min(1).optional(),
});

// Per-transition `tracking_id`/`reason` requirements (doc 04 §4) are checked against the
// actual transition table in Approval.helper.js, not here — this only validates that IF
// they're present, they're the right shape.
const changeStatus = z.object({
  status: z.enum(["waiting", "head_approve", "fin_approve", "transfer", "rejected", "delete"]),
  tracking_id: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
});

module.exports = { create, update, changeStatus };
