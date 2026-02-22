const { pool } = require('../config/database');

async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1 AND status = $2',
    [email, 'active']
  );
  return rows[0];
}

async function findByUsername(username) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE username = $1 AND status = $2',
    [username, 'active']
  );
  return rows[0];
}

async function findById(userId) {
  const { rows } = await pool.query(
    'SELECT user_id, username, email, full_name, role, status FROM users WHERE user_id = $1',
    [userId]
  );
  return rows[0];
}

async function create({ username, email, passwordHash, role, fullName }) {
  const { rows } = await pool.query(
    `INSERT INTO users (username, email, password_hash, role, full_name, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING user_id, username, email, full_name, role`,
    [username, email, passwordHash, role, fullName]
  );
  return rows[0];
}

async function updateLastLogin(userId) {
  await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [userId]);
}

module.exports = { findByEmail, findByUsername, findById, create, updateLastLogin };
