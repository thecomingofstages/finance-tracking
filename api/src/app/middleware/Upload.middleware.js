const multer = require("multer");
const ApiError = require("../utils/ApiError.util");

const storage = multer.memoryStorage();

/**
 * Accept-lists per route. Multer only ever enforced a size limit before, so any file type was
 * accepted and stored — a shell script uploaded as a signature was accepted with 200 and
 * written to R2.
 *
 * The declared MIME type is attacker-controlled, so it is checked here only to reject the
 * obvious cases early and cheaply; `sniff` below is what actually decides, by reading the
 * file's own magic bytes. Both must agree.
 */
const SIGNATURES = {
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
  "application/pdf": [Buffer.from("%PDF-")],
};

function magicMatches(mimetype, buffer) {
  const prefixes = SIGNATURES[mimetype];
  if (!prefixes) return false;
  return prefixes.some((prefix) => buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(prefix));
}

/** multer's fileFilter runs before the buffer exists, so it can only screen the declared type;
 *  the magic-byte check has to happen after, which is what `verify` is for. */
function filterByMime(allowed) {
  return (req, file, cb) => {
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(ApiError.validation(`Unsupported file type: ${file.mimetype}. Allowed: ${allowed.join(", ")}.`, "file"));
  };
}

/** Route-level guard: run after the multer middleware, rejects a file whose contents don't
 *  match what it claimed to be. */
function verify(field, allowed) {
  return (req, res, next) => {
    const file = req.file;
    if (!file) return next();
    if (!allowed.includes(file.mimetype) || !magicMatches(file.mimetype, file.buffer)) {
      return next(ApiError.validation(`${field} is not a valid ${allowed.join(" / ")} file.`, field));
    }
    return next();
  };
}

const RECEIPT_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const SIGNATURE_TYPES = ["image/png", "image/jpeg"];

// 25 MB, matching the dev plan's "/reimburse -> Max: 25 MB". It was 10 MB, which rejected
// perfectly legitimate scanned receipts.
const receipt = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: filterByMime(RECEIPT_TYPES),
}).single("receipt");

const signature = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: filterByMime(SIGNATURE_TYPES),
}).single("signature");

// CSV is plain text with no magic bytes to check, so this one stays a declared-type check
// only. Browsers and curl disagree about the right CSV mime, hence the spread.
const csvFile = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: filterByMime(["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"]),
}).single("file");

module.exports = {
  receipt,
  signature,
  csvFile,
  verifyReceipt: verify("receipt", RECEIPT_TYPES),
  verifySignature: verify("signature", SIGNATURE_TYPES),
};
