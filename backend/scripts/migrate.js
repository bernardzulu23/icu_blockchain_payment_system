require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env.local') });

// Supabase: prefer direct (session) URL for DDL migrations — avoid transaction pooler
process.env.DATABASE_URL =
  process.env.DATABASE_DIRECT_URL ||
  process.env.SUPABASE_DB_DIRECT_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_PUBLIC_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

const { initDb } = require('../src/config/database');
const { ensureBucket, useSupabaseStorage } = require('../src/services/storageService');

async function migrate() {
  await initDb();
  if (useSupabaseStorage()) {
    await ensureBucket();
    console.log('Supabase storage bucket checked');
  }
  console.log('Migrations complete');
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
