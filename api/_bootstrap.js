/** Shared Vercel serverless bootstrap (env + DNS). */
const path = require('path');
const dns = require('dns');

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* Node < 17 */
}

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.env.BLOCKCHAIN_OPTIONAL = process.env.BLOCKCHAIN_OPTIONAL || 'true';
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED || 'false';
process.env.TRUST_PROXY = process.env.TRUST_PROXY || 'true';
process.env.UPLOAD_PATH = process.env.UPLOAD_PATH || '/tmp/uploads';

module.exports = {};
