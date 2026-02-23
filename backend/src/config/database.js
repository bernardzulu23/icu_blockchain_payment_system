const { Pool } = require('pg');
const { readFileSync } = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const env = require('./environment');

const poolConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

async function connectDB() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info(`PostgreSQL connected at: ${result.rows[0].now}`);
    client.release();
    return pool;
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error);
    throw error;
  }
}

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn('Slow query detected', {
        text: text.substring(0, 100),
        duration,
        rows: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    logger.error('Query error:', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
}

async function getClient() {
  return await pool.connect();
}

async function initDb() {
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, '../../migrations');
    const schema = readFileSync(path.join(migrationsDir, '001_schema.sql'), 'utf-8');
    const seed = readFileSync(path.join(migrationsDir, '002_seed.sql'), 'utf-8');
    const migration003 = readFileSync(path.join(migrationsDir, '003_student_profile_fields.sql'), 'utf-8');
    await client.query(schema);
    await client.query(seed);
    await client.query(migration003);
    logger.info('Database schema initialized');
    return true;
  } finally {
    client.release();
  }
}

process.on('SIGINT', async () => {
  logger.info('Closing PostgreSQL pool...');
  await pool.end();
  process.exit(0);
});

module.exports = {
  pool,
  query,
  getClient,
  connectDB,
  initDb,
};
