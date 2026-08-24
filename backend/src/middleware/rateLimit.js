const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV !== 'production';

/** Vercel / proxies send X-Forwarded-For; avoid ERL validation crashes */
const shared = {
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 200,
  message: { error: 'Too many requests', message: 'Please try again later.' },
  ...shared,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 15,
  message: { error: 'Too many login attempts', message: 'Please try again later.' },
  ...shared,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 50 : 5,
  message: { error: 'Too many reset requests', message: 'Please try again later.' },
  ...shared,
});

const publicCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 30,
  message: { error: 'Too many requests', message: 'Please try again later.' },
  ...shared,
});

module.exports = { apiLimiter, authLimiter, forgotPasswordLimiter, publicCheckLimiter };
