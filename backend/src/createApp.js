const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const studentRoutes = require('./routes/student.routes');
const paymentRoutes = require('./routes/payment.routes');
const accountantRoutes = require('./routes/accountant.routes');
const clearanceRoutes = require('./routes/clearance.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');
const notificationRoutes = require('./routes/notification.routes');

const errorHandler = require('./middleware/errorHandler');
const { checkFabricHealth } = require('./services/blockchainService');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
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
  // Vercel preview deployments: https://<project>-<hash>.vercel.app
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(null, getAllowedOrigins()[0] || env.FRONTEND_URL);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use('/api/', apiLimiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(
      morgan('combined', {
        stream: { write: (msg) => logger.info(msg.trim()) },
      })
    );
  }

  if (!process.env.VERCEL) {
    app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_PATH || 'uploads')));
  }

  app.get('/health', async (req, res) => {
    const fabric = await checkFabricHealth();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: '1.0.0',
      platform: process.env.VERCEL ? 'vercel' : 'node',
      fabric,
    });
  });

  app.get('/api/health', async (req, res) => {
    const fabric = await checkFabricHealth();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      version: '1.0.0',
      platform: process.env.VERCEL ? 'vercel' : 'node',
      fabric,
    });
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
      message: `Route ${req.method} ${req.url} not found`,
    });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
