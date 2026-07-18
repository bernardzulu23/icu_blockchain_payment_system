require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });

// Neon: always prefer direct (non-pooling) URL for DDL migrations
process.env.DATABASE_URL =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;
const { initDb } = require('../src/config/database');

async function migrate() {
  await initDb();
  console.log('Migrations complete');
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
