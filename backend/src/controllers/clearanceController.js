const path = require('path');
const fs = require('fs');
const Clearance = require('../models/Clearance');
const { pool } = require('../config/database');
const env = require('../config/environment');
const { generatePaymentCompletionCertificatePDF } = require('../services/pdfService');
const logger = require('../utils/logger');

const EXPECTED_SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];

async function generateCertificateForClearance(clearanceId) {
  const { rows: clearanceRows } = await pool.query(
    `SELECT cr.*, s.student_number, s.first_name, s.last_name, s.program
     FROM clearance_requests cr
     JOIN students s ON cr.student_id = s.student_id
     WHERE cr.clearance_id = $1`,
    [clearanceId]
  );
  if (clearanceRows.length === 0) return null;
  const clearance = clearanceRows[0];
  const studentName = `${clearance.first_name || ''} ${clearance.last_name || ''}`.trim();

  const { rows: payments } = await pool.query(
    `SELECT semester, academic_year, amount, payment_date, batch_number
     FROM student_payments
     WHERE student_id = $1 AND status = 'verified'
     ORDER BY semester, academic_year`,
    [clearance.student_id]
  );

  const { rows: signers } = await pool.query(
    `SELECT role, full_name FROM users WHERE status = 'active' AND role IN ('accountant', 'admin', 'registrar')`
  );
  const byRole = {};
  for (const s of signers) {
    if (!byRole[s.role]) byRole[s.role] = s.full_name;
  }

  try {
    const url = await generatePaymentCompletionCertificatePDF({
      student_number: clearance.student_number,
      student_name: studentName,
      program: clearance.program,
      payments,
      accountant_signer: byRole.accountant || '',
      admin_signer: byRole.admin || '',
      registrar_signer: byRole.registrar || '',
    });
    await Clearance.updateCertificateUrl(clearanceId, url);
    return url;
  } catch (err) {
    logger.error('Certificate generation failed:', err);
    return null;
  }
}

async function requestClearance(req, res, next) {
  try {
    const { studentId, clearanceType, clearance_type } = req.body;
    const sid = studentId || req.params.studentId || req.user?.student_id || req.user?.userId;
    const type = clearanceType || clearance_type || 'graduation';

    if (!sid) {
      return res.status(400).json({ error: 'Student ID required' });
    }

    // 1) Get student's verified payments (semester + batch_number) from DB
    const { rows: studentPayments } = await pool.query(
      `SELECT semester, batch_number FROM student_payments
       WHERE student_id = $1 AND status = 'verified'
       ORDER BY semester`,
      [sid]
    );

    const paidSemesters = [...new Set(studentPayments.map((p) => String(p.semester).trim()).filter(Boolean))];
    const missingSemesters = EXPECTED_SEMESTERS.filter((s) => !paidSemesters.includes(s));
    if (missingSemesters.length > 0) {
      return res.status(400).json({
        eligible: false,
        missing_semesters: missingSemesters,
        message: `Clearance denied. Upload deposit slips and have payments verified for semesters: ${missingSemesters.join(', ')}.`,
      });
    }

    // 2) Get batch numbers that appear in bank-uploaded statements (PDF from bank)
    const { rows: bankBatches } = await pool.query(
      `SELECT DISTINCT TRIM(batch_number) AS batch_number FROM bank_transactions`
    );
    const bankBatchSet = new Set(bankBatches.map((r) => String(r.batch_number).trim().toUpperCase()));

    if (bankBatchSet.size === 0) {
      return res.status(400).json({
        eligible: false,
        message: 'Clearance is not available yet. Admin must upload the latest bank batch PDF so your deposit slip batch numbers can be cross-referenced.',
      });
    }

    // 3) Cross-reference: each semester's payment batch must be in the bank list
    const normalizeBatch = (b) => String(b || '').trim().toUpperCase();
    const semestersNotConfirmed = [];
    for (const sem of EXPECTED_SEMESTERS) {
      const payment = studentPayments.find((p) => String(p.semester).trim() === sem);
      if (!payment) {
        semestersNotConfirmed.push(sem);
        continue;
      }
      const batch = normalizeBatch(payment.batch_number);
      if (!batch || !bankBatchSet.has(batch)) {
        semestersNotConfirmed.push(sem);
      }
    }

    if (semestersNotConfirmed.length > 0) {
      return res.status(400).json({
        eligible: false,
        missing_semesters: [],
        bank_not_confirmed_semesters: semestersNotConfirmed,
        message: `Clearance denied. Payment batch numbers for semester(s) ${semestersNotConfirmed.join(', ')} have not yet been confirmed against the bank statement. Admin must upload the latest bank batch PDF.`,
      });
    }

    const clearance = await Clearance.create({
      studentId: sid,
      clearanceType: type,
    });
    res.status(201).json(clearance);
  } catch (err) {
    next(err);
  }
}

async function getByStudent(req, res, next) {
  try {
    const clearances = await Clearance.findByStudent(req.params.studentId);
    res.json(clearances);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status, rejection_reason, rejectionReason } = req.body;
    const approvedBy = req.user.userId || req.user.user_id || req.user.full_name;
    await Clearance.updateStatus(req.params.id, {
      status,
      approvedBy,
      approvedDate: new Date(),
      rejectionReason: rejection_reason || rejectionReason,
    });
    if (status === 'approved') {
      generateCertificateForClearance(req.params.id).catch((err) =>
        logger.error('Certificate generation failed for clearance:', err)
      );
    }
    res.json({ message: 'Clearance status updated' });
  } catch (err) {
    next(err);
  }
}

async function listAll(req, res, next) {
  try {
    const { status } = req.query;
    const rows = await Clearance.findAll({ status });
    res.json({ requests: rows });
  } catch (err) {
    next(err);
  }
}

async function massVerify(req, res, next) {
  try {
    const { clearanceIds, status } = req.body;
    if (!Array.isArray(clearanceIds) || clearanceIds.length === 0) {
      return res.status(400).json({ error: 'clearanceIds array required' });
    }
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }
    const approvedBy = req.user.userId || req.user.user_id || req.user.full_name;
    const count = await Clearance.massUpdateStatus(clearanceIds, {
      status,
      approvedBy,
      approvedDate: new Date(),
      rejectionReason: null,
    });
    if (status === 'approved') {
      for (const id of clearanceIds) {
        generateCertificateForClearance(id).catch((err) =>
          logger.error(`Certificate generation failed for clearance ${id}:`, err)
        );
      }
    }
    res.json({ message: `${count} clearance(s) ${status}`, count });
  } catch (err) {
    next(err);
  }
}

async function downloadCertificate(req, res, next) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT cr.*, s.student_number FROM clearance_requests cr
       JOIN students s ON cr.student_id = s.student_id
       WHERE cr.clearance_id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Clearance not found' });
    }
    const clearance = rows[0];
    const isStaff = ['accountant', 'admin', 'registrar'].includes(req.user?.role);
    const isOwnClearance = req.user?.student_id === clearance.student_id || req.user?.userId === clearance.student_id;

    if (!isStaff && !isOwnClearance) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const url = clearance.clearance_certificate_url;
    if (!url) {
      return res.status(404).json({ error: 'Certificate not yet generated' });
    }
    const filePath = path.join(process.cwd(), env.UPLOAD_PATH || 'uploads', 'statements', path.basename(url));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Certificate file not found' });
    }
    const filename = `certificate-completion-${clearance.student_number}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    next(err);
  }
}

module.exports = { requestClearance, getByStudent, updateStatus, listAll, massVerify, downloadCertificate };
