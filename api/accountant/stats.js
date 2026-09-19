/**
 * Lightweight GET /api/accountant/stats — avoids full Express cold start on dashboard.
 */
require('../_bootstrap');

const { pool } = require('../../backend/src/config/database');
const env = require('../../backend/src/config/environment');
const {
  verifyAccessToken,
  extractAccessToken,
} = require('../../backend/src/middleware/auth');
const { ROLES } = require('../../backend/src/utils/constants');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function getBearer(req) {
  try {
    return extractAccessToken(req);
  } catch {
    const auth = req.headers?.authorization || req.headers?.Authorization || '';
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}

async function loadStaff(decoded) {
  if (decoded.type === 'student') return null;
  const userId = decoded.userId || decoded.sub;
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

  const token = getBearer(req);
  if (!token) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    const user = await loadStaff(decoded);
    if (!user || user.status !== 'active') {
      sendJson(res, 401, { error: 'Invalid or expired session.' });
      return;
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    const dbVersion = user.token_version ?? 0;
    if (tokenVersion !== dbVersion) {
      sendJson(res, 401, { error: 'Invalid or expired session.' });
      return;
    }

    const allowed = [ROLES.ADMIN, ROLES.ACCOUNTANT];
    if (!allowed.includes(user.role)) {
      sendJson(res, 403, { error: 'Insufficient permissions.' });
      return;
    }

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'verified') as verified,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'auto_matched') as auto_matched,
        COUNT(*) FILTER (WHERE status = 'manual_review') as manual_review,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0) as total_verified_amount,
        COUNT(DISTINCT student_id) FILTER (WHERE status = 'verified') as unique_students,
        COUNT(*) FILTER (WHERE verified_date >= CURRENT_DATE - INTERVAL '7 days') as verified_last_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours') as submitted_today
      FROM student_payments
    `);

    sendJson(res, 200, {
      success: true,
      statistics: rows[0],
      recent_activity: [],
    });
  } catch (err) {
    console.error('accountant/stats error:', err.message || err);
    sendJson(res, 500, { error: 'Failed to fetch statistics' });
  }
};
