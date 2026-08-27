const { hashPassword, isPasswordStrong } = require('../utils/password');
const { query, getClient } = require('../config/database');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const { createAuditLog } = require('../services/auditService');
const {
  checkLoginAllowed,
  recordFailedLogin,
  resetLoginFailures,
  INVALID_CREDENTIALS_RESPONSE,
} = require('../services/loginSecurity');
const logger = require('../utils/logger');
const env = require('../config/environment');
const crypto = require('crypto');
const { sendResetEmail } = require('../config/email');
const { sendPasswordResetLinkSms, sendPasswordResetConfirmation } = require('../services/notificationService');
const { attachCsrfCookie } = require('../middleware/csrf');

async function studentLogin(req, res) {
  try {
    const { student_number, email, password, identifier: rawIdentifier } = req.body;
    const identifier = String(rawIdentifier || student_number || email || '')
      .trim()
      .toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        error: 'Email or student number and password are required',
        message: 'Use the email and password created by the administrator',
      });
    }

    const result = await query(
      `SELECT student_id, student_number, first_name, last_name, email,
              phone, password_hash, status, failed_attempts, locked_at, token_version
       FROM students
       WHERE status = 'active'
         AND (
           LOWER(TRIM(student_number)) = $1
           OR LOWER(TRIM(COALESCE(email, ''))) = $1
           OR LOWER(TRIM(student_id)) = $1
         )`,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);
    }

    const student = result.rows[0];

    const lockCheck = await checkLoginAllowed('student', student.student_id);
    if (!lockCheck.allowed) {
      return res.status(lockCheck.status).json(lockCheck.body);
    }

    if (student.status !== 'active') {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Contact administration.',
      });
    }

    if (!student.password_hash) {
      return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);
    }

    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(password, student.password_hash);

    if (!isValidPassword) {
      await recordFailedLogin('student', student.student_id);
      await createAuditLog({
        user_id: student.student_id,
        user_type: 'student',
        action: 'LOGIN_FAILED',
        details: { reason: 'Invalid password' },
        ip_address: req.ip,
      });

      return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);
    }

    await resetLoginFailures('student', student.student_id);

    const accessToken = generateAccessToken({
      userId: student.student_id,
      type: 'student',
      role: 'student',
      tokenVersion: lockCheck.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      userId: student.student_id,
      type: 'student',
      tokenVersion: lockCheck.tokenVersion,
    });

    await createAuditLog({
      user_id: student.student_id,
      user_type: 'student',
      action: 'LOGIN_SUCCESS',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info(`Student logged in: ${student.student_number}`);

    attachCsrfCookie(res);
    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      token: accessToken,
      user: {
        id: student.student_id,
        student_id: student.student_id,
        student_number: student.student_number,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        phone: student.phone,
        type: 'student',
        name: `${student.first_name} ${student.last_name}`.trim(),
        role: 'student',
      },
    });
  } catch (error) {
    logger.error('Student login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

async function unifiedLogin(req, res) {
  try {
    const identifier = String(
      req.body.identifier || req.body.username || req.body.email || req.body.student_number || ''
    ).trim();
    const { password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        error: 'Credentials required',
        message: 'Email / student number / employee ID and password are required',
      });
    }

    // Prefer staff match first (admin, accountant, registrar), then student
    req.body.username = identifier;
    const staffUser =
      (await User.findByUsername(identifier)) ||
      (identifier.includes('@') ? await User.findByEmail(identifier) : null) ||
      (await User.findByEmployeeId(identifier));

    if (staffUser) {
      return staffLogin(req, res);
    }

    req.body.student_number = identifier;
    return studentLogin(req, res);
  } catch (error) {
    logger.error('Unified login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

async function staffLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
      });
    }

    let user = await User.findByUsername(username);
    if (!user && username.includes('@')) {
      user = await User.findByEmail(username);
    }
    if (!user) {
      user = await User.findByEmployeeId(username);
    }

    if (!user) {
      return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);
    }

    const lockCheck = await checkLoginAllowed('staff', user.user_id);
    if (!lockCheck.allowed) {
      return res.status(lockCheck.status).json(lockCheck.body);
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Contact IT department.',
      });
    }

    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      await recordFailedLogin('staff', user.user_id);
      await createAuditLog({
        user_id: user.user_id,
        user_type: user.role,
        action: 'LOGIN_FAILED',
        details: { reason: 'Invalid password' },
        ip_address: req.ip,
      });

      return res.status(401).json(INVALID_CREDENTIALS_RESPONSE);
    }

    await resetLoginFailures('staff', user.user_id);

    const accessToken = generateAccessToken({
      userId: user.user_id,
      type: 'staff',
      role: user.role,
      tokenVersion: lockCheck.tokenVersion,
    });

    const refreshToken = generateRefreshToken({
      userId: user.user_id,
      type: 'staff',
      role: user.role,
      tokenVersion: lockCheck.tokenVersion,
    });

    await query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]);

    await createAuditLog({
      user_id: user.user_id,
      user_type: user.role,
      action: 'LOGIN_SUCCESS',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info(`Staff logged in: ${user.username} (${user.role})`);

    attachCsrfCookie(res);
    res.json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      token: accessToken,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        employee_id: user.employee_id,
        type: 'staff',
        name: user.full_name,
      },
    });
  } catch (error) {
    logger.error('Staff login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
}

async function studentRegister(req, res) {
  const client = await getClient();

  try {
    const {
      student_number,
      first_name,
      last_name,
      email,
      phone,
      program,
      admission_year,
      expected_graduation_year,
      password,
    } = req.body;

    if (!student_number || !first_name || !last_name || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['student_number', 'first_name', 'last_name', 'email', 'password'],
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long',
      });
    }

    await client.query('BEGIN');

    const existingCheck = await client.query(
      'SELECT student_id FROM students WHERE student_number = $1 OR email = $2',
      [student_number, email]
    );

    if (existingCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Student already exists',
        message: 'A student with this student number or email already exists',
      });
    }

    const password_hash = await hashPassword(password);
    const student_id = `STU${Date.now()}`;

    const insertResult = await client.query(
      `INSERT INTO students
       (student_id, student_number, first_name, last_name, email, phone,
        program, admission_year, expected_graduation_year, password_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
       RETURNING student_id, student_number, first_name, last_name, email, phone`,
      [
        student_id,
        student_number,
        first_name,
        last_name,
        email,
        phone || null,
        program || null,
        admission_year || null,
        expected_graduation_year || null,
        password_hash,
      ]
    );

    const newStudent = insertResult.rows[0];

    await createAuditLog({
      user_id: student_id,
      user_type: 'student',
      action: 'ACCOUNT_CREATED',
      entity_type: 'student',
      entity_id: student_id,
      ip_address: req.ip,
    });

    await client.query('COMMIT');

    logger.info(`New student registered: ${student_number}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful. You can now login.',
      student: {
        student_id: newStudent.student_id,
        student_number: newStudent.student_number,
        first_name: newStudent.first_name,
        last_name: newStudent.last_name,
        email: newStudent.email,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Student registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  } finally {
    client.release();
  }
}

async function refreshAccessToken(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const { verifyRefreshToken, loadUserFromToken, generateAccessToken } = require('../middleware/auth');
    const decoded = verifyRefreshToken(refreshToken);
    const user = await loadUserFromToken(decoded);

    if (!user || user.status !== 'active') {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const role = user.role || (decoded.type === 'student' ? 'student' : undefined);
    const newAccessToken = generateAccessToken({
      userId: decoded.userId || decoded.sub,
      type: decoded.type || user.type,
      role,
      tokenVersion: user.token_version ?? 0,
    });

    res.json({
      success: true,
      accessToken: newAccessToken,
      token: newAccessToken,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Refresh token expired',
        message: 'Please login again',
      });
    }
    logger.error('Token refresh error:', error);
    res.status(403).json({ error: 'Invalid refresh token' });
  }
}

async function forgotPassword(req, res) {
  const client = await getClient();
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const successResponse = {
      success: true,
      message: 'If this email exists in our system, you will receive a password reset link',
    };

    const userResult = await query(
      `SELECT user_id, email, role
       FROM users
       WHERE email = $1 AND status = 'active'`,
      [email]
    );
    const studentResult = userResult.rows.length
      ? { rows: [] }
      : await query(
          `SELECT student_id, email, phone
           FROM students
           WHERE email = $1 AND status = 'active'`,
          [email]
        );

    if (!userResult.rows[0] && !studentResult.rows[0]) {
      return res.json(successResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await client.query('BEGIN');

    if (userResult.rows[0]) {
      await client.query(
        `UPDATE users
         SET reset_token_hash = $1, reset_token_expires_at = $2
         WHERE user_id = $3`,
        [resetTokenHash, expiresAt, userResult.rows[0].user_id]
      );
    } else {
      await client.query(
        `UPDATE students
         SET reset_token_hash = $1, reset_token_expires_at = $2
         WHERE student_id = $3`,
        [resetTokenHash, expiresAt, studentResult.rows[0].student_id]
      );
    }

    const base = (env.FRONTEND_URL || '').replace(/\/$/, '') || 'http://localhost:5173';
    const resetUrl = `${base}/reset-password/${resetToken}`;

    try {
      await sendResetEmail(email, resetUrl);
      const studentPhone = studentResult.rows[0]?.phone;
      if (studentPhone) {
        await sendPasswordResetLinkSms(studentPhone, resetUrl);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Failed to send reset email:', err);
      return res.status(500).json({ success: false, error: 'Could not send reset email. Please try again.' });
    }

    await client.query('COMMIT');

    return res.json(successResponse);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
    }
    logger.error('Forgot password error:', error);
    return res.status(500).json({ success: false, error: 'Server error. Please try again later.' });
  } finally {
    client.release();
  }
}

async function resetPassword(req, res) {
  const client = await getClient();
  try {
    const token = typeof req.params.token === 'string' ? req.params.token : '';
    const { newPassword, confirmPassword } = req.body || {};

    if (!token) {
      return res.status(400).json({ success: false, error: 'Reset token is required' });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, error: 'Password fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }

    if (typeof newPassword !== 'string' || !isPasswordStrong(newPassword)) {
      return res.status(400).json({
        success: false,
        error:
          'Password must be at least 12 characters with upper, lower, digit, and symbol',
      });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT user_id, role
       FROM users
       WHERE reset_token_hash = $1
         AND reset_token_expires_at > NOW()
         AND status = 'active'
       LIMIT 1`,
      [resetTokenHash]
    );

    if (userResult.rows[0]) {
      const { rows: userContactRows } = await client.query(
        `SELECT email, full_name FROM users WHERE user_id = $1 LIMIT 1`,
        [userResult.rows[0].user_id]
      );
      const userContact = userContactRows[0] || {};
      const passwordHash = await hashPassword(newPassword);
      await client.query(
        `UPDATE users
         SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL,
             token_version = COALESCE(token_version, 0) + 1,
             failed_attempts = 0, locked_at = NULL
         WHERE user_id = $2`,
        [passwordHash, userResult.rows[0].user_id]
      );
      await createAuditLog({
        user_id: userResult.rows[0].user_id,
        user_type: userResult.rows[0].role,
        action: 'PASSWORD_RESET',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
      await client.query('COMMIT');
      const baseUrl = (env.FRONTEND_URL || '').replace(/\/$/, '') || 'http://localhost:5173';
      const securityUrl = `${baseUrl}/forgot-password`;
      await sendPasswordResetConfirmation({
        email: userContact.email,
        phone: null,
        name: userContact.full_name,
        securityUrl,
      });
      return res.json({ success: true, message: 'Password reset successful! You can now login.' });
    }

    const studentResult = await client.query(
      `SELECT student_id
       FROM students
       WHERE reset_token_hash = $1
         AND reset_token_expires_at > NOW()
         AND status = 'active'
       LIMIT 1`,
      [resetTokenHash]
    );

    if (!studentResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset link. Please request a new one.',
      });
    }

    const { rows: studentContactRows } = await client.query(
      `SELECT email, phone, first_name, last_name FROM students WHERE student_id = $1 LIMIT 1`,
      [studentResult.rows[0].student_id]
    );
    const studentContact = studentContactRows[0] || {};
    const studentName = `${studentContact.first_name || ''} ${studentContact.last_name || ''}`.trim();

    const passwordHash = await hashPassword(newPassword);
    await client.query(
      `UPDATE students
       SET password_hash = $1, reset_token_hash = NULL, reset_token_expires_at = NULL,
           token_version = COALESCE(token_version, 0) + 1,
           failed_attempts = 0, locked_at = NULL
       WHERE student_id = $2`,
      [passwordHash, studentResult.rows[0].student_id]
    );

    await createAuditLog({
      user_id: studentResult.rows[0].student_id,
      user_type: 'student',
      action: 'PASSWORD_RESET',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    await client.query('COMMIT');
    const baseUrl = (env.FRONTEND_URL || '').replace(/\/$/, '') || 'http://localhost:5173';
    const securityUrl = `${baseUrl}/forgot-password`;
    await sendPasswordResetConfirmation({
      email: studentContact.email,
      phone: studentContact.phone,
      name: studentName,
      securityUrl,
    });
    return res.json({ success: true, message: 'Password reset successful! You can now login.' });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
    }
    logger.error('Reset password error:', error);
    return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  } finally {
    client.release();
  }
}

async function me(req, res) {
  try {
    const u = req.user;
    const user = {
      id: u.user_id || u.userId || u.student_id,
      userId: u.user_id || u.userId || u.student_id,
      email: u.email,
      student_number: u.student_number,
      name: u.full_name || u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim(),
      role: u.role,
      type: u.type,
    };
    res.json(user);
  } catch (error) {
    logger.error('Me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
}

module.exports = {
  studentLogin,
  staffLogin,
  unifiedLogin,
  studentRegister,
  forgotPassword,
  resetPassword,
  refreshAccessToken,
  me,
};
