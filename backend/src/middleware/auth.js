const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const env = require('../config/environment');

const JWT_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
const REFRESH_TOKEN_EXPIRES_IN = env.REFRESH_TOKEN_EXPIRES_IN;

function generateAccessToken(payload) {
  return jwt.sign(
    { ...payload, typ: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function generateRefreshToken(payload) {
  return jwt.sign(
    {
      userId: payload.userId,
      type: payload.type,
      typ: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

function verifyAccessToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.typ && decoded.typ !== 'access') {
    const err = new Error('Invalid token type');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  if (decoded.typ !== 'refresh') {
    const err = new Error('Invalid refresh token type');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}

async function loadUserFromToken(decoded) {
  if (decoded.type === 'student') {
    const result = await query(
      `SELECT student_id, student_number, first_name, last_name, email, phone, status,
              date_of_birth, department, program, current_semester, current_term, profile_picture_url
       FROM students WHERE student_id = $1`,
      [decoded.userId]
    );
    return result.rows[0]
      ? { ...result.rows[0], role: 'student', type: 'student' }
      : null;
  }

  const result = await query(
    `SELECT user_id, username, email, role, full_name, status, employee_id
     FROM users WHERE user_id = $1`,
    [decoded.userId]
  );
  return result.rows[0]
    ? { ...result.rows[0], type: 'staff' }
    : null;
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Access token required',
      message: 'Please provide a valid authentication token',
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await loadUserFromToken(decoded);

    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact administration.',
      });
    }

    // Always prefer role from DB (never trust JWT role claim alone)
    req.user = {
      userId: decoded.userId,
      type: decoded.type || user.type,
      role: user.role || (decoded.type === 'student' ? 'student' : undefined),
      student_id: user.student_id,
      ...user,
    };

    logger.debug(`User authenticated: ${req.user.type} ${decoded.userId}`);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid',
      });
    }
    logger.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.type === 'student' ? 'student' : req.user.role;

    if (!allowedRoles.includes(userRole)) {
      logger.warn(`Unauthorized access attempt: ${userRole} tried to access ${req.path}`);
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to perform this action',
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
};
