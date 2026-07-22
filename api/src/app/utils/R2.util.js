const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v7: uuidv7 } = require("uuid");
const { r2, r2Keys } = require("../config/init");
const logger = require("./Logger.util");

/**
 * Real Cloudflare R2 (S3-compatible) storage. Deliberately decoupled from the app-wide
 * MOCK_MODE flag — MOCK_MODE governs whether *data* (staff/projects/reimbursements) comes
 * from Postgres or fixtures, which is a separate concern from whether *files* actually land
 * in a bucket. As long as R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY are set (see
 * .env.example), uploads/downloads/presigned URLs are genuinely real even while the rest of
 * the app is still serving mock data. Falls back to a recognisable mock URL only when R2
 * isn't configured at all, so local dev without any R2 credentials doesn't crash.
 */
const configured = Boolean(r2.endpoint && r2Keys.accessKeyId && r2Keys.secretAccessKey);
if (!configured) {
  logger.warn("R2 not configured (R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY) — falling back to mock URLs for uploads.");
}

let client = null;
function getClient() {
  if (client) return client;
  client = new S3Client({
    region: r2.region,
    endpoint: r2.endpoint,
    credentials: { accessKeyId: r2Keys.accessKeyId, secretAccessKey: r2Keys.secretAccessKey },
  });
  return client;
}

/** @param {"receipts"|"signatures"} bucketKey */
function buildKey(bucketKey, ...segments) {
  const ext = segments.pop();
  return `${segments.join("/")}/${uuidv7()}.${ext}`;
}

async function upload(bucketKey, key, buffer, contentType) {
  if (!configured) return { key, mocked: true };
  await getClient().send(
    new PutObjectCommand({
      Bucket: r2.buckets[bucketKey],
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return { key, mocked: false };
}

async function remove(bucketKey, key) {
  if (!configured) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: r2.buckets[bucketKey], Key: key }));
}

/** @returns {Promise<string>} a short-lived presigned GET URL, or a recognisable mock URL */
async function presignedUrl(bucketKey, key) {
  if (!configured || !key) {
    return `https://mock-r2.tcos.app/${r2.buckets[bucketKey]}/${key || "placeholder"}`;
  }
  const command = new GetObjectCommand({ Bucket: r2.buckets[bucketKey], Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: r2.presignTtlSeconds });
}

module.exports = { buildKey, upload, remove, presignedUrl, configured };
