const bcrypt = require('bcrypt');
const env = require('../config/environment');

async function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

module.exports = { hashPassword };
