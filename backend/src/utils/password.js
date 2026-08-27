const { hashPassword, verifyPassword, isPasswordStrong } = require('../middleware/auth-hardening');

module.exports = { hashPassword, verifyPassword, isPasswordStrong };
