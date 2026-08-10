const { pool } = require('../config/database');

function mapPayment(row) {
  const firstName = row.first_name || '';
  const lastName = row.last_name || '';
  const studentName = `${firstName} ${lastName}`.trim() || String(row.student_id);
  return {
    id: row.payment_id,
    studentId: row.student_id,
    studentName,
    amount: parseFloat(String(row.amount)),
    currency: 'ZMW',
    reference: row.batch_number,
    status: row.status,
    txHash: row.blockchain_tx_id,
    createdAt: row.created_at,
    verifiedAt: row.verified_date,
    semester: row.semester,
    academicYear: row.academic_year,
  };
}

async function list({ status, page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  let query = `
    SELECT sp.*, s.first_name, s.last_name
    FROM student_payments sp
    JOIN students s ON sp.student_id = s.student_id
  `;
  const params = [];
  if (status) {
    params.push(status);
    query += ' WHERE sp.status = $1';
  }
  query += ' ORDER BY sp.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
  params.push(limit, offset);
  const { rows } = await pool.query(query, params);
  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*) FROM student_payments' + (status ? ' WHERE status = $1' : ''),
    status ? [status] : []
  );
  return { payments: rows.map(mapPayment), total: parseInt(countRows[0].count) };
}

async function findById(paymentId) {
  const { rows } = await pool.query(
    `SELECT sp.*, s.first_name, s.last_name
     FROM student_payments sp
     JOIN students s ON sp.student_id = s.student_id
     WHERE sp.payment_id = $1`,
    [paymentId]
  );
  return rows[0] ? mapPayment(rows[0]) : null;
}

async function create({ studentId, semester, academicYear, amount, batchNumber, bankName }) {
  const { rows } = await pool.query(
    `INSERT INTO student_payments (student_id, semester, academic_year, amount, batch_number, bank_name, payment_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, 'pending')
     RETURNING *`,
    [studentId, semester, academicYear, amount, batchNumber, bankName]
  );
  const payment = rows[0];
  const { rows: sRows } = await pool.query(
    'SELECT first_name, last_name FROM students WHERE student_id = $1',
    [studentId]
  );
  const s = sRows[0];
  return mapPayment({ ...payment, first_name: s?.first_name, last_name: s?.last_name });
}

async function verify(paymentId, { blockchainTxId, verifiedBy }) {
  await pool.query(
    `UPDATE student_payments SET status = 'verified', blockchain_tx_id = $1, verified_date = NOW(), verified_by = $2, matched_with_bank = TRUE WHERE payment_id = $3`,
    [blockchainTxId, verifiedBy, paymentId]
  );
  return findById(paymentId);
}

async function findByStudentAndBatch(studentId, batchNumber, status = 'verified') {
  const { rows } = await pool.query(
    `SELECT sp.*, s.first_name, s.last_name
     FROM student_payments sp
     JOIN students s ON sp.student_id = s.student_id
     WHERE sp.student_id = $1 AND sp.batch_number = $2 AND sp.status = $3`,
    [studentId, batchNumber, status]
  );
  return rows[0] ? mapPayment(rows[0]) : null;
}

async function update(paymentId, fields) {
  // status is intentionally excluded — use verify/reject endpoints only
  const allowed = {
    semester: 'semester',
    academic_year: 'academicYear',
    amount: 'amount',
    batch_number: 'batchNumber',
    bank_name: 'bankName',
    payment_date: 'paymentDate',
  };
  const sets = [];
  const params = [];
  for (const [col, key] of Object.entries(allowed)) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (!sets.length) return findById(paymentId);
  params.push(paymentId);
  sets.push('updated_at = NOW()');
  await pool.query(
    `UPDATE student_payments SET ${sets.join(', ')} WHERE payment_id = $${params.length}`,
    params
  );
  return findById(paymentId);
}

async function remove(paymentId) {
  const { rows } = await pool.query(
    `DELETE FROM student_payments WHERE payment_id = $1 AND status IN ('pending', 'rejected') RETURNING payment_id`,
    [paymentId]
  );
  return rows[0];
}

module.exports = { list, findById, create, verify, findByStudentAndBatch, mapPayment, update, remove };
