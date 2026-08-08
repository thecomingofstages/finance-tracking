const ApiError = require("./ApiError.util");

/**
 * Target resolvers for Auth.middleware's requireScope (doc 04 §3).
 *
 * A scope flag is only meaningful against something: `requireScope("isFinance")` on its own
 * can't tell *which* project it means. Every guarded route therefore names its resolver here,
 * at the route definition, rather than requireScope guessing from a convention — `req.params.id`
 * is a project id on /projects/:id and a payment id on /payments/:id, and getting that backwards
 * is a silent authorization hole, not a visible 500.
 *
 * A resolver returns the **project** id the flag is checked against — or a **department** id for
 * the department-scoped isHead — or `undefined` when the route genuinely carries no project
 * context (POST /projects, GET /reports/cashflow, GET /staff/:id). `undefined` is not an error:
 * requireScope falls back to "does this flag hold for ANY of the caller's projects", which keeps
 * those routes reachable by staff who aren't finance/owner/admin.
 *
 * Lazy require for the same reason as Auth.helper.js — resolving models at import time would
 * force a DB dial before index.js has decided whether to connect.
 */
function models() {
  return require("../models");
}

/** The path param IS the project id — /projects/:id and its subresources. */
function param(name = "id") {
  return (req) => req.params[name];
}

/**
 * The project id arrives as a query param. Absent is deliberately allowed through as
 * `undefined` (the any-project fallback) — project_id is optional in swagger.yaml on
 * GET /staff, /reports/journal and /reports/sponsors, and making it required would be a
 * breaking contract change.
 */
function query(name = "project_id") {
  return (req) => req.query?.[name] || undefined;
}

/** Route has no project context at all — always the any-project fallback. Written out rather
 *  than omitting the argument so "this was considered" is visible at the call site. */
const anyProject = () => undefined;

/** Shared shape for the indirect lookups: load the row, fail with 404 if it's gone, otherwise
 *  hand back the project it belongs to. Not found is a real 404 and not an any-project
 *  fallback — falling back would let a bogus id pass the guard for any project member. */
async function projectOf(Model, id, label) {
  if (!id) throw ApiError.validation(`A ${label} id is required.`);
  const row = await Model.findByPk(id);
  if (!row) throw ApiError.notFound(`${label} not found.`);
  return row.project_id;
}

/** /tags/:id → project_tag.project_id */
const projectOfTag = (req) => projectOf(models().ProjectTag, req.params.id, "Tag");

/** /departments/:id → department.project_id */
const projectOfDepartment = (req) => projectOf(models().Department, req.params.id, "Department");

/** /sources/:id → source.project_id */
const projectOfSource = (req) => projectOf(models().Source, req.params.id, "Source");

/** /payments/:id → payment.source_id → source.project_id. Two hops: payment has no project_id
 *  of its own, the source is the anchor (see Source.model.js). */
async function projectOfPayment(req) {
  const { Payment, Source } = models();
  const payment = await Payment.findByPk(req.params.id);
  if (!payment) throw ApiError.notFound("Payment not found.");
  return projectOf(Source, payment.source_id, "Source");
}

module.exports = {
  param,
  query,
  anyProject,
  projectOfTag,
  projectOfDepartment,
  projectOfSource,
  projectOfPayment,
};
