const { z } = require("zod");

const create = z.object({
  type: z.enum(["enroll", "merch", "spon", "other"]),
  name: z.string().min(1),
  tag_id: z.string().uuid().nullable().optional(),
  expect_amount: z.number().int().nonnegative().optional(),
  reference_id: z.string().uuid().nullable().optional(),
});

// actual_amount/type/reference_id/project_id write-protection stays in Source.helper.js —
// same reasoning as Project.schema.js's update: keep the tailored per-field error message.
const update = z.object({
  name: z.string().min(1).optional(),
  tag_id: z.string().uuid().nullable().optional(),
  expect_amount: z.number().int().nonnegative().optional(),
  actual_amount: z.number().optional(),
  type: z.string().optional(),
  reference_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().optional(),
});

module.exports = { create, update };
