module.exports = {
  host: process.env.SMTP_HOST || "",
  port: Number(process.env.SMTP_PORT) || 587,
  from: process.env.EMAIL_FROM || "TCOS Finance <no-reply@tcos.app>",
};
