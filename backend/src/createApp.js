const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const paymentRoutes = require('./routes/payment.routes');
const accountantRoutes = require('./routes/accountant.routes');
const clearanceRoutes = require('./routes/clearance.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');
const notificationRoutes = require('./routes/notification.routes');
const filesRoutes = require('./routes/files.routes');

const errorHandler = require('./middleware/errorHandler');
const { checkFabricHealth } = require('./services/blockchainService');
const {
  apiLimiter,
  authLimiter,
} = require('./middleware/rateLimit');
const logger = require('./utils/logger');
const env = require('./config/environment');

function getAllowedOrigins() {
  const origins = new Set(env.FRONTEND_ORIGINS || [env.FRONTEND_URL]);
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

function createApp() {
  const app = express();

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      contentSecurityPolicy: false, // SPA sets its own CSP via host headers
      hsts: env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use('/api/', apiLimiter);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(
      morgan('combined', {
        stream: { write: (msg) => logger.info(msg.trim()) },
      })
    );
  }

  // Uploads are NOT publicly static — use authenticated /api/files/*
  app.use('/api/files', filesRoutes);

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

  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/accountant', accountantRoutes);
  app.use('/api/clearance', clearanceRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'Route not found',
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
