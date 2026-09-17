/**
 * Lightweight GET /api/auth/me — avoids full Express cold start after login.
 */
require('../_bootstrap');

const { pool } = require('../../backend/src/config/database');
const env = require('../../backend/src/config/environment');
const {
  verifyAccessToken,
  extractAccessToken,
} = require('../../backend/src/middleware/auth');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function getBearer(req) {
  // extractAccessToken also checks cookies; for serverless req may lack cookies parsed
  try {
    return extractAccessToken(req);
  } catch {
    const auth = req.headers?.authorization || req.headers?.Authorization || '';
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}

async function loadUser(decoded) {
  const userId = decoded.userId || decoded.sub;
  if (decoded.type === 'student') {
    const { rows } = await pool.query(
      `SELECT student_id, student_number, first_name, last_name, email, phone, status, token_version
       FROM students WHERE student_id = $1`,
      [userId]
    );
    return rows[0] ? { ...rows[0], role: 'student', type: 'student' } : null;
  }
  const { rows } = await pool.query(
    `SELECT user_id, username, email, role, full_name, status, employee_id, token_version
     FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0] ? { ...rows[0], type: 'staff' } : null;
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
    const user = await loadUser(decoded);
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

    const id = user.user_id || user.student_id;
    sendJson(res, 200, {
      id,
      userId: id,
      email: user.email,
      student_number: user.student_number,
      name:
        user.full_name ||
        `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      role: user.role,
      type: user.type,
      username: user.username,
      employee_id: user.employee_id,
      first_name: user.first_name,
      last_name: user.last_name,
    });
  } catch (err) {
    console.error('auth/me error:', err.message || err);
    sendJson(res, 401, { error: 'Invalid or expired session.' });
  }
};
