const { pool } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
}

async function findByUsername(username) {
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0];
}

async function findById(userId) {
  const { rows } = await pool.query(
    'SELECT user_id, username, email, full_name, role, status, created_at, last_login FROM users WHERE user_id = $1',
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
    where += ` AND (username ILIKE $${i} OR email ILIKE $${i} OR full_name ILIKE $${i})`;
  }

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT user_id, username, email, full_name, role, status, created_at, last_login
     FROM users ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, -2);
  const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM users ${where}`, countParams);

  return paginatedResponse(rows, parseInt(countRows[0].count, 10), page, limit);
}

async function create({ username, email, passwordHash, role, fullName }) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, email, password_hash, role, full_name, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING user_id, username, email, full_name, role, status, created_at`,
    [username, email, passwordHash, role, fullName]
  );
  return rows[0];
}

async function update(userId, fields) {
  const allowed = ['username', 'email', 'full_name', 'role', 'status'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }
  if (fields.password_hash) {
    params.push(fields.password_hash);
    sets.push(`password_hash = $${params.length}`);
  }
  if (!sets.length) return findById(userId);
  params.push(userId);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE user_id = $${params.length}
     RETURNING user_id, username, email, full_name, role, status, created_at, last_login`,
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
  findById,
  list,
  create,
  update,
  remove,
  updateLastLogin,
};
