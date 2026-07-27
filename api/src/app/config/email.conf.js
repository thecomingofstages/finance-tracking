const port = Number(process.env.SMTP_PORT) || 587;

module.exports = {
  host: process.env.SMTP_HOST || "",
  port,
  // Explicit SMTP_SECURE wins when set; otherwise infer from port (465 = implicit TLS, 587 =
  // STARTTLS). Most providers (Gmail included) want 587/false.
  secure: process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : port === 465,
  from: process.env.EMAIL_FROM || "TCOS Finance <no-reply@tcos.app>",
};
