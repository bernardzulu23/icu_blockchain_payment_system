const express = require('express');
const morgan = require('morgan');

const errorHandler = require('./middleware/errorHandler');
const { applyServerHardening } = require('./middleware/server-hardening');
const { issueCsrfToken, verifyCsrfToken } = require('./middleware/csrf');
const logger = require('./utils/logger');
const env = require('./config/environment');

function getAllowedOrigins() {
  const origins = new Set([...(env.FRONTEND_ORIGINS || []), ...(env.ALLOWED_ORIGINS || [])]);
  return [...origins].filter(Boolean);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;
  // Same-site Vercel preview / alias hosts (*.vercel.app)
  try {
    const host = new URL(origin).hostname;
    if (host.endsWith('.vercel.app') && process.env.VERCEL) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Defer heavy route modules until first hit (keeps Vercel cold start under timeout). */
function lazyRouter(loader) {
  let router;
  return (req, res, next) => {
    try {
      if (!router) router = loader();
    } catch (err) {
      return next(err);
    }
    return router(req, res, next);
  };
}

function createApp() {
  const app = express();

  applyServerHardening(app, { isAllowedOrigin });

  // CSRF on state-changing API calls (GET /api/auth/csrf issues the token first)
  app.use('/api', (req, res, next) => {
    if (req.path === '/auth/csrf' || req.path === '/health') {
      return next();
    }
    return verifyCsrfToken(req, res, next);
  });

  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  }

  // Auth + files are needed for login; load eagerly. Everything else is lazy.
  app.use(
    '/api/files',
    lazyRouter(() => require('./routes/files.routes'))
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  app.get('/api/health', async (req, res) => {
    const detailed = req.query.detailed === '1' && req.headers.authorization;
    if (!detailed) {
      return res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        vercel: Boolean(process.env.VERCEL),
        jwtConfigured: Boolean(env.JWT_OK),
        databaseConfigured: Boolean(env.DATABASE_URL),
      });
    }
    try {
      const { checkFabricHealth } = require('./services/blockchainService');
      const fabric = await checkFabricHealth();
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        fabric: { connected: Boolean(fabric?.ok || fabric?.connected) },
      });
    } catch {
      res.json({ status: 'OK', timestamp: new Date().toISOString(), fabric: { connected: false } });
    }
  });

  // Auth must be available immediately for login (bcrypt/pg only — no PDF/Fabric)
  app.get('/api/auth/csrf', issueCsrfToken, (req, res) => {
    res.json({ csrfToken: req.csrfToken });
  });
  app.use(
    '/api/auth',
    lazyRouter(() => require('./routes/auth.routes'))
  );
  app.use(
    '/api/students',
    lazyRouter(() => require('./routes/student.routes'))
  );
  app.use(
    '/api/payments',
    lazyRouter(() => require('./routes/payment.routes'))
  );
  app.use(
    '/api/accountant',
    lazyRouter(() => require('./routes/accountant.routes'))
  );
  app.use(
    '/api/clearance',
    lazyRouter(() => require('./routes/clearance.routes'))
  );
  app.use(
    '/api/feedback',
    lazyRouter(() => require('./routes/feedback.routes'))
  );
  app.use(
    '/api/admin',
    lazyRouter(() => require('./routes/admin.routes'))
  );
  app.use(
    '/api/users',
    lazyRouter(() => require('./routes/user.routes'))
  );
  app.use(
    '/api/notifications',
    lazyRouter(() => require('./routes/notification.routes'))
  );

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'Route not found',
      requestId: req.id,
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
