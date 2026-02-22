const redis = require('redis');
const logger = require('../utils/logger');
const env = require('./environment');

let redisClient;

const redisConfig = env.REDIS_URL
  ? { url: env.REDIS_URL }
  : {
      socket: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
      },
      password: env.REDIS_PASSWORD,
      legacyMode: false,
    };

async function connectRedis() {
  try {
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
    logger.error('Redis connection failed:', error);
    throw error;
  }
}

async function getCache(key) {
  try {
    if (!redisClient) await connectRedis();
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis GET error:', error);
    return null;
  }
}

async function setCache(key, value, expirySeconds = 3600) {
  try {
    if (!redisClient) await connectRedis();
    await redisClient.setEx(key, expirySeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis SET error:', error);
    return false;
  }
}

async function deleteCache(key) {
  try {
    if (!redisClient) await connectRedis();
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error('Redis DELETE error:', error);
    return false;
  }
}

async function deleteCachePattern(pattern) {
  try {
    if (!redisClient) await connectRedis();
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
