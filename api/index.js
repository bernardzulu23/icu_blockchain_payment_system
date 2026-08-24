/**
 * Vercel serverless entry — wraps Express for /api/*
 * OCR (Python) and Fabric need a VPS; set BLOCKCHAIN_OPTIONAL=true on Vercel.
 */
const path = require('path');
const dns = require('dns');
const { URL } = require('url');

// Vercel + Supabase: Node may try IPv6 first and hang until FUNCTION_INVOCATION_TIMEOUT
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* Node < 17 */
}

// Prefer backend/.env locally; on Vercel, env comes from the dashboard
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.env.BLOCKCHAIN_OPTIONAL = process.env.BLOCKCHAIN_OPTIONAL || 'true';
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false';
process.env.TRUST_PROXY = process.env.TRUST_PROXY || 'true';
// Vercel FS is read-only except /tmp — never mkdir under /var/task
process.env.UPLOAD_PATH = process.env.UPLOAD_PATH || '/tmp/uploads';

const DB_CONNECT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS || 5000);

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function requestPath(req) {
  const raw =
    req.url ||
    req.originalUrl ||
    (req.headers && (req.headers['x-forwarded-uri'] || req.headers['x-invoke-path'])) ||
    '/';
  try {
    return new URL(raw, 'http://localhost').pathname;
  } catch {
    return String(raw).split('?')[0];
  }
}

function isHealthPath(pathname) {
  return pathname === '/api/health' || pathname === '/health' || pathname.endsWith('/health');
}

let handler;
let initError;

try {
  const serverless = require('serverless-http');
  const { createApp } = require('../backend/src/createApp');
  const { connectDB } = require('../backend/src/config/database');
  const env = require('../backend/src/config/environment');

  const app = createApp();

  let ready;
  async function ensureReady() {
    if (!ready) {
      const started = Date.now();
      ready = Promise.race([
        connectDB().then((pool) => {
          console.log(`DB ready in ${Date.now() - started}ms`);
          return pool;
        }),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Database connection timed out after ${DB_CONNECT_MS}ms. On Vercel use Supabase Transaction pooler host (port 6543) in DATABASE_URL.`
              )
            );
          }, DB_CONNECT_MS);
        }),
      ]).catch((err) => {
        ready = null;
        throw err;
      });
    }
    return ready;
  }

  const baseHandler = serverless(app, {
    binary: ['image/*', 'application/pdf', 'application/octet-stream'],
  });

  handler = async (req, res) => {
    const pathname = requestPath(req);

    // Never block health on Postgres — diagnose JWT/DB env without waiting for TCP
    if (isHealthPath(pathname)) {
      return sendJson(res, 200, {
        status: 'OK',
        timestamp: new Date().toISOString(),
        vercel: Boolean(process.env.VERCEL),
        jwtConfigured: Boolean(env.JWT_OK),
        databaseConfigured: Boolean(env.DATABASE_URL),
      });
    }

    try {
      await ensureReady();
      return baseHandler(req, res);
    } catch (err) {
      console.error('API cold-start failed:', err);
      sendJson(res, 503, {
        error: 'API unavailable',
        message:
          err.message ||
          'Database connection failed. Check Vercel env vars (DATABASE_URL pooler :6543, JWT_SECRET).',
      });
    }
  };
} catch (err) {
  initError = err;
  console.error('API module init failed:', err);
  handler = async (_req, res) => {
    sendJson(res, 500, {
      error: 'API failed to start',
      message: initError?.message || String(initError),
    });
  };
}

module.exports = handler;
