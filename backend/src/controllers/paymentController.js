const { query, getClient } = require('../config/database');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const { getCurrentSemester, generateTxHash } = require('../utils/helpers');
const auditService = require('../services/auditService');
const { createAuditLog } = require('../services/auditService');
const pdfService = require('../services/pdfService');
const { uploadToStorage } = require('../services/storageService');
const { sendNotification } = require('../services/notificationService');
const { handleValidation } = require('../utils/validators');
const logger = require('../utils/logger');

async function list(req, res, next) {
  try {
    const { status, page, limit } = req.query;
    const result = await Payment.list({
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { studentId, amount, reference, studentName, bankName } = req.body;
    const { semester, academicYear } = getCurrentSemester();
    await Student.ensureExists(studentId, studentName);
    const payment = await Payment.create({
      studentId,
      semester,
      academicYear,
      amount,
      batchNumber: reference,
      bankName: bankName || null,
    });
    res.status(201).json(payment);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Duplicate payment for this semester already exists' });
    }
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    const validStatuses = ['pending', 'manual_review', 'auto_matched'];
    if (!validStatuses.includes(payment.status)) {
      return res.status(400).json({ message: 'Payment already processed' });
    }
    const txHash = generateTxHash(payment.id);
    const verified = await Payment.verify(req.params.id, {
      blockchainTxId: txHash,
      verifiedBy: req.user.userId,
    });
    await auditService.log({
      userId: req.user.userId,
      userType: req.user.role,
      action: 'verify_payment',
      entityType: 'student_payment',
      entityId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      details: { studentId: payment.studentId, batchNumber: payment.reference },
    });
    res.json(verified);
  } catch (err) {
    next(err);
  }
}

async function receipt(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    const buffer = await pdfService.generateReceiptPdf({
      studentId: payment.studentId,
      studentName: payment.studentName,
      amount: payment.amount,
      reference: payment.reference,
      date: new Date(payment.createdAt).toLocaleDateString(),
      txHash: payment.txHash,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${payment.reference}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function submitPayment(req, res) {
  const client = await getClient();

  try {
    const student_id = req.user.student_id || req.user.userId;
    const {
      semester,
      academic_year,
      amount,
      batch_number,
      bank_name,
      payment_date,
    } = req.body;

    const depositSlipFile = req.file;

    if (!semester || !academic_year || !amount || !batch_number || !payment_date) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['semester', 'academic_year', 'amount', 'batch_number', 'payment_date'],
      });
    }

    if (!depositSlipFile) {
      return res.status(400).json({ error: 'Deposit slip image required' });
    }

    await client.query('BEGIN');

    const duplicateCheck = await client.query(
      `SELECT payment_id, status, verified_date, statement_pdf_url, amount
       FROM student_payments
       WHERE student_id = $1 AND semester = $2 AND academic_year = $3`,
      [student_id, semester, academic_year]
    );

    if (duplicateCheck.rows.length > 0) {
      const existing = duplicateCheck.rows[0];

      if (existing.status === 'verified') {
        await client.query('ROLLBACK');
        logger.warn(
          `Duplicate payment attempt blocked: Student ${student_id}, Semester ${semester}, ${academic_year}`
        );
        return res.status(400).json({
          error: 'DUPLICATE_PAYMENT_DETECTED',
          message: `YOU ALREADY PAID FOR ${semester}, ${academic_year}`,
          details: {
            amount: `K${parseFloat(existing.amount).toFixed(2)}`,
            verifiedDate: existing.verified_date,
            statementUrl: existing.statement_pdf_url,
          },
          warning:
            'DO NOT PAY AGAIN! You will lose your money. Download your statement below as proof.',
          action: 'Download your payment statement and show it to the accounts office if needed.',
        });
      }

      if (existing.status === 'pending' || existing.status === 'manual_review') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Payment already submitted',
          message: `You already submitted payment for ${semester}, ${academic_year}. Status: ${existing.status}`,
          suggestion: 'Please wait for verification or contact accounts office.',
        });
      }
    }

    const slipUrl = await uploadToStorage(depositSlipFile, 'deposit-slips');

    const insertResult = await client.query(
      `INSERT INTO student_payments
       (student_id, semester, academic_year, amount, batch_number, bank_name,
        payment_date, deposit_slip_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING payment_id, created_at`,
      [student_id, semester, academic_year, amount, batch_number, bank_name, payment_date, slipUrl]
    );

    const payment = insertResult.rows[0];

    await createAuditLog({
      user_id: student_id,
      user_type: 'student',
      action: 'PAYMENT_SUBMITTED',
      entity_type: 'payment',
      entity_id: payment.payment_id,
      details: { semester, academic_year, amount, batch_number },
      ip_address: req.ip,
    });

    await sendNotification({
      recipient_id: student_id,
      recipient_type: 'student',
      type: 'PAYMENT_SUBMITTED',
      title: 'Payment Submitted for Verification',
      message: `Your payment for ${semester}, ${academic_year} (K${amount}) has been submitted. Batch: ${batch_number}. You will be notified once verified.`,
      channels: ['email', 'sms'],
    });

    await client.query('COMMIT');

    logger.info(`Payment submitted: ${student_id} - ${semester}, ${academic_year}`);

    res.status(201).json({
      success: true,
      message: 'Payment submitted successfully',
      payment: {
        payment_id: payment.payment_id,
        semester,
        academic_year,
        amount,
        batch_number,
        status: 'pending',
        submitted_at: payment.created_at,
      },
      next_steps: [
        'Wait for accountant to upload bank statement',
        'System will automatically match your payment',
        'You will receive SMS/Email when verified',
      ],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Payment submission error:', error);
    res.status(500).json({
      error: 'Failed to submit payment',
      message: 'An error occurred. Please try again or contact support.',
    });
  } finally {
    client.release();
  }
}

