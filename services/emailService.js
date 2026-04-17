/**
 * Email Service
 * Handles sending notifications via email (SendGrid / Nodemailer)
 */
const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialize email transporter
 */
const initTransporter = () => {
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your-sendgrid-key') {
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  } else if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
};

/**
 * Send an email
 */
const sendEmail = async (to, subject, html) => {
  if (!transporter) initTransporter();
  if (!transporter) {
    console.log(`📧 [Email Simulation] To: ${to} | Subject: ${subject}`);
    return { simulated: true };
  }

  try {
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@financetracker.com',
      to,
      subject,
      html,
    });
    return result;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return { error: err.message };
  }
};

/**
 * Send budget alert email
 */
const sendBudgetAlert = async (user, budget, spent, categoryName) => {
  const percentage = Math.round((spent / budget.amount) * 100);
  const subject = `⚠️ Budget Alert: ${categoryName} at ${percentage}%`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;color:#e2e8f0;padding:32px;border-radius:12px;">
      <h1 style="color:#f59e0b;margin-bottom:16px;">⚠️ Budget Alert</h1>
      <p>Hi ${user.name},</p>
      <p>Your spending in <strong>${categoryName}</strong> has reached <strong>${percentage}%</strong> of your budget.</p>
      <div style="background:#16213e;padding:16px;border-radius:8px;margin:16px 0;">
        <p>💰 Budget: ${user.default_currency} ${parseFloat(budget.amount).toFixed(2)}</p>
        <p>💸 Spent: ${user.default_currency} ${parseFloat(spent).toFixed(2)}</p>
        <p>📊 Remaining: ${user.default_currency} ${(budget.amount - spent).toFixed(2)}</p>
      </div>
      <p style="color:#94a3b8;font-size:14px;">— Personal Finance Tracker</p>
    </div>
  `;
  return sendEmail(user.email, subject, html);
};

/**
 * Send anomaly alert email
 */
const sendAnomalyAlert = async (user, transaction, reason) => {
  const subject = `🔔 Unusual Transaction Detected`;
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#1a1a2e;color:#e2e8f0;padding:32px;border-radius:12px;">
      <h1 style="color:#ef4444;margin-bottom:16px;">🔔 Anomaly Detected</h1>
      <p>Hi ${user.name},</p>
      <p>We detected an unusual transaction on your account:</p>
      <div style="background:#16213e;padding:16px;border-radius:8px;margin:16px 0;">
        <p>💸 Amount: ${transaction.currency} ${parseFloat(transaction.amount).toFixed(2)}</p>
        <p>📝 Description: ${transaction.description || 'N/A'}</p>
        <p>📅 Date: ${transaction.date}</p>
        <p>⚠️ Reason: ${reason}</p>
      </div>
      <p style="color:#94a3b8;font-size:14px;">— Personal Finance Tracker</p>
    </div>
  `;
  return sendEmail(user.email, subject, html);
};

module.exports = { sendEmail, sendBudgetAlert, sendAnomalyAlert, initTransporter };
