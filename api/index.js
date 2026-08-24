/**
 * Vercel serverless entry — wraps Express for /api/*
 * OCR (Python) and Fabric need a VPS; set BLOCKCHAIN_OPTIONAL=true on Vercel.
 */
const path = require('path');

// Prefer backend/.env locally; on Vercel, env comes from the dashboard
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.env.BLOCKCHAIN_OPTIONAL = process.env.BLOCKCHAIN_OPTIONAL || 'true';
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false';
process.env.TRUST_PROXY = process.env.TRUST_PROXY || 'true';
// Vercel FS is read-only except /tmp — never mkdir under /var/task
process.env.UPLOAD_PATH = process.env.UPLOAD_PATH || '/tmp/uploads';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

let handler;
let initError;

try {
  const serverless = require('serverless-http');
  const { createApp } = require('../backend/src/createApp');
  const { connectDB } = require('../backend/src/config/database');

  const app = createApp();

  let ready;
  async function ensureReady() {
    if (!ready) {
      ready = connectDB().catch((err) => {
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
    try {
      await ensureReady();
      return baseHandler(req, res);
    } catch (err) {
      console.error('API cold-start failed:', err);
      sendJson(res, 503, {
        error: 'API unavailable',
        message:
          err.message ||
          'Database connection failed. Check Vercel env vars (DATABASE_URL, JWT_SECRET).',
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
