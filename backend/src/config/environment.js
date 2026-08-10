const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const isProd = process.env.NODE_ENV === 'production';
const WEAK_JWT = 'your-secret-key-change-in-production';

function resolveFrontendUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  return 'http://localhost:5173';
}

/** Comma-separated origins for CORS */
function resolveFrontendOrigins() {
  const origins = new Set();
  const primary = resolveFrontendUrl();
  if (primary) origins.add(primary.split(',')[0].trim());

  const extra = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
  for (const part of extra.split(',')) {
    const trimmed = part.trim();
    if (trimmed) origins.add(trimmed);
  }

  origins.add('http://localhost:5173');
  origins.add('http://localhost:3000');

  return [...origins].filter(Boolean);
}

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (isProd) {
    if (!secret || secret === WEAK_JWT || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must be set in production to a strong value (min 32 characters). Generate with: openssl rand -hex 32'
      );
    }
  }
  return secret || WEAK_JWT;
}

function resolveRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (isProd) {
    if (!secret || secret === WEAK_JWT || secret.length < 32) {
      throw new Error(
        'JWT_REFRESH_SECRET (or JWT_SECRET) must be set in production to a strong value (min 32 characters)'
      );
    }
  }
  return secret || WEAK_JWT;
}

/** Prefer Supabase pooled URL, then generic DATABASE_URL */
function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    null
  );
}

/** Direct (non-pooler) URL for migrations — Supabase Session / Direct */
function resolveDatabaseDirectUrl() {
  return (
    process.env.DATABASE_DIRECT_URL ||
    process.env.SUPABASE_DB_DIRECT_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_PUBLIC_URL ||
    resolveDatabaseUrl()
  );
}

if (isProd && process.env.DB_PASSWORD === 'icu_password' && !resolveDatabaseUrl()) {
  console.warn('[security] Warning: default DB_PASSWORD detected. Prefer DATABASE_URL (Supabase).');
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  FRONTEND_URL: resolveFrontendUrl(),
  FRONTEND_ORIGINS: resolveFrontendOrigins(),
  DATABASE_URL: resolveDatabaseUrl(),
  DATABASE_DIRECT_URL: resolveDatabaseDirectUrl(),
  DATABASE_PUBLIC_URL: process.env.DATABASE_PUBLIC_URL || process.env.SUPABASE_DB_DIRECT_URL,
  POSTGRES_URL: process.env.POSTGRES_URL,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT, 10) || 5432,
  DB_NAME: process.env.DB_NAME || 'postgres',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'icu_password',
  DB_SSL:
    process.env.DB_SSL === 'true' ||
    Boolean(resolveDatabaseUrl()?.includes('supabase.co')) ||
    Boolean(resolveDatabaseUrl()?.includes('supabase.com')),
  RUN_DB_MIGRATE:
    process.env.RUN_DB_MIGRATE === 'true' ||
    (process.env.NODE_ENV === 'development' && !process.env.CI),
  REDIS_ENABLED: process.env.REDIS_ENABLED === 'true',
  REDIS_URL: process.env.REDIS_URL,
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  JWT_SECRET: resolveJwtSecret(),
  JWT_REFRESH_SECRET: resolveRefreshSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  FABRIC_CONNECTION_PROFILE:
    process.env.FABRIC_CONNECTION_PROFILE ||
    path.join(__dirname, '../../../blockchain/network/connection-profile.json'),
  FABRIC_WALLET_PATH: process.env.FABRIC_WALLET_PATH || path.join(__dirname, '../../../blockchain/wallet'),
  FABRIC_CHANNEL: process.env.FABRIC_CHANNEL || 'icupaymentchannel',
  FABRIC_CHAINCODE: process.env.FABRIC_CHAINCODE || 'reconciliation-chaincode',
  FABRIC_IDENTITY: process.env.FABRIC_IDENTITY || 'accountantAdmin',
  FABRIC_AS_LOCALHOST: process.env.FABRIC_AS_LOCALHOST !== 'false',
  CLEARANCE_REQUIRED_SEMESTERS: parseInt(process.env.CLEARANCE_REQUIRED_SEMESTERS || '8', 10),
  PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || '',
  UPLOAD_PATH: process.env.UPLOAD_PATH || 'uploads',
  /** Supabase project URL e.g. https://xxxx.supabase.co */
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  /** Service role key — server only, never expose to frontend */
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET || 'icu-uploads',
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  BLOCKCHAIN_OPTIONAL: process.env.BLOCKCHAIN_OPTIONAL === 'true',
  TRUST_PROXY: process.env.TRUST_PROXY === 'true' || isProd,
};
