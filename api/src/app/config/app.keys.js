const crypto = require("node:crypto");
const { mockMode } = require("./app.conf");

let privateKey = process.env.JWT_PRIVATE_KEY;
let publicKey = process.env.JWT_PUBLIC_KEY;

if ((!privateKey || !publicKey) && mockMode) {
  // Dev convenience only — see .env.example. Tokens signed with this pair don't survive a
  // restart, which is fine for local FE development against mock data, and is exactly why
  // this fallback is gated behind mockMode instead of running unconditionally.
  const pair = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
  // eslint-disable-next-line no-console
  console.warn(
    "[app.keys] JWT_PRIVATE_KEY/JWT_PUBLIC_KEY not set — generated an ephemeral RSA keypair " +
      "for this process only (MOCK_MODE=true). Set real keys before deploying anywhere shared."
  );
} else if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, "\n");
  publicKey = publicKey.replace(/\\n/g, "\n");
}

module.exports = {
  jwtPrivateKey: privateKey,
  jwtPublicKey: publicKey,
  jwtAccessTtl: Number(process.env.JWT_ACCESS_TTL) || 900,
  jwtRefreshTtl: Number(process.env.JWT_REFRESH_TTL) || 604800,
  reauthTtl: Number(process.env.REAUTH_TTL) || 300,
  hmacSecret: process.env.HMAC_SECRET || "",
  serviceTokens: {
    enroll: process.env.SERVICE_TOKEN_ENROLL || "",
    merch: process.env.SERVICE_TOKEN_MERCH || "",
  },
};
