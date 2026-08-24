/**
 * Vercel serverless entry — wraps Express for /api/*
 * OCR (Python) and Fabric need a VPS; set BLOCKCHAIN_OPTIONAL=true on Vercel.
 */
const path = require('path');
const serverless = require('serverless-http');

// Prefer backend/.env locally; on Vercel, env comes from the dashboard
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.env.BLOCKCHAIN_OPTIONAL = process.env.BLOCKCHAIN_OPTIONAL || 'true';
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false';
process.env.TRUST_PROXY = process.env.TRUST_PROXY || 'true';

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

const handler = serverless(app, {
  binary: ['image/*', 'application/pdf', 'application/octet-stream'],
});

module.exports = async (req, res) => {
  try {
    await ensureReady();
    return handler(req, res);
  } catch (err) {
    console.error('API cold-start failed:', err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'API unavailable',
        message: err.message || 'Database connection failed. Check Vercel env vars (DATABASE_URL, JWT_SECRET).',
      })
    );
  }
};
