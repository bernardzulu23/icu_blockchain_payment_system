const { pool } = require('../config/database');

async function findById(studentId) {
  const { rows } = await pool.query('SELECT * FROM students WHERE student_id = $1', [studentId]);
  return rows[0];
}

async function create({
  studentId,
  studentNumber,
  firstName,
  lastName,
  email,
  phone,
  program,
  department,
  admissionYear,
  dateOfBirth,
  currentSemester,
  currentTerm,
  passwordHash,
}) {
  const { rows } = await pool.query(
    `INSERT INTO students (student_id, student_number, first_name, last_name, email, phone,
       program, department, admission_year, date_of_birth, current_semester, current_term, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING student_id, student_number, first_name, last_name, email, program, status`,
    [
      studentId,
      studentNumber || studentId,
      firstName,
      lastName,
      email || null,
      phone || null,
      program || null,
      department || null,
      admissionYear || null,
      dateOfBirth || null,
      currentSemester || null,
      currentTerm || null,
      passwordHash,
    ]
  );
  return rows[0];
}

async function ensureExists(studentId, studentName) {
  const existing = await findById(studentId);
  if (existing) return existing;
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('change-me-' + Date.now(), 10);
  const [first, ...rest] = (studentName || `Student ${studentId}`).split(' ');
  const lastName = rest.join(' ') || studentId;
  await pool.query(
    `INSERT INTO students (student_id, student_number, first_name, last_name, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (student_id) DO NOTHING`,
    [studentId, studentId, first || 'Student', lastName, hash]
  );
  return findById(studentId);
}

module.exports = { findById, create, ensureExists };
