const { pool } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

async function listByStatement(statementId, queryParams = {}) {
  const { page, limit, offset } = parsePagination(queryParams);
  const { rows } = await pool.query(
    `SELECT * FROM bank_transactions WHERE statement_id = $1
     ORDER BY transaction_date DESC, created_at DESC
     LIMIT $2 OFFSET $3`,
    [statementId, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*) FROM bank_transactions WHERE statement_id = $1',
    [statementId]
  );
  return paginatedResponse(rows, parseInt(countRows[0].count, 10), page, limit);
}

async function findById(transactionId) {
  const { rows } = await pool.query('SELECT * FROM bank_transactions WHERE transaction_id = $1', [
    transactionId,
  ]);
  return rows[0];
}

async function updateMatch(transactionId, { matchedWithStudent, matchedPaymentId }) {
  const { rows } = await pool.query(
    `UPDATE bank_transactions
     SET matched_with_student = $1, matched_payment_id = $2
     WHERE transaction_id = $3 RETURNING *`,
    [matchedWithStudent, matchedPaymentId || null, transactionId]
  );
  return rows[0];
}

module.exports = { listByStatement, findById, updateMatch };
