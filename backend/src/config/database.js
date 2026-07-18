const { Pool } = require('pg');
const { readFileSync } = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const env = require('./environment');

function isNeonUrl(url) {
  return typeof url === 'string' && (url.includes('neon.tech') || url.includes('neon.database'));
}

function resolveConnectionUrl() {
  return (
    env.DATABASE_URL ||
    env.POSTGRES_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.DATABASE_PUBLIC_URL ||
    null
  );
}

const connectionUrl = resolveConnectionUrl();
const useSsl =
  env.DB_SSL ||
  isNeonUrl(connectionUrl) ||
  process.env.VERCEL === '1' ||
  process.env.NODE_ENV === 'production';

const poolConfig = connectionUrl
  ? {
      connectionString: connectionUrl,
      max: process.env.VERCEL ? 3 : 20,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
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
    const migration004 = readFileSync(path.join(migrationsDir, '004_matching_columns.sql'), 'utf-8');
    const migration005 = readFileSync(path.join(migrationsDir, '005_feedback.sql'), 'utf-8');
    const migration006 = readFileSync(path.join(migrationsDir, '006_password_reset.sql'), 'utf-8');
    const migration007 = readFileSync(path.join(migrationsDir, '007_batch_reconciliation.sql'), 'utf-8');
    await client.query(schema);
    await client.query(seed);
    await client.query(migration003);
    await client.query(migration004);
    await client.query(migration005);
    await client.query(migration006);
    await client.query(migration007);
    logger.info('Database schema initialized');
    return true;
  } finally {
    client.release();
  }
}

if (!process.env.VERCEL) {
  process.on('SIGINT', async () => {
    logger.info('Closing PostgreSQL pool...');
    await pool.end();
    process.exit(0);
  });
}

module.exports = {
  pool,
  query,
  getClient,
  connectDB,
  initDb,
};
