const ApiError = require("../utils/ApiError.util");
const { fail } = require("../utils/Response.util");
const logger = require("../utils/Logger.util");

// Multer's file-too-large / unexpected-field errors — normalize to the standard envelope.
function isMulterError(err) {
  return err && err.name === "MulterError";
}

/** Must be registered last. 4 args is what makes Express treat this as an error handler. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return fail(res, err);
  }
  if (isMulterError(err)) {
    return fail(res, ApiError.validation(err.message, "file"));
  }
  // A unique-constraint violation is a conflict, not a server fault. Helpers do their own
  // scoped duplicate checks first (and raise a better-worded 409), but those checks cannot
  // cover every constraint: bankaccount.number, for instance, is UNIQUE across the whole
  // table while the helper only looks within the caller's own accounts, so two staff sharing
  // an account number reached Postgres and surfaced as a 500.
  if (err.name === "SequelizeUniqueConstraintError") {
    return fail(res, ApiError.conflict("That value is already in use.", "DUPLICATE_VALUE"));
  }
  // Postgres 22P02 = invalid_text_representation, which is what a malformed UUID in a path
  // param produces once it reaches the query. It means the caller sent nonsense, so it is a
  // 400 — previously it fell through to the catch-all below and surfaced as a 500.
  if ((err.parent || err.original)?.code === "22P02") {
    return fail(res, ApiError.validation("Malformed identifier.", "id"));
  }
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  return fail(res, new ApiError(500, "INTERNAL_ERROR", "Unexpected server error."));
}

function notFoundHandler(req, res) {
  return fail(res, ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

module.exports = { errorHandler, notFoundHandler };
