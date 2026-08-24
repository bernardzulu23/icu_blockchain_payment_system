const { Pool } = require('pg');
const { readFileSync, readdirSync } = require('fs');
const path = require('path');
const dns = require('dns');
const logger = require('../utils/logger');
const env = require('./environment');

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* ignore */
}

function isSupabaseUrl(url) {
  return (
    typeof url === 'string' &&
    (url.includes('supabase.co') || url.includes('supabase.com') || url.includes('pooler.supabase'))
  );
}

function resolveConnectionUrl() {
  return env.DATABASE_URL || null;
}

/** Ensure serverless-friendly query params for Supabase pooler / Vercel. */
function withServerlessDbParams(url) {
  if (!url || typeof url !== 'string') return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has('connect_timeout')) u.searchParams.set('connect_timeout', '5');
    if (isSupabaseUrl(url) && !u.searchParams.has('sslmode')) {
      u.searchParams.set('sslmode', 'require');
    }
    // Helps some ORMs/pgbouncer; harmless for node-pg
    if (url.includes('pooler.supabase') && !u.searchParams.has('pgbouncer')) {
      u.searchParams.set('pgbouncer', 'true');
    }
    return u.toString();
  } catch {
    return url;
  }
}

const connectionUrl = withServerlessDbParams(resolveConnectionUrl());
const useSsl =
  env.DB_SSL ||
  isSupabaseUrl(connectionUrl) ||
  process.env.NODE_ENV === 'production';

const poolConfig = connectionUrl
  ? {
      connectionString: connectionUrl,
      max: process.env.VERCEL ? 1 : 20,
      idleTimeoutMillis: process.env.VERCEL ? 1000 : 10000,
      connectionTimeoutMillis: process.env.VERCEL ? 5000 : 15000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      allowExitOnIdle: Boolean(process.env.VERCEL),
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      max: process.env.VERCEL ? 1 : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: process.env.VERCEL ? 5000 : 2000,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
      allowExitOnIdle: Boolean(process.env.VERCEL),
    };

const pool = new Pool(poolConfig);

async function connectDB() {
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT set_config('statement_timeout', '8000', false)");
      const result = await client.query('SELECT NOW()');
      const hostHint = isSupabaseUrl(connectionUrl) ? 'Supabase Postgres' : 'PostgreSQL';
      logger.info(`${hostHint} connected at: ${result.rows[0].now}`);
    } finally {
      client.release();
    }
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
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      logger.info(`Applied migration: ${file}`);
    }
    logger.info('Database schema initialized (Supabase / Postgres)');
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
  isSupabaseUrl,
};
