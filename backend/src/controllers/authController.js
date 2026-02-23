const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, getClient } = require('../config/database');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../middleware/auth');
const { createAuditLog } = require('../services/auditService');
const logger = require('../utils/logger');
const env = require('../config/environment');

async function studentLogin(req, res) {
  try {
    const { student_number, password } = req.body;

    if (!student_number || !password) {
      return res.status(400).json({
        error: 'Student number and password are required',
      });
    }

    const result = await query(
      `SELECT student_id, student_number, first_name, last_name, email,
              phone, password_hash, status
       FROM students
       WHERE student_number = $1`,
      [student_number]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Student number or password is incorrect',
      });
    }

    const student = result.rows[0];

    if (student.status !== 'active') {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Contact administration.',
      });
    }

    const isValidPassword = await bcrypt.compare(password, student.password_hash);

    if (!isValidPassword) {
      await createAuditLog({
        user_id: student.student_id,
        user_type: 'student',
        action: 'LOGIN_FAILED',
        details: { reason: 'Invalid password' },
        ip_address: req.ip,
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Student number or password is incorrect',
      });
    }

    const accessToken = generateAccessToken({
      userId: student.student_id,
      type: 'student',
      role: 'student',
    });

    const refreshToken = generateRefreshToken({
      userId: student.student_id,
      type: 'student',
    });

    await createAuditLog({
      user_id: student.student_id,
      user_type: 'student',
      action: 'LOGIN_SUCCESS',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    logger.info(`Student logged in: ${student.student_number}`);

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
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Contact IT department.',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      await createAuditLog({
        user_id: user.user_id,
        user_type: user.role,
        action: 'LOGIN_FAILED',
        details: { reason: 'Invalid password' },
        ip_address: req.ip,
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect',
      });
    }

    const accessToken = generateAccessToken({
      userId: user.user_id,
      type: 'staff',
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.user_id,
      type: 'staff',
      role: user.role,
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

    const password_hash = await bcrypt.hash(password, 12);
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

    const decoded = jwt.verify(refreshToken, env.JWT_SECRET);

    const newAccessToken = generateAccessToken({
      userId: decoded.userId,
      type: decoded.type,
      role: decoded.role,
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
  studentRegister,
  refreshAccessToken,
  me,
};
