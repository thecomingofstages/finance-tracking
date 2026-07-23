const { Router } = require("express");

const authRoutes = require("./Auth.routes");
const { staffRouter, adminStaffRouter } = require("./Staff.routes");
const { projectRouter, tagsRouter, departmentsRouter } = require("./Project.routes");
const { projectSourcesRouter, sourcesRouter } = require("./Source.routes");
const paymentRoutes = require("./Payment.routes");
const reimbursementRoutes = require("./Reimbursement.routes");
const reportRoutes = require("./Report.routes");

/** Mounts every router under /v1, matching docs/backend/03-api-spec.md §2 exactly. */
function mountV1(app) {
  const v1 = Router();

  v1.use("/auth", authRoutes);
  v1.use("/staff", staffRouter);
  v1.use("/admin/staff", adminStaffRouter);
  v1.use("/projects", projectRouter);
  v1.use("/projects", projectSourcesRouter); // adds GET/POST /projects/:id/sources
  v1.use("/tags", tagsRouter);
  v1.use("/departments", departmentsRouter);
  v1.use("/sources", sourcesRouter);
  v1.use("/payments", paymentRoutes);
  v1.use("/reimbursements", reimbursementRoutes);
  v1.use("/reports", reportRoutes);

  v1.get("/health", (req, res) => res.json({ success: true, data: { status: "ok" } }));

  app.use("/v1", v1);
}

module.exports = { mountV1 };
