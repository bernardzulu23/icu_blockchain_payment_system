/**
 * Lightweight GET /api/admin/stats — avoids full Express cold start on dashboard.
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

    if (user.role !== ROLES.ADMIN) {
      sendJson(res, 403, { error: 'Insufficient permissions.' });
      return;
    }

    const { rows: paymentStats } = await pool.query(`
      SELECT status, COUNT(*) as count FROM student_payments GROUP BY status
    `);
    const { rows: totalPayments } = await pool.query(
      'SELECT COUNT(*) as count FROM student_payments'
    );
    const { rows: totalStudents } = await pool.query('SELECT COUNT(*) as count FROM students');
    const { rows: totalAmount } = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM student_payments WHERE status = 'verified'"
    );

    sendJson(res, 200, {
      payments: paymentStats,
      totalPayments: parseInt(totalPayments[0].count, 10),
      totalStudents: parseInt(totalStudents[0].count, 10),
      totalVerifiedAmount: parseFloat(totalAmount[0].total),
    });
  } catch (err) {
    console.error('admin/stats error:', err.message || err);
    sendJson(res, 500, { error: 'Failed to fetch statistics' });
  }
};
