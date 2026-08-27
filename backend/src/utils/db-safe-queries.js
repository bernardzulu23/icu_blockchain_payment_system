/**
 * ICU Pay — SQL Injection Hardening (PostgreSQL / node-postgres)
 *
 * Rule: NEVER concatenate user input into SQL text. Values always use $1, $2, …
 * Dynamic column/table names only from fixed allowlists.
 *
 * Uses the shared pool from config/database.js — do not create a second Pool here.
 */
const { pool, query, getClient } = require('../config/database');

/** Tables the app may reference by logical key (never from raw user input). */
const ALLOWED_TABLES = Object.freeze({
  users: { table: 'users', idColumn: 'user_id' },
  students: { table: 'students', idColumn: 'student_id' },
  student_payments: { table: 'student_payments', idColumn: 'payment_id' },
  audit_logs: { table: 'audit_logs', idColumn: 'log_id' },
});

const STUDENT_SEARCH_FILTERS = Object.freeze({
  status: 'status',
  program: 'program',
  currentSemester: 'current_semester',
  department: 'department',
});

function resolveTable(logicalKey) {
  const meta = ALLOWED_TABLES[logicalKey];
  if (!meta) {
    throw new Error(`Disallowed table reference: ${logicalKey}`);
  }
  return meta;
}

/**
 * Build a parameterized WHERE clause from an allowlisted filter map.
 * @returns {{ whereSql: string, values: unknown[], nextIndex: number }}
 */
function buildFilterClause(filters, allowedColumns, startIndex = 1) {
  const clauses = [];
  const values = [];
  let paramIndex = startIndex;

  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null || value === '') continue;
    const column = allowedColumns[key];
    if (!column) continue;
    clauses.push(`${column} = $${paramIndex}`);
    values.push(value);
    paramIndex += 1;
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
    nextIndex: paramIndex,
  };
}

/**
 * Build parameterized SET fragments for UPDATE from an allowlisted column list.
 * @returns {{ sets: string[], params: unknown[] }}
 */
function buildUpdateClause(fields, allowedKeys) {
  const allowed = new Set(allowedKeys);
  const sets = [];
  const params = [];

  for (const [key, value] of Object.entries(fields || {})) {
    if (!allowed.has(key) || value === undefined) continue;
    params.push(value);
    sets.push(`${key} = $${params.length}`);
  }

  return { sets, params };
}

async function runInTransaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findStudentById(studentId) {
  const { rows } = await query(
    `SELECT student_id, student_number, first_name, last_name, email, phone,
            program, department, current_semester, status
     FROM students
     WHERE student_id = $1`,
    [studentId]
  );
  return rows[0] || null;
}

async function findPaymentRecords(studentId, semester) {
  const { rows } = await query(
    `SELECT payment_id, student_id, amount, batch_number, status, verified_date, semester, academic_year
     FROM student_payments
     WHERE student_id = $1 AND semester = $2
     ORDER BY verified_date DESC NULLS LAST, created_at DESC`,
    [studentId, semester]
  );
  return rows;
}

async function insertVerifiedPayment(
  client,
  { studentId, semester, academicYear, amount, batchNumber, verifiedBy, statementPdfHash }
) {
  const db = client || pool;
  const { rows } = await db.query(
    `INSERT INTO student_payments (
       student_id, semester, academic_year, amount, batch_number,
       payment_date, status, verified_date, verified_by, statement_pdf_hash, matched_with_bank
     )
     VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'verified', NOW(), $6, $7, TRUE)
     RETURNING payment_id, statement_pdf_hash`,
    [studentId, semester, academicYear, amount, batchNumber, verifiedBy, statementPdfHash || null]
  );
  return rows[0];
}

async function searchStudents(filters = {}, { limit = 50, offset = 0 } = {}) {
  const { whereSql, values, nextIndex } = buildFilterClause(filters, STUDENT_SEARCH_FILTERS);
  values.push(limit, offset);

  const { rows } = await query(
    `SELECT student_id, student_number, first_name, last_name, program, current_semester, status
     FROM students
     ${whereSql}
     ORDER BY last_name, first_name
     LIMIT $${nextIndex} OFFSET $${nextIndex + 1}`,
    values
  );
  return rows;
}

/** Write audit row inside an open transaction (client) or standalone. */
async function logAuditEvent(
  client,
  { actorId, actorType, action, targetTable, targetId, metadata, ipAddress, userAgent }
) {
  const db = client || pool;
  await db.query(
    `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      actorId || null,
      actorType || 'system',
      action,
      targetTable || null,
      targetId != null ? String(targetId) : null,
      metadata ? JSON.stringify(metadata) : null,
      ipAddress || null,
      userAgent || null,
    ]
  );
}

/**
 * Batch-verify payments in one transaction + audit trail.
 * Each record must already be validated (amount numeric, IDs UUID/VARCHAR-safe).
 */
async function submitVerifiedBatch(records, verifiedBy, { actorType = 'accountant' } = {}) {
  return runInTransaction(async (client) => {
    const inserted = [];
    for (const record of records) {
      const { rows } = await client.query(
        `UPDATE student_payments
         SET status = 'verified',
             verified_date = NOW(),
             verified_by = $1,
             statement_pdf_hash = COALESCE($2, statement_pdf_hash),
             matched_with_bank = TRUE,
             updated_at = NOW()
         WHERE payment_id = $3 AND status IN ('pending', 'manual_review', 'auto_matched')
         RETURNING payment_id, statement_pdf_hash, student_id`,
        [verifiedBy, record.statementPdfHash || null, record.paymentId]
      );
      if (rows[0]) inserted.push(rows[0]);
    }

    await logAuditEvent(client, {
      actorId: verifiedBy,
      actorType,
      action: 'BATCH_VERIFY',
      targetTable: 'student_payments',
      targetId: null,
      metadata: { count: inserted.length, paymentIds: inserted.map((r) => r.payment_id) },
    });

    return inserted;
  });
}

module.exports = {
  ALLOWED_TABLES,
  STUDENT_SEARCH_FILTERS,
  resolveTable,
  buildFilterClause,
  buildUpdateClause,
  runInTransaction,
  findStudentById,
  findPaymentRecords,
  insertVerifiedPayment,
  searchStudents,
  logAuditEvent,
  submitVerifiedBatch,
};
