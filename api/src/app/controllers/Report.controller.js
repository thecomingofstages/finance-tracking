const asyncHandler = require("../utils/asyncHandler.util");
const { ok } = require("../utils/Response.util");
const ApiError = require("../utils/ApiError.util");
const Report = require("../helpers/Report.helper");

exports.summary = asyncHandler(async (req, res) => ok(res, await Report.summary(req.query)));

exports.cashflow = asyncHandler(async (req, res) => ok(res, await Report.cashflow(req.query)));

exports.journal = asyncHandler(async (req, res) => ok(res, await Report.journal(req.query)));

exports.journalExport = asyncHandler(async (req, res) => {
  const { contentType, filename, body } = await Report.journalExport(req.query, req.body?.format || req.query.format);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(body);
});

exports.topExpenses = asyncHandler(async (req, res) => ok(res, await Report.topExpenses(req.query)));

exports.sponsors = asyncHandler(async (req, res) => ok(res, await Report.sponsors(req.query)));

exports.ledger = asyncHandler(async (req, res) => {
  throw new ApiError(
    501,
    "NOT_IMPLEMENTED",
    "Blocked pending a chart-of-accounts decision — see docs/backend/05-open-questions.md #1."
  );
});
