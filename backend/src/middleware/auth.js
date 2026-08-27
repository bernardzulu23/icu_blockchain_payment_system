const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const env = require('../config/environment');
const {
  verifyAccessToken: verifyAccessTokenStrict,
  verifyRefreshToken: verifyRefreshTokenStrict,
  extractAccessToken,
  signAccessToken,
  signRefreshToken,
} = require('./auth-hardening');

const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
const REFRESH_TOKEN_EXPIRES_IN = env.REFRESH_TOKEN_EXPIRES_IN;

function generateAccessToken(payload) {
  return signAccessToken({
    id: payload.userId,
    role: payload.role,
    type: payload.type,
    tokenVersion: payload.tokenVersion ?? 0,
  });
}

function generateRefreshToken(payload) {
  return signRefreshToken({
    id: payload.userId,
    type: payload.type,
    tokenVersion: payload.tokenVersion ?? 0,
  });
}

function verifyAccessToken(token) {
  return verifyAccessTokenStrict(token);
}

function verifyRefreshToken(token) {
  return verifyRefreshTokenStrict(token);
}

async function loadUserFromToken(decoded) {
  const userId = decoded.userId || decoded.sub;

  if (decoded.type === 'student') {
    const result = await query(
      `SELECT student_id, student_number, first_name, last_name, email, phone, status,
              date_of_birth, department, program, current_semester, current_term,
              profile_picture_url, token_version
       FROM students WHERE student_id = $1`,
      [userId]
    );
    return result.rows[0]
      ? { ...result.rows[0], role: 'student', type: 'student' }
      : null;
  }

  const result = await query(
    `SELECT user_id, username, email, role, full_name, status, employee_id, token_version
     FROM users WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]
    ? { ...result.rows[0], type: 'staff' }
    : null;
}

async function authenticateToken(req, res, next) {
  const token = extractAccessToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await loadUserFromToken(decoded);

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact administration.',
      });
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    const dbVersion = user.token_version ?? 0;
    if (tokenVersion !== dbVersion) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    const userId = decoded.userId || decoded.sub;
    req.user = {
      userId,
      type: decoded.type || user.type,
      role: user.role || (decoded.type === 'student' ? 'student' : undefined),
      student_id: user.student_id,
      tokenVersion: dbVersion,
      ...user,
    };

    logger.debug(`User authenticated: ${req.user.type} ${userId}`);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const userRole = req.user.type === 'student' ? 'student' : req.user.role;

    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Unauthorized access attempt: ${userRole} tried to access ${req.path}`);
      return res.status(403).json({
        error: 'You do not have permission to perform this action.',
      });
    }

    next();
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  loadUserFromToken,
  authenticateToken,
  authorize,
  extractAccessToken,
};
