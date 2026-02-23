const { pool } = require('../config/database');

async function create({ uploadDate, bankName, statementPdfUrl, uploadedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO bank_statements (upload_date, bank_name, statement_pdf_url, uploaded_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [uploadDate, bankName, statementPdfUrl, uploadedBy]
  );
  return rows[0];
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

module.exports = { create, updateProcessed, findById };
