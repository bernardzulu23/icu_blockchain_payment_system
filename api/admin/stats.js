/**
 * Lightweight GET /api/admin/stats — avoids full Express cold start on dashboard.
 */
require('../_bootstrap');

const { pool } = require('../../backend/src/config/database');
const env = require('../../backend/src/config/environment');
const { verifyAccessToken } = require('../../backend/src/middleware/auth');
const { ROLES } = require('../../backend/src/utils/constants');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function getAccessToken(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (typeof auth === 'string' && auth.startsWith('Bearer ') && auth.length > 7) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(req);
  return cookies.access_token || null;
}

async function loadStaff(decoded) {
  if (decoded.type === 'student') return null;
  const userId = decoded.userId || decoded.sub;
  if (!userId) return null;
  const { rows } = await pool.query(
    `SELECT user_id, role, status, token_version FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!env.JWT_OK) {
    sendJson(res, 503, {
      error: 'Auth misconfigured',
      message: 'Set JWT_SECRET and JWT_REFRESH_SECRET (min 32 chars each).',
    });
    return;
  }

  const token = getAccessToken(req);
  if (!token) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    console.error('admin/stats auth:', err.name || err.message || err);
    sendJson(res, 401, { error: 'Invalid or expired session.' });
    return;
  }

  try {
    const user = await loadStaff(decoded);
    if (!user || user.status !== 'active') {
      sendJson(res, 401, { error: 'Invalid or expired session.' });
      return;
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    const dbVersion = user.token_version ?? 0;
    if (Number(tokenVersion) !== Number(dbVersion)) {
      sendJson(res, 401, { error: 'Invalid or expired session.' });
      return;
    }

    if (String(user.role || '').toLowerCase() !== String(ROLES.ADMIN).toLowerCase()) {
      sendJson(res, 403, { error: 'Insufficient permissions.' });
      return;
    }

    const { rows: paymentStats } = await pool.query(`
      SELECT status, COUNT(*)::int as count FROM student_payments GROUP BY status
    `);
    const { rows: totalPayments } = await pool.query(
      'SELECT COUNT(*)::int as count FROM student_payments'
    );
    const { rows: totalStudents } = await pool.query('SELECT COUNT(*)::int as count FROM students');
    const { rows: totalAmount } = await pool.query(
      "SELECT COALESCE(SUM(amount), 0)::float8 as total FROM student_payments WHERE status = 'verified'"
    );

    sendJson(res, 200, {
      payments: paymentStats.map((p) => ({
        status: p.status,
        count: Number(p.count) || 0,
      })),
      totalPayments: Number(totalPayments[0].count) || 0,
      totalStudents: Number(totalStudents[0].count) || 0,
      totalVerifiedAmount: Number(totalAmount[0].total) || 0,
    });
  } catch (err) {
    console.error('admin/stats error:', err.message || err);
    sendJson(res, 500, {
      error: 'Failed to fetch statistics',
      message: err.message || 'Database query failed',
    });
  }
};
