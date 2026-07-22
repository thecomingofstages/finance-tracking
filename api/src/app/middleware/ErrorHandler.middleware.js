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
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");
  return fail(res, new ApiError(500, "INTERNAL_ERROR", "Unexpected server error."));
}

function notFoundHandler(req, res) {
  return fail(res, ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

module.exports = { errorHandler, notFoundHandler };
