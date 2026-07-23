const { z } = require("zod");

const journalExport = z.object({
  format: z.enum(["xlsx", "pdf"]).optional(),
});

module.exports = { journalExport };
