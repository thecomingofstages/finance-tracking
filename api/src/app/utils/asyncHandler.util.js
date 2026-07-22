/** Wraps an async Express handler so a rejected promise reaches ErrorHandler.middleware.js
 *  instead of crashing the process. Used by every controller method. */
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
