const ApiError = require("../utils/ApiError.util");
const { fail } = require("../utils/Response.util");

function format(zodError) {
  const first = zodError.issues[0];
  return { message: first?.message || "Validation failed.", field: first?.path?.join(".") };
}

/** @param {import('zod').ZodSchema} schema */
function body(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const { message, field } = format(result.error);
      return fail(res, ApiError.validation(message, field));
    }
    req.body = result.data;
    return next();
  };
}

function query(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const { message, field } = format(result.error);
      return fail(res, ApiError.validation(message, field));
    }
    req.query = result.data;
    return next();
  };
}

module.exports = { body, query };
