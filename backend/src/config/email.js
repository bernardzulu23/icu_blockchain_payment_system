const axios = require('axios');
const env = require('./environment');

async function sendResetEmail(email, resetUrl) {
  if (!env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM is not set');
  }
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0b1220; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
        <h2>Password Reset Request</h2>
      </div>

      <div style="background-color: #f5f5f5; padding: 30px; border-radius: 0 0 10px 10px;">
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the button below to proceed:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}"
             style="background-color: #38bdf8; color: #0b1220; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
            Reset Password
          </a>
        </div>

        <p style="color: #666; font-size: 12px;">
          Or copy this link in your browser: <br>
          <code style="background-color: white; padding: 5px; border-radius: 3px;">${resetUrl}</code>
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

        <p style="color: #999; font-size: 12px;">
          This link expires in 1 hour. If you did not request a password reset, please ignore this email.
        </p>
      </div>
    </div>
  `;

  await axios.post(
    'https://api.resend.com/emails',
    {
      from: env.EMAIL_FROM,
      to: [email],
      subject: 'Reset Your Password - ICU Payment System',
      html,
    },
    {
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  );
  return true;
}

module.exports = { sendResetEmail };
