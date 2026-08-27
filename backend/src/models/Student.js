const { pool } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { buildUpdateClause } = require('../utils/db-safe-queries');

async function findById(studentId) {
  const { rows } = await pool.query(
    `SELECT student_id, student_number, first_name, last_name, email, phone, program, department,
            admission_year, date_of_birth, current_semester, current_term, profile_picture_url,
            status, created_at, updated_at
     FROM students WHERE student_id = $1`,
    [studentId]
  );
  return rows[0];
}

async function list(queryParams = {}) {
  const { page, limit, offset, search } = parsePagination(queryParams);
  const status = queryParams.status;
  const params = [];
  let where = 'WHERE 1=1';

  if (status) {
    params.push(status);
    where += ` AND status = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    const i = params.length;
    where += ` AND (student_id ILIKE $${i} OR student_number ILIKE $${i} OR first_name ILIKE $${i} OR last_name ILIKE $${i} OR email ILIKE $${i})`;
  }

  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT student_id, student_number, first_name, last_name, email, phone, program, department,
            admission_year, current_semester, status, created_at
     FROM students ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const countParams = params.slice(0, -2);
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM students ${where}`,
    countParams
  );

  return paginatedResponse(rows, parseInt(countRows[0].count, 10), page, limit);
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

async function update(studentId, fields) {
  const allowed = [
    'first_name',
    'last_name',
    'email',
    'phone',
    'program',
    'department',
    'admission_year',
    'date_of_birth',
    'current_semester',
    'current_term',
    'profile_picture_url',
    'status',
    'password_hash',
  ];
  const { sets, params } = buildUpdateClause(fields, allowed);
  if (!sets.length) return findById(studentId);
  params.push(studentId);
  sets.push('updated_at = NOW()');
  const { rows } = await pool.query(
    `UPDATE students SET ${sets.join(', ')} WHERE student_id = $${params.length}
     RETURNING student_id, student_number, first_name, last_name, email, phone, program, department,
               admission_year, date_of_birth, current_semester, current_term, profile_picture_url,
               status, created_at, updated_at`,
    params
  );
  return rows[0];
}

async function remove(studentId) {
  const { rows } = await pool.query(
    `UPDATE students SET status = 'suspended', updated_at = NOW() WHERE student_id = $1 RETURNING student_id`,
    [studentId]
  );
  return rows[0];
}

module.exports = { findById, list, create, update, remove };
