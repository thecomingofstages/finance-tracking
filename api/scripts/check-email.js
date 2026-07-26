#!/usr/bin/env node
/** Connectivity smoke test for the configured SMTP account — verifies the transporter and
 *  optionally sends a real test email. Doesn't print secrets.
 *  Usage: node scripts/check-email.js [send-to@address]
 */
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });
const nodemailer = require("nodemailer");

async function main() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    console.log("Email not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — nothing to check.");
    console.log("Password reset currently falls back to logging the reset link — see Auth.helper.js.");
    return;
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const from = process.env.EMAIL_FROM || "TCOS Finance <no-reply@tcos.app>";
  console.log("Host:", host, "Port:", port, "From:", from);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.verify();
  console.log("SMTP login OK.");

  const sendTo = process.argv[2];
  if (sendTo) {
    await transporter.sendMail({
      from,
      to: sendTo,
      subject: "TCOS Finance — SMTP test",
      html: "<p>If you're reading this, SMTP is wired up correctly.</p>",
    });
    console.log("Test email sent to", sendTo);
  } else {
    console.log("No recipient given — skipping an actual send. Run again with an email address to send a real test message.");
  }
}

main().catch((err) => {
  console.error("Email connectivity FAILED:", err.name, err.message);
  process.exit(1);
});