async function getPaymentHistory(req, res) {
  try {
    const student_id = req.user.student_id || req.user.userId;

    const result = await query(
      `SELECT
        payment_id,
        semester,
        academic_year,
        amount,
        batch_number,
        bank_name,
        payment_date,
        status,
        verified_date,
        verified_by,
        statement_pdf_url,
        created_at
       FROM student_payments
       WHERE student_id = $1
       ORDER BY created_at DESC`,
      [student_id]
    );

    const stats = {
      total_payments: result.rows.length,
      verified_payments: result.rows.filter((p) => p.status === 'verified').length,
      pending_payments: result.rows.filter((p) => p.status === 'pending').length,
      total_amount_paid: result.rows
        .filter((p) => p.status === 'verified')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0),
    };

    res.json({
      success: true,
      payments: result.rows,
      stats,
    });
  } catch (error) {
    logger.error('Get payment history error:', error);
    res.status(500).json({
      error: 'Failed to fetch payment history',
      message: 'Please try again later',
    });
  }
}

async function downloadStatement(req, res) {
  try {
    const student_id = req.user.student_id || req.user.userId;
    const payment_id = req.params.id;

    const result = await query(
      `SELECT statement_pdf_url, semester, academic_year, verified_date, amount
       FROM student_payments
       WHERE payment_id = $1 AND student_id = $2 AND status = 'verified'`,
      [payment_id, student_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Statement not found',
        message: 'This payment has not been verified yet or does not exist.',
      });
    }

    const payment = result.rows[0];

    if (!payment.statement_pdf_url) {
      return res.status(404).json({
        error: 'Statement PDF not available',
        message: 'The statement is being generated. Please try again in a few minutes.',
      });
    }

    await createAuditLog({
      user_id: student_id,
      user_type: 'student',
      action: 'STATEMENT_DOWNLOADED',
      entity_type: 'payment',
      entity_id: payment_id,
      ip_address: req.ip,
    });

    logger.info(`Statement downloaded: ${student_id} - Payment ${payment_id}`);

    res.json({
      success: true,
      download_url: payment.statement_pdf_url,
      payment_details: {
        semester: payment.semester,
        academic_year: payment.academic_year,
        amount: payment.amount,
        verified_date: payment.verified_date,
      },
    });
  } catch (error) {
    logger.error('Download statement error:', error);
    res.status(500).json({ error: 'Failed to download statement' });
  }
}

async function checkPaymentExists(req, res) {
  try {
    const student_id = req.user.student_id || req.user.userId;
    const { semester, academic_year } = req.query;

    if (!semester || !academic_year) {
      return res.status(400).json({
        error: 'Semester and academic year required',
      });
    }

    const result = await query(
      `SELECT payment_id, status, amount, verified_date, statement_pdf_url
       FROM student_payments
       WHERE student_id = $1 AND semester = $2 AND academic_year = $3`,
      [student_id, semester, academic_year]
    );

    if (result.rows.length > 0) {
      const payment = result.rows[0];

      return res.json({
        exists: true,
        payment: {
          payment_id: payment.payment_id,
          status: payment.status,
          amount: payment.amount,
          verified_date: payment.verified_date,
          statement_url: payment.statement_pdf_url,
        },
        warning:
          payment.status === 'verified'
            ? 'You have already paid for this semester. DO NOT PAY AGAIN!'
            : 'You have already submitted payment for this semester. It is pending verification.',
      });
    }

    res.json({
      exists: false,
      message: 'No payment found for this semester. You can proceed to upload.',
    });
  } catch (error) {
    logger.error('Check payment exists error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
}

module.exports = {
  list,
  getById,
  create,
  verify,
  receipt,
  submitPayment,
  getPaymentHistory,
  downloadStatement,
  checkPaymentExists,
};
