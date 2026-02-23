const { pool } = require('../config/database');

async function create({ studentId, clearanceType = 'graduation' }) {
  const { rows } = await pool.query(
    `INSERT INTO clearance_requests (student_id, clearance_type, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [studentId, clearanceType]
  );
  return rows[0];
}

async function findByStudent(studentId) {
  const { rows } = await pool.query(
    'SELECT * FROM clearance_requests WHERE student_id = $1 ORDER BY requested_date DESC',
    [studentId]
  );
  return rows;
}

async function updateStatus(clearanceId, { status, approvedBy, approvedDate, rejectionReason }) {
  await pool.query(
    `UPDATE clearance_requests SET status = $1, approved_by = $2, approved_date = $3, rejection_reason = $4 WHERE clearance_id = $5`,
    [status, approvedBy, approvedDate, rejectionReason, clearanceId]
  );
}

module.exports = { create, findByStudent, updateStatus };
