const nodemailer = require("nodemailer");
const { email, emailKeys } = require("../config/init");
const logger = require("./Logger.util");

/**
 * Real SMTP email — deliberately decoupled from MOCK_MODE, same reasoning as R2.util.js:
 * whether an email actually gets sent is a separate concern from whether app *data* is real.
 * Plain SMTP (not a specific vendor SDK) so any provider works — Gmail, SendGrid, Mailgun,
 * Resend, Office365, whatever the team already has — by just filling in SMTP_HOST/PORT/USER/
 * SMTP_PASSWORD in .env. Falls back to `configured: false` and does nothing when they're
 * unset, so local dev without email credentials never crashes; callers decide the fallback
 * behavior (see Auth.helper.js's forgotPassword, which logs the link instead).
 */
const configured = Boolean(email.host && emailKeys.user && emailKeys.password);
if (!configured) {
  logger.warn("Email not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — password reset links will be logged instead of emailed.");
}

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: email.host,
    port: email.port,
    secure: email.port === 465,
    auth: { user: emailKeys.user, pass: emailKeys.password },
  });
  return transporter;
}

/** @param {{to: string, subject: string, html: string}} message */
async function sendMail({ to, subject, html }) {
  if (!configured) throw new Error("Email.sendMail called while not configured — check `configured` first.");
  await getTransporter().sendMail({ from: email.from, to, subject, html });
}

module.exports = { configured, sendMail };
