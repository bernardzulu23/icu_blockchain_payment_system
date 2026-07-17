const { pool } = require('../config/database');
const { requireAdmin } = require('../middleware/rbac');

const { parsePagination, paginatedResponse } = require('../utils/pagination');

async function getStats(req, res, next) {
  try {
    const { rows: paymentStats } = await pool.query(`
      SELECT status, COUNT(*) as count FROM student_payments GROUP BY status
    `);
    const { rows: totalPayments } = await pool.query(
      'SELECT COUNT(*) as count FROM student_payments'
    );
    const { rows: totalStudents } = await pool.query('SELECT COUNT(*) as count FROM students');
    const { rows: totalAmount } = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM student_payments WHERE status = 'verified'"
    );
    res.json({
      payments: paymentStats,
      totalPayments: parseInt(totalPayments[0].count),
      totalStudents: parseInt(totalStudents[0].count),
      totalVerifiedAmount: parseFloat(totalAmount[0].total),
    });
  } catch (err) {
    next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const { page, limit, offset } = parsePagination(req.query, 50, 200);
    const { rows } = await pool.query(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM audit_logs');
    res.json(paginatedResponse(rows, parseInt(countRows[0].count, 10), page, limit));
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats, getAuditLogs };
