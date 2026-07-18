const axios = require('axios');
const logger = require('../utils/logger');
const { pool } = require('../config/database');

const AFRICASTALKING_USERNAME = process.env.AFRICASTALKING_USERNAME;
const AFRICASTALKING_API_KEY = process.env.AFRICASTALKING_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@icu.edu.zm';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM_EMAIL || 'noreply@icu.edu.zm';

async function sendSms(to, message) {
  if (!AFRICASTALKING_USERNAME || !AFRICASTALKING_API_KEY) {
    logger.warn("Africa's Talking not configured, skipping SMS");
    return false;
  }
  try {
    const params = new URLSearchParams({
      username: AFRICASTALKING_USERNAME,
      to: to.replace(/^0/, '+260'),
      message,
    });
    await axios.post('https://api.africastalking.com/version1/messaging', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apiKey: AFRICASTALKING_API_KEY,
      },
    });
    return true;
  } catch (err) {
    logger.error('SMS send failed:', err);
    return false;
  }
}

async function sendEmail(to, subject, html) {
  try {
    if (RESEND_API_KEY) {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: RESEND_FROM,
          to: [to],
          subject,
          html,
        },
        {
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      return true;
    }

    if (!SENDGRID_API_KEY) {
      logger.warn('Email not configured (set RESEND_API_KEY or SENDGRID_API_KEY), skipping email');
      return false;
    }

    await axios.post(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: SENDGRID_FROM, name: 'ICU Payment System' },
        subject,
        content: [{ type: 'text/html', value: html }],
      },
      {
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return true;
  } catch (err) {
    logger.error('Email send failed:', err?.message || err);
    return false;
  }
}

async function sendPasswordResetLinkSms(phone, resetUrl) {
  if (!phone) return false;
  const msg = `ICU Payment System: reset your password using this link: ${resetUrl} (valid 1 hour). If you did not request this, ignore this message.`;
  return await sendSms(phone, msg);
}

async function sendPasswordResetConfirmation({ email, phone, name, securityUrl }) {
  const who = name ? `Hi ${name}, ` : '';
  const msg = `${who}your ICU Payment System password was changed. If you did not request this, reset it immediately here: ${securityUrl}`;
  const html = `<p>${who}your ICU Payment System password was changed.</p><p>If you did not request this, reset it immediately here: <a href="${securityUrl}">${securityUrl}</a></p>`;
  const results = { emailSent: false, smsSent: false };
  if (email) results.emailSent = await sendEmail(email, 'Password Changed - ICU Payment System', html);
  if (phone) results.smsSent = await sendSms(phone, msg);
  return results;
}

async function sendNotification({
  recipient_id,
  recipient_type,
  type,
  title,
  message,
  channels = ['email'],
  proofPdfUrl = null,
}) {
  let emailSent = false;
  let smsSent = false;
  try {
    if (recipient_type === 'student') {
      const { rows } = await pool.query(
        'SELECT email, phone FROM students WHERE student_id = $1',
        [recipient_id]
      );
      const student = rows[0];
      if (!student) return false;
      let emailBody = `<p>${message}</p>`;
      if (proofPdfUrl) {
        const baseUrl = process.env.API_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
        const proofLink = `${baseUrl.replace(/\/$/, '')}${proofPdfUrl}`;
        emailBody += `<p>Your proof-of-no-balance document (PDF) is available at: <a href="${proofLink}">Download proof document</a>. Open the PDF with your student number as the password.</p>`;
      }
      if (channels.includes('email') && student.email) {
        emailSent = await sendEmail(student.email, title, emailBody);
      }
      if (channels.includes('sms') && student.phone) {
        smsSent = await sendSms(student.phone, message);
      }
    } else if (recipient_type === 'user') {
      const { rows } = await pool.query(
        'SELECT email FROM users WHERE user_id = $1',
        [recipient_id]
      );
      const user = rows[0];
      if (!user) return false;
      if (channels.includes('email') && user.email) {
        emailSent = await sendEmail(user.email, title, `<p>${message}</p>`);
      }
    }

    const Notification = require('../models/Notification');
    await Notification.create({
      recipientId: recipient_id,
      recipientType: recipient_type,
      notificationType: type,
      title,
      message,
      sentViaEmail: emailSent,
      sentViaSms: smsSent,
    });

    return emailSent || smsSent || true;
  } catch (err) {
    logger.error('Send notification failed:', err);
    return false;
  }
}

async function notifyPaymentVerified(studentEmail, studentPhone, studentName, amount, reference) {
  const msg = `Your payment of ${amount} ZMW (ref: ${reference}) has been verified. ICU Payment System.`;
  await sendEmail(
    studentEmail,
    'Payment Verified - ICU',
    `<p>Dear ${studentName},</p><p>${msg}</p><p>Records are stored on blockchain for permanent verification.</p>`
  );
  if (studentPhone) await sendSms(studentPhone, msg);
}

async function sendPaymentVerified({
  email,
  phone,
  fullName,
  semester,
  academicYear,
  amount,
  statementPdfUrl,
}) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const statementLink = statementPdfUrl ? `${baseUrl}${statementPdfUrl}` : 'the dashboard';
  const msg = `Your payment for ${semester}, ${academicYear} (K${amount}) has been verified and recorded on blockchain. Download your statement from ${statementLink}. ICU Payment System.`;
  if (email) {
    await sendEmail(
      email,
      'Payment Verified - ICU',
      `<p>Dear ${fullName},</p><p>Your payment for ${semester}, ${academicYear} (K${amount}) has been verified and recorded on blockchain.</p><p>Download your statement from the dashboard.</p><p>Records are stored on blockchain for permanent verification.</p>`
    );
  }
  if (phone) await sendSms(phone, msg);
  return true;
}

/**
 * Notify all accountant and admin users that there are pending payment verifications.
 * Call when a student uploads a deposit slip.
 */
async function notifyAccountantsPendingVerification({ studentId, studentName, semester, academicYear, amount, countPending }) {
  try {
    const { rows } = await pool.query(
      `SELECT user_id, email, full_name FROM users WHERE role IN ('accountant', 'admin') AND status = 'active'`
    );
    const title = 'Pending payment verification';
    const message = countPending > 1
      ? `There are ${countPending} pending payment(s) awaiting verification. Latest: ${studentName || studentId} - ${semester}/${academicYear} (K${amount}). Please log in to verify.`
      : `A new payment has been submitted for verification: ${studentName || studentId} - ${semester}/${academicYear} (K${amount}). Please log in to verify.`;

    for (const user of rows) {
      if (user.email) {
        await sendEmail(user.email, title, `<p>${message}</p><p>ICU Payment System</p>`);
      }
    }
    return true;
  } catch (err) {
    logger.error('Notify accountants failed:', err);
    return false;
  }
}

module.exports = {
  sendSms,
  sendEmail,
  sendPasswordResetLinkSms,
  sendPasswordResetConfirmation,
  sendNotification,
  notifyPaymentVerified,
  sendPaymentVerified,
  notifyAccountantsPendingVerification,
};
