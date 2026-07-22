#!/usr/bin/env node
/** Connectivity smoke test for the configured R2 account — lists buckets and checks that the
 *  two buckets this app expects (R2_BUCKET_RECEIPTS/SIGNATURES) exist. Doesn't print secrets. */
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const { S3Client, ListBucketsCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");

async function main() {
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    console.log("R2 not configured (missing endpoint/access key/secret) — nothing to check.");
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  console.log("Endpoint:", process.env.R2_ENDPOINT);
  const list = await client.send(new ListBucketsCommand({}));
  console.log(
    "Connected. Buckets in account:",
    (list.Buckets || []).map((b) => b.Name)
  );

  for (const name of [process.env.R2_BUCKET_RECEIPTS, process.env.R2_BUCKET_SIGNATURES]) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: name }));
      console.log(`  ✓ bucket exists: ${name}`);
    } catch (err) {
      console.log(`  ✗ bucket missing: ${name} (${err.name})`);
    }
  }
}

main().catch((err) => {
  console.error("R2 connectivity FAILED:", err.name, err.message);
  process.exit(1);
});
