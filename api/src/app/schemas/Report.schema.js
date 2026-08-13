const { z } = require("zod");

function withDateRange(shape) {
  return z.object(shape).superRefine((value, context) => {
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "to must be on or after from." });
    }
  });
}

const dateFilters = {
  from: z.string().date().optional(),
  to: z.string().date().optional(),
};

const summary = withDateRange({
  project_id: z.string().uuid().optional(),
  tag_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  ...dateFilters,
});

const cashflow = withDateRange({
  project_id: z.string().uuid().optional(),
  ...dateFilters,
});

const journal = withDateRange({
  project_id: z.string().uuid().optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must use YYYY-MM.").optional(),
  ...dateFilters,
}).superRefine((value, context) => {
  if (value.month && (value.from || value.to)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["month"], message: "month cannot be combined with from or to." });
  }
});

const topExpenses = z.object({
  project_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(5),
});

const sponsors = z.object({
  project_id: z.string().uuid().optional(),
});

const journalExport = z.object({
  format: z.enum(["xlsx", "pdf"]).optional(),
});

module.exports = { summary, cashflow, journal, journalExport, topExpenses, sponsors };
