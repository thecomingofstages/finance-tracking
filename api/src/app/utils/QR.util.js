const QRCode = require("qrcode");
const crypto = require("node:crypto");
const { keys } = require("../config/init");
const { app: appConf } = require("../config/init");

/** Signs a payload with HMAC-SHA256 and returns base64url(payload).signature — see doc 03 §4/§9. */
function signPayload(payload) {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString("base64url");
  const signature = crypto.createHmac("sha256", keys.hmacSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPayload(token) {
  const [encoded, signature] = String(token).split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", keys.hmacSecret).update(encoded).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function toDataUri(text) {
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 1 });
}

/** Verification QR embedded on rendered documents — see doc 03 §9 Document endpoint. */
async function verificationQrDataUri(reimbursementId) {
  return toDataUri(`${appConf.frontendBaseUrl}/reimburse/${reimbursementId}`);
}

module.exports = { signPayload, verifyPayload, toDataUri, verificationQrDataUri };
