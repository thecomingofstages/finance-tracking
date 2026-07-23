class ApiError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} code Machine-readable error code — see docs/backend/03-api-spec.md §11
   * @param {string} message Human-readable message, safe to show a user
   * @param {string} [field] Which request field this validation error concerns
   */
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }

  static validation(message, field) {
    return new ApiError(400, "VALIDATION_ERROR", message, field);
  }

  static unauthorized(message = "Missing or invalid credentials.", code = "INVALID_CREDENTIALS") {
    return new ApiError(401, code, message);
  }

  static forbidden(message = "You don't have permission to do this.", code = "FORBIDDEN") {
    return new ApiError(403, code, message);
  }

  static notFound(message = "Resource not found.", code = "NOT_FOUND") {
    return new ApiError(404, code, message);
  }

  static conflict(message, code = "CONFLICT") {
    return new ApiError(409, code, message);
  }

  static unprocessable(message, code) {
    return new ApiError(422, code, message);
  }
}

module.exports = ApiError;
