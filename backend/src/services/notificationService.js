const axios = require('axios');
const logger = require('../utils/logger');
const { pool } = require('../config/database');

const AFRICASTALKING_USERNAME = process.env.AFRICASTALKING_USERNAME;
const AFRICASTALKING_API_KEY = process.env.AFRICASTALKING_API_KEY;
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
  if (!SENDGRID_API_KEY) {
    logger.warn('SendGrid not configured, skipping email');
    return false;
  }
  try {
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
      }
    );
    return true;
  } catch (err) {
    logger.error('Email send failed:', err);
    return false;
  }
}

async function sendNotification({
  recipient_id,
  recipient_type,
  type,
  title,
  message,
  channels = ['email'],
}) {
  try {
    if (recipient_type === 'student') {
      const { rows } = await pool.query(
        'SELECT email, phone FROM students WHERE student_id = $1',
        [recipient_id]
      );
      const student = rows[0];
      if (!student) return false;
      if (channels.includes('email') && student.email) {
        await sendEmail(student.email, title, `<p>${message}</p>`);
      }
      if (channels.includes('sms') && student.phone) {
        await sendSms(student.phone, message);
      }
    } else if (recipient_type === 'user') {
      const { rows } = await pool.query(
        'SELECT email FROM users WHERE user_id = $1',
        [recipient_id]
      );
      const user = rows[0];
      if (!user) return false;
      if (channels.includes('email') && user.email) {
        await sendEmail(user.email, title, `<p>${message}</p>`);
      }
    }
    return true;
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

module.exports = { sendSms, sendEmail, sendNotification, notifyPaymentVerified };
