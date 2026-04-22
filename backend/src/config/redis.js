const redis = require('redis');
const logger = require('../utils/logger');
const env = require('./environment');

let redisClient;
let redisDisabled = false;

async function connectRedis() {
  if (!env.REDIS_ENABLED) {
    redisDisabled = true;
    logger.warn('Redis disabled (REDIS_ENABLED=false)');
    return null;
  }

  try {
    const redisConfig = env.REDIS_URL
      ? {
          url: env.REDIS_URL,
          socket: { connectTimeout: 5000, reconnectStrategy: false },
        }
      : {
          socket: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            connectTimeout: 5000,
            reconnectStrategy: false,
          },
          password: env.REDIS_PASSWORD,
          legacyMode: false,
        };

    redisClient = redis.createClient(redisConfig);

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    await redisClient.connect();
    await redisClient.ping();
    return redisClient;
  } catch (error) {
    logger.warn('Redis not available:', error.message);
    redisDisabled = true;
    redisClient = null;
    return null;
  }
}

async function getCache(key) {
  if (redisDisabled || !env.REDIS_ENABLED) return null;
  try {
    if (!redisClient) await connectRedis();
    if (!redisClient) return null;
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis GET error:', error);
    return null;
  }
}

async function setCache(key, value, expirySeconds = 3600) {
  if (redisDisabled || !env.REDIS_ENABLED) return false;
  try {
    if (!redisClient) await connectRedis();
    if (!redisClient) return false;
    await redisClient.setEx(key, expirySeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis SET error:', error);
    return false;
  }
}

async function deleteCache(key) {
  if (redisDisabled || !env.REDIS_ENABLED) return false;
  try {
    if (!redisClient) await connectRedis();
    if (!redisClient) return false;
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error('Redis DELETE error:', error);
    return false;
  }
}

async function deleteCachePattern(pattern) {
  if (redisDisabled || !env.REDIS_ENABLED) return false;
  try {
    if (!redisClient) await connectRedis();
    if (!redisClient) return false;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    return true;
  } catch (error) {
    logger.error('Redis DELETE PATTERN error:', error);
    return false;
  }
}

function getRedisClient() {
  return redisClient;
}

module.exports = {
  connectRedis,
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
  getRedisClient,
};
