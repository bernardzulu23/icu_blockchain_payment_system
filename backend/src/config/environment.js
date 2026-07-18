const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

function resolveFrontendUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
}

/** Comma-separated extra origins (e.g. https://app.vercel.app,https://preview.vercel.app) */
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
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.VERCEL_BRANCH_URL) origins.add(`https://${process.env.VERCEL_BRANCH_URL}`);

  return [...origins].filter(Boolean);
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  FRONTEND_URL: resolveFrontendUrl(),
  FRONTEND_ORIGINS: resolveFrontendOrigins(),
  DATABASE_URL:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL,
  DATABASE_PUBLIC_URL:
    process.env.DATABASE_PUBLIC_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL,
  POSTGRES_URL: process.env.POSTGRES_URL,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT, 10) || 5432,
  DB_NAME: process.env.DB_NAME || 'icu_payments',
  DB_USER: process.env.DB_USER || 'icu_user',
  DB_PASSWORD: process.env.DB_PASSWORD || 'icu_password',
  DB_SSL: process.env.DB_SSL === 'true',
  RUN_DB_MIGRATE:
    process.env.RUN_DB_MIGRATE === 'true' ||
    (process.env.NODE_ENV === 'development' && !process.env.VERCEL),
  REDIS_ENABLED: process.env.REDIS_ENABLED !== 'false' && !process.env.VERCEL,
  REDIS_URL: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
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
  UPLOAD_PATH: process.env.UPLOAD_PATH || (process.env.VERCEL ? '/tmp/uploads' : 'uploads'),
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  BLOCKCHAIN_OPTIONAL:
    process.env.VERCEL === '1'
      ? process.env.BLOCKCHAIN_OPTIONAL !== 'false'
      : process.env.BLOCKCHAIN_OPTIONAL === 'true',
};
