const { createApp } = require('./createApp');
const { connectDB, initDb } = require('./config/database');
const { connectRedis } = require('./config/redis');
const fabricGateway = require('./services/fabricGateway');
const logger = require('./utils/logger');
const env = require('./config/environment');

const app = createApp();
const PORT = env.PORT;

async function startServer() {
  try {
    await connectDB();
    if (env.RUN_DB_MIGRATE) {
      await initDb();
      logger.info('Database migrations applied');
    }
    logger.info('PostgreSQL connected');

    try {
      const redis = await connectRedis();
      if (redis) logger.info('Redis connected');
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

process.on('SIGINT', async () => {
  await fabricGateway.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await fabricGateway.disconnect();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = app;
