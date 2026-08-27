const {
  clearExpiredLockout,
  recordFailedLogin,
  resetLoginFailures,
} = require('./accountLockoutService');
const {
  isAccountLocked,
  INVALID_CREDENTIALS_RESPONSE,
  LOCKOUT_RESPONSE,
} = require('../middleware/auth-hardening');

async function checkLoginAllowed(accountType, accountId) {
  const state = await clearExpiredLockout(accountType, accountId);
  if (state && isAccountLocked(state)) {
    return { allowed: false, status: 429, body: LOCKOUT_RESPONSE };
  }
  return {
    allowed: true,
    tokenVersion: state?.token_version ?? 0,
  };
}

module.exports = {
  checkLoginAllowed,
  recordFailedLogin,
  resetLoginFailures,
  INVALID_CREDENTIALS_RESPONSE,
  LOCKOUT_RESPONSE,
};
