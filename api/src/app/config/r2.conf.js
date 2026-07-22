module.exports = {
  endpoint: process.env.R2_ENDPOINT || "",
  region: "auto",
  buckets: {
    receipts: process.env.R2_BUCKET_RECEIPTS || "finance-receipts",
    signatures: process.env.R2_BUCKET_SIGNATURES || "finance-signatures",
  },
  presignTtlSeconds: 300,
};
