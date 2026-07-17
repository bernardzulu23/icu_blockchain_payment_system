require('dotenv').config();
const { pool, connectDB } = require('../src/config/database');

async function seed() {
  await connectDB();
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) > 0) {
      console.log('Seed already applied');
      return;
    }
    const bcrypt = require('bcrypt');
    const env = require('../src/config/environment');
    const hash = await bcrypt.hash('admin123', env.BCRYPT_ROUNDS);
    await client.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, status)
       VALUES ('admin', 'admin@icu.edu.zm', $1, 'admin', 'System Administrator', 'active')`,
      [hash]
    );
    console.log('Admin user created: admin@icu.edu.zm / admin123');
  } finally {
    client.release();
    process.exit(0);
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
