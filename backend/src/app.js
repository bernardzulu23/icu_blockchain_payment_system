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
const adminRoutes = require('./routes/admin.routes');

const errorHandler = require('./middleware/errorHandler');
const { connectDB, initDb } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');
const logger = require('./utils/logger');
const env = require('./config/environment');

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: env.FRONTEND_URL || 'http://localhost:5173',
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

app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_PATH || 'uploads')));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '1.0.0',
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/accountant', accountantRoutes);
app.use('/api/clearance', clearanceRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
  });
});

app.use(errorHandler);

const PORT = env.PORT;

async function startServer() {
  try {
    await connectDB();
    await initDb();
    logger.info('PostgreSQL connected');

    try {
      await connectRedis();
      logger.info('Redis connected');
    } catch (err) {
      logger.warn('Redis not available:', err.message);
    }

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`Frontend URL: ${env.FRONTEND_URL}`);
    });
  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Shutting down...');
  logger.error(err);
  process.exit(1);
});

startServer();

module.exports = app;
