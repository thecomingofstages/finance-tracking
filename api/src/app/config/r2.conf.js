module.exports = {
  endpoint: process.env.R2_ENDPOINT || "",
  region: "auto",
  buckets: {
    receipts: process.env.R2_BUCKET_RECEIPTS || "finance-receipts",
    signatures: process.env.R2_BUCKET_SIGNATURES || "finance-signatures",
  },
  // 15 minutes, not 5. These URLs are handed to a browser to render a receipt or a signature
  // inline; at 300s a page left open for a few minutes silently turns into a broken image, and
  // anything that caches the URL (the frontend briefly did) caches a dead link. Overridable
  // because the right value is a trade between that and how long a leaked URL stays useful.
  presignTtlSeconds: Number(process.env.R2_PRESIGN_TTL_SECONDS) || 900,
};
