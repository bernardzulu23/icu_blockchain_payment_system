/**
 * Vercel serverless entry — wraps Express for /api/*
 * OCR (Python) and Fabric need a VPS; set BLOCKCHAIN_OPTIONAL=true on Vercel.
 * Login is handled by api/auth/login.js (lightweight) — not this handler.
 */
require('./_bootstrap');

const { URL } = require('url');

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
  const env = require('../backend/src/config/environment');

  const app = createApp();
  const baseHandler = serverless(app, {
    binary: ['image/*', 'application/pdf', 'application/octet-stream'],
  });

  handler = async (req, res) => {
    const pathname = requestPath(req);

    if (isHealthPath(pathname)) {
      return sendJson(res, 200, {
        status: 'OK',
        timestamp: new Date().toISOString(),
        vercel: Boolean(process.env.VERCEL),
        jwtConfigured: Boolean(env.JWT_OK),
        databaseConfigured: Boolean(env.DATABASE_URL),
      });
    }

    return baseHandler(req, res);
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
