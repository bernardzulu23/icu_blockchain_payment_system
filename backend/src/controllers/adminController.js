const { pool } = require('../config/database');
const { requireAdmin } = require('../middleware/rbac');

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
    const { limit = 50 } = req.query;
    const { rows } = await pool.query(
      'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1',
      [parseInt(limit)]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { getStats, getAuditLogs };
