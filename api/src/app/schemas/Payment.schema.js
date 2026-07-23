const { z } = require("zod");

const ingest = z.object({
  _id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  type: z.enum(["enroll", "merch", "spon", "other"]).optional(),
  reference_id: z.string().uuid().nullable().optional(),
  source_id: z.string().uuid(),
  expected_amount: z.number().int().nonnegative().optional(),
  promptpay_qr_data: z.string().optional(),
});

const decision = z.object({
  payment_id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  actual_amount: z.number().int().nonnegative().optional(),
});
const bulkApprove = z.object({ decisions: z.array(decision).min(1) });

module.exports = { ingest, bulkApprove };
