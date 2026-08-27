/**
 * Lightweight login handler — avoids loading full Express stack on cold start.
 */
require('../_bootstrap');

const bcrypt = require('bcrypt');
const { pool } = require('../../backend/src/config/database');
const env = require('../../backend/src/config/environment');
const { generateAccessToken, generateRefreshToken } = require('../../backend/src/middleware/auth');

const {
  createCsrfToken,
  setCsrfCookieHeader,
  verifyCsrfRequest,
} = require('../../backend/src/middleware/csrf');

const {
  checkLoginAllowed,
  recordFailedLogin,
  resetLoginFailures,
  INVALID_CREDENTIALS_RESPONSE,
} = require('../../backend/src/services/loginSecurity');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function sendJsonWithCsrf(res, status, body) {
  const token = createCsrfToken();
  setCsrfCookieHeader(res, token);
  sendJson(res, status, body);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {};
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function findStaff(identifier) {
  const id = String(identifier).trim();
  const lower = id.toLowerCase();
  const { rows } = await pool.query(
    `SELECT user_id, username, email, role, full_name, status, employee_id, password_hash
     FROM users
     WHERE username = $1
        OR email = $2
        OR employee_id = $1
     LIMIT 1`,
    [id, lower.includes('@') ? lower : id]
  );
  return rows[0] || null;
}

async function findStudent(identifier) {
  const id = String(identifier).trim().toLowerCase();
  const { rows } = await pool.query(
    `SELECT student_id, student_number, first_name, last_name, email, phone, password_hash, status
     FROM students
     WHERE status = 'active'
       AND (
         LOWER(TRIM(student_number)) = $1
         OR LOWER(TRIM(COALESCE(email, ''))) = $1
         OR LOWER(TRIM(student_id)) = $1
       )
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function loginStaff(user, password) {
  if (user.status !== 'active') {
    return { status: 403, body: { error: 'Account inactive', message: 'Contact administration.' } };
  }

  const lockCheck = await checkLoginAllowed('staff', user.user_id);
  if (!lockCheck.allowed) {
    return { status: lockCheck.status, body: lockCheck.body };
  }

  if (!user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    await recordFailedLogin('staff', user.user_id);
    return { status: 401, body: INVALID_CREDENTIALS_RESPONSE };
  }

  await resetLoginFailures('staff', user.user_id);

  const accessToken = generateAccessToken({
    userId: user.user_id,
    type: 'staff',
    role: user.role,
    tokenVersion: lockCheck.tokenVersion,
  });
  const refreshToken = generateRefreshToken({
    userId: user.user_id,
    type: 'staff',
    role: user.role,
    tokenVersion: lockCheck.tokenVersion,
  });

  pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [user.user_id]).catch(() => {});

  return {
    status: 200,
    body: {
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      token: accessToken,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        employee_id: user.employee_id,
        type: 'staff',
        name: user.full_name,
      },
    },
  };
}

async function loginStudent(student, password) {
  const lockCheck = await checkLoginAllowed('student', student.student_id);
  if (!lockCheck.allowed) {
    return { status: lockCheck.status, body: lockCheck.body };
  }

  if (!student.password_hash || !(await bcrypt.compare(password, student.password_hash))) {
    await recordFailedLogin('student', student.student_id);
    return { status: 401, body: INVALID_CREDENTIALS_RESPONSE };
  }

  await resetLoginFailures('student', student.student_id);

  const accessToken = generateAccessToken({
    userId: student.student_id,
    type: 'student',
    role: 'student',
    tokenVersion: lockCheck.tokenVersion,
  });
  const refreshToken = generateRefreshToken({
    userId: student.student_id,
    type: 'student',
    tokenVersion: lockCheck.tokenVersion,
  });

  return {
    status: 200,
    body: {
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      token: accessToken,
      user: {
        id: student.student_id,
        student_id: student.student_id,
        student_number: student.student_number,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        phone: student.phone,
        type: 'student',
        name: `${student.first_name} ${student.last_name}`.trim(),
        role: 'student',
      },
    },
  };
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!env.JWT_OK) {
    sendJson(res, 503, {
      error: 'Auth misconfigured',
      message: 'Set JWT_SECRET and JWT_REFRESH_SECRET in Vercel (min 32 chars each), then redeploy.',
    });
    return;
  }

  if (!verifyCsrfRequest(req)) {
    sendJson(res, 403, { error: 'CSRF validation failed.' });
    return;
  }

  try {
    const body = await readBody(req);
    const identifier = String(
      body.identifier || body.username || body.email || body.student_number || ''
    ).trim();
    const password = body.password;

    if (!identifier || !password) {
      sendJson(res, 400, {
        error: 'Credentials required',
        message: 'Email / student number / employee ID and password are required',
      });
      return;
    }

    const staff = await findStaff(identifier);
    if (staff) {
      const result = await loginStaff(staff, password);
      if (result.status === 200) {
        sendJsonWithCsrf(res, result.status, result.body);
      } else {
        sendJson(res, result.status, result.body);
      }
      return;
    }

    const student = await findStudent(identifier);
    if (student) {
      const result = await loginStudent(student, password);
      if (result.status === 200) {
        sendJsonWithCsrf(res, result.status, result.body);
      } else {
        sendJson(res, result.status, result.body);
      }
      return;
    }

    sendJson(res, 401, INVALID_CREDENTIALS_RESPONSE);
  } catch (err) {
    console.error('Login handler error:', err);
    const msg = String(err.message || err);
    if (/self-signed certificate|ECONNREFUSED|timeout|ETIMEDOUT/i.test(msg)) {
      sendJson(res, 503, {
        error: 'Database unavailable',
        message:
          'Check DATABASE_URL on Vercel (Supabase Transaction pooler, port 6543) and DB_SSL=true.',
      });
      return;
    }
    sendJson(res, 500, { error: 'Login failed. Please try again.' });
  }
};
