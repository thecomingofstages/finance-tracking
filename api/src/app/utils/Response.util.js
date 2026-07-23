/** Builds the standard envelope from docs/backend/03-api-spec.md §1. */

function ok(res, data, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function created(res, data, meta) {
  return ok(res, data, { status: 201, meta });
}

function noContent(res) {
  return res.status(204).send();
}

function fail(res, apiError) {
  const body = {
    success: false,
    error: { code: apiError.code, message: apiError.message },
  };
  if (apiError.field) body.error.field = apiError.field;
  return res.status(apiError.status).json(body);
}

module.exports = { ok, created, noContent, fail };
