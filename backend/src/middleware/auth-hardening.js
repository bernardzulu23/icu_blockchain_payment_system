/**
 * ICU Pay — Authentication & Authorization Hardening
 * JWT (15m), bcrypt (12 rounds), RBAC helpers, login rate limit, lockout checks.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const env = require('../config/environment');

const BCRYPT_ROUNDS = env.BCRYPT_ROUNDS;
const ACCESS_TOKEN_TTL = env.JWT_EXPIRES_IN;
const REFRESH_TOKEN_TTL = env.REFRESH_TOKEN_EXPIRES_IN;
const JWT_ACCESS_SECRET = env.JWT_SECRET;
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const JWT_VERIFY_OPTS = {
  issuer: 'icu-pay',
  audience: 'icu-pay-client',
};

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

async function verifyPassword(plainPassword, storedHash) {
  if (!storedHash) return false;
  return bcrypt.compare(plainPassword, storedHash);
}

function isPasswordStrong(password) {
  const value = String(password || '');
  const minLength = 12;
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return value.length >= minLength && hasUpper && hasLower && hasDigit && hasSymbol;
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      role: user.role,
      type: user.type,
      tokenVersion: user.tokenVersion ?? 0,
      typ: 'access',
    },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL, ...JWT_VERIFY_OPTS }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      type: user.type,
      tokenVersion: user.tokenVersion ?? 0,
      typ: 'refresh',
    },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL, ...JWT_VERIFY_OPTS }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_ACCESS_SECRET, JWT_VERIFY_OPTS);
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_REFRESH_SECRET, JWT_VERIFY_OPTS);
  if (decoded.typ && decoded.typ !== 'refresh') {
    const err = new Error('Invalid refresh token type');
    err.name = 'JsonWebTokenError';
    throw err;
  }
  return decoded;
}

/** Prefer httpOnly cookie; fall back to Authorization header for existing SPA clients. */
function extractAccessToken(req) {
  if (req.cookies?.access_token) return req.cookies.access_token;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function requireAuth(req, res, next) {
  const token = extractAccessToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub || payload.userId,
      userId: payload.sub || payload.userId,
      role: payload.role,
      type: payload.type,
      tokenVersion: payload.tokenVersion ?? 0,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const role = req.user.type === 'student' ? 'student' : req.user.role;
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

const isDev = env.NODE_ENV !== 'production';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req) => {
    const id = String(
      req.body?.loginId ||
        req.body?.identifier ||
        req.body?.username ||
        req.body?.email ||
        req.body?.student_number ||
        ''
    ).toLowerCase();
    return `${req.ip}:${id}`;
  },
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

function isAccountLocked(user) {
  const attempts = user?.failed_attempts ?? user?.failedAttempts ?? 0;
  const lockedAt = user?.locked_at ?? user?.lockedAt;
  return (
    attempts >= MAX_FAILED_ATTEMPTS &&
    lockedAt &&
    Date.now() - new Date(lockedAt).getTime() < LOCKOUT_DURATION_MS
  );
}

function authCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  };
}

/** Optional — enable when frontend stops using localStorage for JWT. */
function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('access_token', accessToken, authCookieOptions(15 * 60 * 1000));
  if (refreshToken) {
    res.cookie('refresh_token', refreshToken, authCookieOptions(7 * 24 * 60 * 60 * 1000));
  }
}

function clearAuthCookies(res) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });
}

const INVALID_CREDENTIALS_RESPONSE = {
  error: 'Invalid credentials',
  message: 'Username or password is incorrect',
};

const LOCKOUT_RESPONSE = {
  error: 'Too many login attempts',
  message: 'Please try again in 15 minutes.',
};

module.exports = {
  BCRYPT_ROUNDS,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  hashPassword,
  verifyPassword,
  isPasswordStrong,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractAccessToken,
  requireAuth,
  requireRole,
  loginLimiter,
  isAccountLocked,
  setAuthCookies,
  clearAuthCookies,
  INVALID_CREDENTIALS_RESPONSE,
  LOCKOUT_RESPONSE,
};
