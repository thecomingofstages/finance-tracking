const multer = require("multer");

const storage = multer.memoryStorage();

/** 10 MB ceiling matches receipts (doc 03 §9); tighten per-route where the spec asks for less
 *  (2 MB signatures) by passing a smaller limits object at the route. */
const receipt = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }).single("receipt");
const signature = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }).single("signature");
const csvFile = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).single("file");

module.exports = { receipt, signature, csvFile };
