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

const update = z
  .object({
    purpose: z.string().min(1).optional(),
    tag_id: z.string().uuid().nullable().optional(),
    banking_id: z.string().uuid().nullable().optional(),
    details: z.array(detailItem).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required." });

const booleanQuery = z.preprocess((value) => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
}, z.boolean());

const list = z.object({
  status: z.enum(["waiting", "head_approve", "fin_approve", "transfer", "rejected", "delete"]).optional(),
  department_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  mine: booleanQuery.default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Per-transition `tracking_id`/`reason` requirements (doc 04 §4) are checked against the
// actual transition table in Approval.helper.js, not here — this only validates that IF
// they're present, they're the right shape.
const changeStatus = z.object({
  status: z.enum(["waiting", "head_approve", "fin_approve", "transfer", "rejected", "delete"]),
  tracking_id: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
});

module.exports = { create, update, list, changeStatus };
