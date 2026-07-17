/**
 * Reset admin user password to admin123.
 * Run: node scripts/reset-admin-password.js
 */
require('dotenv').config();
const { pool, connectDB } = require('../src/config/database');
const bcrypt = require('bcrypt');
const env = require('../src/config/environment');

async function reset() {
  await connectDB();
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash('admin123', env.BCRYPT_ROUNDS);
    const result = await client.query(
      `UPDATE users SET password_hash = $1 WHERE username = 'admin' OR email = 'admin@icu.edu.zm' RETURNING user_id, username, email`,
      [hash]
    );
    if (result.rowCount === 0) {
      console.log('No admin user found. Run: node scripts/seed.js');
      process.exit(1);
    }
    console.log('Admin password reset successfully.');
    console.log('Login with: username "admin" (or admin@icu.edu.zm) / password "admin123"');
  } finally {
    client.release();
    process.exit(0);
  }
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
