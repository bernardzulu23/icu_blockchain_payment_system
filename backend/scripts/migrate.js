require('dotenv').config();
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
