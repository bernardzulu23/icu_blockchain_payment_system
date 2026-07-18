const { pool } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

async function create({ uploadDate, bankName, statementPdfUrl, uploadedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO bank_statements (upload_date, bank_name, statement_pdf_url, uploaded_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [uploadDate, bankName, statementPdfUrl, uploadedBy]
  );
  return rows[0];
}

async function list(queryParams = {}) {
  const { page, limit, offset } = parsePagination(queryParams);
  const { rows } = await pool.query(
    `SELECT statement_id, upload_date, bank_name, statement_pdf_url, uploaded_by,
            processed, total_transactions, matched_count, unmatched_count, created_at
     FROM bank_statements
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM bank_statements');
  return paginatedResponse(rows, parseInt(countRows[0].count, 10), page, limit);
}

async function updateProcessed(statementId, { totalTransactions, matchedCount, unmatchedCount }) {
  await pool.query(
    `UPDATE bank_statements SET processed = TRUE, total_transactions = $1, matched_count = $2, unmatched_count = $3 WHERE statement_id = $4`,
    [totalTransactions, matchedCount, unmatchedCount, statementId]
  );
}

async function findById(statementId) {
  const { rows } = await pool.query('SELECT * FROM bank_statements WHERE statement_id = $1', [
    statementId,
  ]);
  return rows[0];
}

async function remove(statementId) {
  const { rowCount } = await pool.query('DELETE FROM bank_statements WHERE statement_id = $1', [
    statementId,
  ]);
  return rowCount > 0;
}

module.exports = { create, list, updateProcessed, findById, remove };
