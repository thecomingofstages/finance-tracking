const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v7: uuidv7 } = require("uuid");
const { r2, r2Keys, app: appConf } = require("../config/init");

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
  if (appConf.mockMode) {
    return { key, mocked: true };
  }
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
  if (appConf.mockMode) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: r2.buckets[bucketKey], Key: key }));
}

/** @returns {Promise<string>} a short-lived presigned GET URL, or a recognisable mock URL */
async function presignedUrl(bucketKey, key) {
  if (appConf.mockMode || !key) {
    return `https://mock-r2.tcos.app/${r2.buckets[bucketKey]}/${key || "placeholder"}`;
  }
  const command = new GetObjectCommand({ Bucket: r2.buckets[bucketKey], Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: r2.presignTtlSeconds });
}

module.exports = { buildKey, upload, remove, presignedUrl };
