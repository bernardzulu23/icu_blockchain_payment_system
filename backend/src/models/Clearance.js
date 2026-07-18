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

async function findById(clearanceId) {
  const { rows } = await pool.query(
    `SELECT cr.*, s.first_name, s.last_name, s.student_number
     FROM clearance_requests cr
     LEFT JOIN students s ON cr.student_id = s.student_id
     WHERE cr.clearance_id = $1`,
    [clearanceId]
  );
  return rows[0];
}

async function findAll(filters = {}) {
  const { status } = filters;
  let sql = `
    SELECT cr.*, s.first_name, s.last_name, s.student_number
    FROM clearance_requests cr
    LEFT JOIN students s ON cr.student_id = s.student_id
    ORDER BY cr.requested_date DESC
  `;
  const params = [];
  if (status) {
    sql = `
      SELECT cr.*, s.first_name, s.last_name, s.student_number
      FROM clearance_requests cr
      LEFT JOIN students s ON cr.student_id = s.student_id
      WHERE cr.status = $1
      ORDER BY cr.requested_date DESC
    `;
    params.push(status);
  }
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function massUpdateStatus(clearanceIds, { status, approvedBy, approvedDate, rejectionReason }) {
  if (!clearanceIds?.length) return 0;
  const placeholders = clearanceIds.map((_, i) => `$${i + 5}`).join(',');
  const params = [status, approvedBy, approvedDate, rejectionReason || null, ...clearanceIds];
  const { rowCount } = await pool.query(
    `UPDATE clearance_requests
     SET status = $1, approved_by = $2, approved_date = $3, rejection_reason = $4
     WHERE clearance_id IN (${placeholders})`,
    params
  );
  return rowCount;
}

async function updateStatus(clearanceId, { status, approvedBy, approvedDate, rejectionReason, certificateUrl }) {
  const updates = ['status = $1', 'approved_by = $2', 'approved_date = $3', 'rejection_reason = $4'];
  const params = [status, approvedBy, approvedDate, rejectionReason || null];
  if (certificateUrl != null) {
    updates.push('clearance_certificate_url = $5');
    params.push(certificateUrl);
  }
  params.push(clearanceId);
  await pool.query(
    `UPDATE clearance_requests SET ${updates.join(', ')} WHERE clearance_id = $${params.length}`,
    params
  );
}

async function updateCertificateUrl(clearanceId, certificateUrl) {
  await pool.query(
    'UPDATE clearance_requests SET clearance_certificate_url = $1 WHERE clearance_id = $2',
    [certificateUrl, clearanceId]
  );
}

async function remove(clearanceId) {
  const { rows } = await pool.query(
    `DELETE FROM clearance_requests WHERE clearance_id = $1 AND status = 'pending' RETURNING clearance_id`,
    [clearanceId]
  );
  return rows[0];
}

module.exports = { create, findById, findByStudent, findAll, updateStatus, massUpdateStatus, updateCertificateUrl, remove };
