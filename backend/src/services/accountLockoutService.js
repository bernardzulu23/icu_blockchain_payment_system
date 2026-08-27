const { query } = require('../config/database');
const { resolveTable } = require('../utils/db-safe-queries');
const { isAccountLocked, MAX_FAILED_ATTEMPTS } = require('../middleware/auth-hardening');

const TABLE_MAP = {
  staff: 'users',
  student: 'students',
};

function resolveTableMeta(accountType) {
  const logicalKey = TABLE_MAP[accountType];
  if (!logicalKey) throw new Error(`Unknown account type: ${accountType}`);
  return resolveTable(logicalKey);
}

async function fetchAuthSecurityState(accountType, accountId) {
  const { table, idColumn } = resolveTableMeta(accountType);
  const { rows } = await query(
    `SELECT failed_attempts, locked_at, token_version, status
     FROM ${table}
     WHERE ${idColumn} = $1`,
    [accountId]
  );
  return rows[0] || null;
}

async function clearExpiredLockout(accountType, accountId) {
  const state = await fetchAuthSecurityState(accountType, accountId);
  if (!state?.locked_at) return state;
  if (isAccountLocked(state)) return state;

  const { table, idColumn } = resolveTableMeta(accountType);
  await query(
    `UPDATE ${table}
     SET failed_attempts = 0, locked_at = NULL
     WHERE ${idColumn} = $1`,
    [accountId]
  );
  return { ...state, failed_attempts: 0, locked_at: null };
}

async function recordFailedLogin(accountType, accountId) {
  const { table, idColumn } = resolveTableMeta(accountType);
  const { rows } = await query(
    `UPDATE ${table}
     SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
         locked_at = CASE
           WHEN COALESCE(failed_attempts, 0) + 1 >= $2 THEN NOW()
           ELSE locked_at
         END
     WHERE ${idColumn} = $1
     RETURNING failed_attempts, locked_at`,
    [accountId, MAX_FAILED_ATTEMPTS]
  );
  return rows[0];
}

async function resetLoginFailures(accountType, accountId) {
  const { table, idColumn } = resolveTableMeta(accountType);
  await query(
    `UPDATE ${table}
     SET failed_attempts = 0, locked_at = NULL
     WHERE ${idColumn} = $1`,
    [accountId]
  );
}

async function incrementTokenVersion(accountType, accountId) {
  const { table, idColumn } = resolveTableMeta(accountType);
  const { rows } = await query(
    `UPDATE ${table}
     SET token_version = COALESCE(token_version, 0) + 1
     WHERE ${idColumn} = $1
     RETURNING token_version`,
    [accountId]
  );
  return rows[0]?.token_version ?? 0;
}

module.exports = {
  fetchAuthSecurityState,
  clearExpiredLockout,
  recordFailedLogin,
  resetLoginFailures,
  incrementTokenVersion,
};
