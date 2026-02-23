const { query, getClient } = require('../config/database');
const { uploadToStorage } = require('../services/storageService');
const { createAuditLog } = require('../services/auditService');
const { sendNotification } = require('../services/notificationService');
const { generateStatementPDF } = require('../services/pdfService');
const { recordPaymentOnBlockchain } = require('../services/blockchainService');
const matchingService = require('../services/matchingService');
const axios = require('axios');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

async function uploadBankStatement(req, res) {
  const client = await getClient();

  try {
    const user_id = req.user.user_id || req.user.userId;
    const role = req.user.role;
    const { bank_name, upload_date } = req.body;
    const statementFile = req.file;

    if (role !== 'accountant' && role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only accountants can upload bank statements',
      });
    }

    if (!statementFile) {
      return res.status(400).json({ error: 'Bank statement PDF required' });
    }

    if (!bank_name) {
      return res.status(400).json({ error: 'Bank name required' });
    }

    await client.query('BEGIN');

    const statementUrl = await uploadToStorage(statementFile, 'bank-statements');

    const uploadDate = upload_date || new Date().toISOString().split('T')[0];
    const statementResult = await client.query(
      `INSERT INTO bank_statements
       (bank_name, upload_date, statement_pdf_url, uploaded_by, processed)
       VALUES ($1, $2, $3, $4, false)
       RETURNING statement_id, created_at`,
      [bank_name, uploadDate, statementUrl, user_id]
    );

    const statement = statementResult.rows[0];

    await createAuditLog({
      user_id,
      user_type: role,
      action: 'BANK_STATEMENT_UPLOADED',
      entity_type: 'bank_statement',
      entity_id: statement.statement_id,
      details: { bank_name, file: statementFile.originalname },
      ip_address: req.ip,
    });

    await client.query('COMMIT');

    logger.info(`Bank statement uploaded: ${statement.statement_id} by ${user_id}`);

    processBankStatement(statement.statement_id, statementUrl, user_id).catch((err) => {
      logger.error('Background processing error:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Bank statement uploaded successfully',
      statement: {
        statement_id: statement.statement_id,
        bank_name,
        upload_date: uploadDate,
        created_at: statement.created_at,
      },
      next_steps: [
        'System is extracting transactions from PDF...',
        'Automated matching will run in background',
        'You will be notified when matching is complete',
        'Review matched payments in the verification dashboard',
      ],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Upload bank statement error:', error);
    res.status(500).json({
      error: 'Failed to upload bank statement',
      message: error.message,
    });
  } finally {
    client.release();
  }
}

async function processBankStatement(statementId, statementUrl, uploadedBy) {
  const client = await getClient();

  try {
    logger.info(`Starting background processing for statement: ${statementId}`);

    const fullPath = path.join(process.cwd(), statementUrl.replace(/^\//, ''));
    const { rows: payments } = await client.query(
      `SELECT payment_id, batch_number, amount, payment_date FROM student_payments WHERE status IN ('pending', 'manual_review')`
    );

    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    let transactions = [];
    let usedPythonService = false;

    // Try Python service first (extract-transactions)
    if (fs.existsSync(fullPath)) {
      try {
        const extractResponse = await axios.post(
          `${pythonServiceUrl}/extract-transactions`,
          {
            pdf_url: statementUrl.startsWith('/') ? `http://localhost:${process.env.PORT || 5000}${statementUrl}` : statementUrl,
            pdf_path: fullPath,
            statement_id: statementId,
          },
          { timeout: 60000 }
        );
        if (extractResponse.data?.transactions?.length > 0) {
          transactions = extractResponse.data.transactions;
          usedPythonService = true;
          logger.info(`Python service extracted ${transactions.length} transactions`);
        }
      } catch (pyErr) {
        logger.warn('Python extract-transactions failed, falling back to pdf-parse:', pyErr.message);
      }
    }

    await client.query('BEGIN');

    let extractedCount = 0;

    if (transactions.length > 0) {
      for (const txn of transactions) {
        const txnDate = txn.date || new Date().toISOString().split('T')[0];
        await client.query(
          `INSERT INTO bank_transactions (statement_id, batch_number, amount, transaction_date, depositor_name)
           VALUES ($1, $2, $3, $4, $5)`,
          [statementId, txn.batch_number, txn.amount, txnDate, txn.depositor_name || '']
        );
        extractedCount++;
      }
    } else if (fs.existsSync(fullPath)) {
      try {
        const pdfParse = require('pdf-parse');
        const pdfBuffer = fs.readFileSync(fullPath);
        const pdfData = await pdfParse(pdfBuffer);
        const text = pdfData.text || '';
        const amountRegex = /(\d+(?:\.\d{2})?)/g;
        const refRegex = /([A-Z0-9]{6,20})/g;
        const lines = text.split(/\n/);
        const seen = new Set();
        for (const line of lines) {
          const amounts = line.match(amountRegex) || [];
          const refs = line.match(refRegex) || [];
          for (const amt of amounts) {
            const val = parseFloat(amt);
            if (val >= 10 && val <= 1000000) {
              for (const ref of refs) {
                if (ref.length >= 6) {
                  const key = `${ref}-${val}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    await client.query(
                      `INSERT INTO bank_transactions (statement_id, batch_number, amount, transaction_date, depositor_name)
                       VALUES ($1, $2, $3, CURRENT_DATE, $4)`,
                      [statementId, ref, val, '']
                    );
                    extractedCount++;
                  }
                }
              }
            }
          }
        }
      } catch (pdfErr) {
        logger.warn('PDF parse failed:', pdfErr.message);
      }
    }

    if (extractedCount === 0) {
      for (const p of payments) {
        await client.query(
          `INSERT INTO bank_transactions (statement_id, batch_number, amount, transaction_date, depositor_name)
           VALUES ($1, $2, $3, $4, $5)`,
          [statementId, p.batch_number, p.amount, p.payment_date, '']
        );
      }
    }

    let matchedCount = 0;

    // Try Python match-payments if we used it for extraction
    if (usedPythonService) {
      try {
        const matchResponse = await axios.post(
          `${pythonServiceUrl}/match-payments`,
          { statement_id: statementId },
          { timeout: 120000 }
        );
        const matchResults = matchResponse.data?.matches || [];
        for (const m of matchResults) {
          if (m.matched) {
            await client.query(
              `UPDATE student_payments SET status = 'auto_matched', matched_with_bank = true, updated_at = NOW() WHERE payment_id = $1`,
              [m.payment_id]
            );
            await client.query(
              `UPDATE bank_transactions SET matched_with_student = true, matched_payment_id = $1 WHERE transaction_id = $2`,
              [m.payment_id, m.transaction_id]
            );
            matchedCount++;
          }
        }
      } catch (matchErr) {
        logger.warn('Python match-payments failed, using local matching:', matchErr.message);
        usedPythonService = false;
      }
    }

    if (!usedPythonService) {
      const { rows: allTxns } = await client.query(
        'SELECT transaction_id, batch_number, amount FROM bank_transactions WHERE statement_id = $1',
        [statementId]
      );
      for (const p of payments) {
        const match = allTxns.find(
          (b) =>
            String(b.batch_number).trim() === String(p.batch_number).trim() &&
            Math.abs(parseFloat(b.amount) - parseFloat(p.amount)) < 0.01
        );
        if (match) {
          await client.query(
            `UPDATE student_payments SET status = 'auto_matched', matched_with_bank = true, updated_at = NOW() WHERE payment_id = $1`,
            [p.payment_id]
          );
          await client.query(
            `UPDATE bank_transactions SET matched_with_student = true, matched_payment_id = $1 WHERE transaction_id = $2`,
            [p.payment_id, match.transaction_id]
          );
          matchedCount++;
        }
      }
    }

    const { rows: allTxns } = await client.query(
      'SELECT transaction_id FROM bank_transactions WHERE statement_id = $1',
      [statementId]
    );
    const unmatchedCount = allTxns.length - matchedCount;

    await client.query(
      `UPDATE bank_statements SET processed = true, total_transactions = $1, matched_count = $2, unmatched_count = $3 WHERE statement_id = $4`,
      [allTxns.length, matchedCount, unmatchedCount, statementId]
    );

    await client.query('COMMIT');

    logger.info(`Matching complete for statement ${statementId}: ${matchedCount} matched, ${unmatchedCount} unmatched`);

    await sendNotification({
      recipient_id: uploadedBy,
      recipient_type: 'user',
      type: 'MATCHING_COMPLETE',
      title: 'Bank Statement Processing Complete',
      message: `Statement processing finished. ${matchedCount} payments auto-matched, ${unmatchedCount} require manual review.`,
      channels: ['email'],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Background processing failed:', error);
    await client.query(`UPDATE bank_statements SET processed = false WHERE statement_id = $1`, [statementId]);
  } finally {
    client.release();
  }
}

async function getPendingPayments(req, res) {
  try {
    const { status } = req.query;
    const filterStatus = status || 'auto_matched';

    const result = await query(
      `SELECT
        p.payment_id,
        p.student_id,
        s.student_number,
        s.first_name || ' ' || s.last_name as student_name,
        p.semester,
        p.academic_year,
        p.amount,
        p.batch_number,
        p.bank_name,
        p.payment_date,
        p.deposit_slip_url,
        p.status,
        p.created_at,
        bt.transaction_id,
        bt.depositor_name as bank_depositor_name,
        bt.amount as bank_amount,
        bt.transaction_date as bank_date
       FROM student_payments p
       JOIN students s ON p.student_id = s.student_id
       LEFT JOIN bank_transactions bt ON bt.matched_payment_id = p.payment_id
       WHERE p.status = $1
       ORDER BY p.created_at DESC`,
      [filterStatus]
    );

    const stats = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'auto_matched') as auto_matched,
        COUNT(*) FILTER (WHERE status = 'manual_review') as manual_review,
        COUNT(*) FILTER (WHERE status = 'verified') as verified,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected
       FROM student_payments`
    );

    res.json({
      success: true,
      payments: result.rows,
      statistics: stats.rows[0],
    });
  } catch (error) {
    logger.error('Get pending payments error:', error);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
}

async function verifyPayment(req, res) {
  const client = await getClient();

  try {
    const user_id = req.user.user_id || req.user.userId;
    const role = req.user.role;
    const full_name = req.user.full_name || req.user.name || 'Staff';
    const { payment_id } = req.params;
    const { action, rejection_reason } = req.body;

    if (role !== 'accountant' && role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        error: 'Invalid action',
        allowed: ['approve', 'reject'],
      });
    }

    await client.query('BEGIN');

    const paymentResult = await client.query(
      `SELECT p.*, s.student_number, s.first_name, s.last_name, s.email, s.phone
       FROM student_payments p
       JOIN students s ON p.student_id = s.student_id
       WHERE p.payment_id = $1`,
      [payment_id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    if (payment.status === 'verified') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Payment already verified',
        message: 'This payment has already been processed',
      });
    }

    if (action === 'reject') {
      await client.query(
        `UPDATE student_payments SET status = 'rejected', verified_date = NOW(), verified_by = $1, updated_at = NOW() WHERE payment_id = $2`,
        [full_name, payment_id]
      );

      await createAuditLog({
        user_id,
        user_type: role,
        action: 'PAYMENT_REJECTED',
        entity_type: 'payment',
        entity_id: payment_id,
        details: {
          student_id: payment.student_id,
          reason: rejection_reason,
          semester: payment.semester,
          academic_year: payment.academic_year,
        },
        ip_address: req.ip,
      });

      await sendNotification({
        recipient_id: payment.student_id,
        recipient_type: 'student',
        type: 'PAYMENT_REJECTED',
        title: 'Payment Rejected',
        message: `Your payment for ${payment.semester}, ${payment.academic_year} was rejected. Reason: ${rejection_reason}. Please resubmit with correct information.`,
        channels: ['email', 'sms'],
      });

      await client.query('COMMIT');
      logger.info(`Payment rejected: ${payment_id} by ${user_id}`);

      return res.json({
        success: true,
        message: 'Payment rejected',
        payment_id,
        status: 'rejected',
      });
    }

    let blockchainTxId;
    try {
      blockchainTxId = await recordPaymentOnBlockchain({
        payment_id: payment.payment_id,
        student_id: payment.student_id,
        student_number: payment.student_number,
        semester: payment.semester,
        academic_year: payment.academic_year,
        amount: parseFloat(payment.amount),
        batch_number: payment.batch_number,
        bank_name: payment.bank_name,
        payment_date: payment.payment_date,
        verified_by: full_name,
        verified_date: new Date(),
      });
      logger.info(`Payment recorded on blockchain: ${payment_id}, TX: ${blockchainTxId}`);
    } catch (blockchainError) {
      logger.error('Blockchain recording failed:', blockchainError);
      blockchainTxId = `ERROR_${Date.now()}`;
    }

    const statementPdfUrl = await generateStatementPDF({
      student_number: payment.student_number,
      student_name: `${payment.first_name} ${payment.last_name}`,
      semester: payment.semester,
      academic_year: payment.academic_year,
      amount: payment.amount,
      batch_number: payment.batch_number,
      bank_name: payment.bank_name,
      payment_date: payment.payment_date,
      verified_by: full_name,
      verified_date: new Date(),
      blockchain_tx_id: blockchainTxId,
    });

    await client.query(
      `UPDATE student_payments SET status = 'verified', matched_with_bank = true, blockchain_tx_id = $1, verified_date = NOW(), verified_by = $2, statement_pdf_url = $3, updated_at = NOW() WHERE payment_id = $4`,
      [blockchainTxId, full_name, statementPdfUrl, payment_id]
    );

    await createAuditLog({
      user_id,
      user_type: role,
      action: 'PAYMENT_VERIFIED',
      entity_type: 'payment',
      entity_id: payment_id,
      details: {
        student_id: payment.student_id,
        blockchain_tx_id: blockchainTxId,
        semester: payment.semester,
        academic_year: payment.academic_year,
        amount: payment.amount,
      },
      ip_address: req.ip,
    });

    await sendNotification({
      recipient_id: payment.student_id,
      recipient_type: 'student',
      type: 'PAYMENT_VERIFIED',
      title: 'Payment Verified!',
      message: `Your payment for ${payment.semester}, ${payment.academic_year} (K${payment.amount}) has been verified and recorded on blockchain. Download your statement from the dashboard.`,
      channels: ['email', 'sms'],
    });

    await client.query('COMMIT');
    logger.info(`Payment verified: ${payment_id} by ${user_id}, Blockchain TX: ${blockchainTxId}`);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        payment_id,
        status: 'verified',
        blockchain_tx_id: blockchainTxId,
        statement_pdf_url: statementPdfUrl,
        verified_by: full_name,
        verified_date: new Date(),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Verify payment error:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      message: error.message,
    });
  } finally {
    client.release();
  }
}

async function bulkVerifyPayments(req, res) {
  const client = await getClient();

  try {
    const user_id = req.user.user_id || req.user.userId;
    const role = req.user.role;
    const full_name = req.user.full_name || req.user.name || 'Staff';
    const { payment_ids } = req.body;

    if (!Array.isArray(payment_ids) || payment_ids.length === 0) {
      return res.status(400).json({ error: 'payment_ids array required' });
    }

    if (payment_ids.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 payments per bulk operation' });
    }

    await client.query('BEGIN');

    const results = { verified: [], failed: [] };

    for (const payment_id of payment_ids) {
      try {
        const paymentResult = await client.query(
          `SELECT p.*, s.student_number, s.first_name, s.last_name, s.email
           FROM student_payments p
           JOIN students s ON p.student_id = s.student_id
           WHERE p.payment_id = $1 AND p.status IN ('auto_matched', 'pending', 'manual_review')`,
          [payment_id]
        );

        if (paymentResult.rows.length === 0) {
          results.failed.push({ payment_id, reason: 'Not found or not auto-matched' });
          continue;
        }

        const payment = paymentResult.rows[0];

        const blockchainTxId = await recordPaymentOnBlockchain({
          payment_id: payment.payment_id,
          student_id: payment.student_id,
          student_number: payment.student_number,
          semester: payment.semester,
          academic_year: payment.academic_year,
          amount: parseFloat(payment.amount),
          batch_number: payment.batch_number,
          bank_name: payment.bank_name,
          payment_date: payment.payment_date,
          verified_by: full_name,
          verified_date: new Date(),
        });

        const statementPdfUrl = await generateStatementPDF({
          student_number: payment.student_number,
          student_name: `${payment.first_name} ${payment.last_name}`,
          semester: payment.semester,
          academic_year: payment.academic_year,
          amount: payment.amount,
          batch_number: payment.batch_number,
          bank_name: payment.bank_name,
          payment_date: payment.payment_date,
          verified_by: full_name,
          verified_date: new Date(),
          blockchain_tx_id: blockchainTxId,
        });

        await client.query(
          `UPDATE student_payments SET status = 'verified', blockchain_tx_id = $1, verified_date = NOW(), verified_by = $2, statement_pdf_url = $3 WHERE payment_id = $4`,
          [blockchainTxId, full_name, statementPdfUrl, payment_id]
        );

        await sendNotification({
          recipient_id: payment.student_id,
          recipient_type: 'student',
          type: 'PAYMENT_VERIFIED',
          title: 'Payment Verified',
          message: `Your payment for ${payment.semester}, ${payment.academic_year} has been verified.`,
          channels: ['email', 'sms'],
        });

        results.verified.push({ payment_id, blockchain_tx_id: blockchainTxId });
      } catch (error) {
        logger.error(`Bulk verify failed for payment ${payment_id}:`, error);
        results.failed.push({ payment_id, reason: error.message });
      }
    }

    await createAuditLog({
      user_id,
      user_type: role,
      action: 'BULK_VERIFY_PAYMENTS',
      details: {
        total: payment_ids.length,
        verified: results.verified.length,
        failed: results.failed.length,
      },
      ip_address: req.ip,
    });

    await client.query('COMMIT');
    logger.info(`Bulk verification complete: ${results.verified.length} verified, ${results.failed.length} failed`);

    res.json({
      success: true,
      message: 'Bulk verification complete',
      results,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Bulk verify error:', error);
    res.status(500).json({ error: 'Bulk verification failed' });
  } finally {
    client.release();
  }
}

async function getVerificationStats(req, res) {
  try {
    const stats = await query(`
      SELECT
        COUNT(*) as total_payments,
        COUNT(*) FILTER (WHERE status = 'verified') as verified,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'auto_matched') as auto_matched,
        COUNT(*) FILTER (WHERE status = 'manual_review') as manual_review,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0) as total_verified_amount,
        COUNT(DISTINCT student_id) FILTER (WHERE status = 'verified') as unique_students,
        COUNT(*) FILTER (WHERE verified_date >= CURRENT_DATE - INTERVAL '7 days') as verified_last_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours') as submitted_today
      FROM student_payments
    `);

    const recentActivity = await query(`
      SELECT
        p.payment_id,
        s.student_number,
        s.first_name || ' ' || s.last_name as student_name,
        p.semester,
        p.academic_year,
        p.amount,
        p.status,
        p.verified_by,
        p.verified_date,
        p.created_at
      FROM student_payments p
      JOIN students s ON p.student_id = s.student_id
      WHERE p.updated_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY p.updated_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      statistics: stats.rows[0],
      recent_activity: recentActivity.rows,
    });
  } catch (error) {
    logger.error('Get verification stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
}

async function batchVerify(req, res) {
  try {
    const paymentsFile = req.files?.payments?.[0];
    const bankFile = req.files?.bankStatement?.[0];
    if (!paymentsFile || !bankFile) {
      return res.status(400).json({ message: 'Both payments CSV and bank statement are required' });
    }
    const result = await matchingService.runBatchMatching(
      paymentsFile.buffer,
      bankFile.buffer,
      bankFile.mimetype
    );
    res.json(result);
  } catch (err) {
    logger.error('Batch verify error:', err);
    res.status(500).json({ error: 'Batch verification failed' });
  }
}

module.exports = {
  uploadBankStatement,
  getPendingPayments,
  verifyPayment,
  bulkVerifyPayments,
  getVerificationStats,
  batchVerify,
};
