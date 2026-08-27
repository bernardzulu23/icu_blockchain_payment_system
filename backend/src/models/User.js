const { pool } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { buildUpdateClause } = require('../utils/db-safe-queries');

const PUBLIC_COLS =
  'user_id, username, email, full_name, role, status, employee_id, residential_address, date_of_birth, created_at, last_login';

async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

async function findByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0];
}

async function findByEmployeeId(employeeId) {
  const { rows } = await pool.query('SELECT * FROM users WHERE employee_id = $1', [employeeId]);
  return rows[0];
}

async function findById(userId) {
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLS} FROM users WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
}

async function list(queryParams = {}) {
  const { page, limit, offset, search } = parsePagination(queryParams);
  const role = queryParams.role;
  const params = [];
  let where = 'WHERE 1=1';

  if (role) {
    params.push(role);
    where += ` AND role = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    where += ` AND (username ILIKE $${i} OR email ILIKE $${i} OR full_name ILIKE $${i} OR COALESCE(employee_id, '') ILIKE $${i})`;
  }

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLS}
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, -2);
  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM users ${where}`, countParams);

  return paginatedResponse(rows, parseInt(countRows[0].count, 10), page, limit);
}

async function nextEmployeeId(role = 'accountant') {
  const prefix =
    role === 'admin' ? 'ADM' : role === 'registrar' ? 'REG' : 'ACC';
  const year = new Date().getFullYear();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM users WHERE employee_id LIKE $1`,
    [`${prefix}-${year}-%`]
  );
  const seq = String((rows[0]?.n || 0) + 1).padStart(4, '0');
  return `${prefix}-${year}-${seq}`;
}

async function create({
  username,
  email,
  passwordHash,
  role,
  fullName,
  employeeId,
  residentialAddress,
  dateOfBirth,
}) {
  const empId = employeeId || (await nextEmployeeId(role));
  const uname = username || empId;
  const { rows } = await pool.query(
    `INSERT INTO users
       (username, email, password_hash, role, full_name, status, employee_id, residential_address, date_of_birth)
     VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8)
     RETURNING ${PUBLIC_COLS}`,
    [
      uname,
      email,
      passwordHash,
      role,
      fullName,
      empId,
      residentialAddress || null,
      dateOfBirth || null,
    ]
  );
  return rows[0];
}

async function update(userId, fields) {
  const allowed = [
    'username',
    'email',
    'full_name',
    'role',
    'status',
    'employee_id',
    'residential_address',
    'date_of_birth',
    'password_hash',
  ];
  const { sets, params } = buildUpdateClause(fields, allowed);
  if (!sets.length) return findById(userId);
  params.push(userId);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE user_id = $${params.length}
     RETURNING ${PUBLIC_COLS}`,
    params
  );
  return rows[0];
}

async function remove(userId) {
  const { rows } = await pool.query(
    `UPDATE users SET status = 'inactive' WHERE user_id = $1 RETURNING user_id`,
    [userId]
  );
  return rows[0];
}

async function updateLastLogin(userId) {
  await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [userId]);
}

module.exports = {
  findByEmail,
  findByUsername,
  findByEmployeeId,
  findById,
  list,
  create,
  update,
  remove,
  updateLastLogin,
  nextEmployeeId,
};
