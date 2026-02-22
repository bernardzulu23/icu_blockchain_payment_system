const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const env = require('../config/environment');

const JWT_SECRET = env.JWT_SECRET;
const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN;
const REFRESH_TOKEN_EXPIRES_IN = env.REFRESH_TOKEN_EXPIRES_IN;

function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
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
    const decoded = jwt.verify(token, JWT_SECRET);

    let user;
    if (decoded.type === 'student') {
      const result = await query(
        `SELECT student_id, student_number, first_name, last_name, email, phone, status,
                date_of_birth, department, program, current_semester, current_term, profile_picture_url
         FROM students WHERE student_id = $1`,
        [decoded.userId]
      );
      user = result.rows[0];
    } else {
      const result = await query(
        `SELECT user_id, username, email, role, full_name, status
         FROM users WHERE user_id = $1`,
        [decoded.userId]
      );
      user = result.rows[0];
    }

    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact administration.',
      });
    }

    req.user = {
      userId: decoded.userId,
      type: decoded.type,
      role: decoded.role || (decoded.type === 'student' ? 'student' : user.role),
      ...user,
    };

    logger.info(`User authenticated: ${decoded.type} ${decoded.userId}`);
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
        required: allowedRoles,
        current: userRole,
      });
    }

    next();
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  authenticateToken,
  authorize,
};
