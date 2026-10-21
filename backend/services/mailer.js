const nodemailer = require('nodemailer');

let transport;

const isConfigured = () => Boolean(process.env.SMTP_HOST);

const getTransport = () => {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      // true for port 465; STARTTLS is negotiated automatically on 587.
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transport;
};

/**
 * Sends a plain-text email. Does nothing when SMTP isn't configured, and
 * never throws: a failed notification must not fail the action behind it.
 * Resolves to true when the message was handed to the SMTP server.
 */
const sendMail = async ({ to, subject, text }) => {
  if (!isConfigured() || !to || (Array.isArray(to) && to.length === 0)) return false;

  try {
    await getTransport().sendMail({
      from: process.env.MAIL_FROM || 'forHumanity <no-reply@localhost>',
      to,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error(
      JSON.stringify({ level: 'error', type: 'mail_failed', subject, message: err.message })
    );
    return false;
  }
};

module.exports = { sendMail, isConfigured };
