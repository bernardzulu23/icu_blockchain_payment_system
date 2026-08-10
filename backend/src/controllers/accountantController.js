const { query, getClient } = require('../config/database');
const { uploadToStorage, readStoredFile, isRemoteUrl } = require('../services/storageService');
const { createAuditLog, log: auditLog } = require('../services/auditService');
const { sendNotification, sendPaymentVerified } = require('../services/notificationService');
const { generateStatementPDF, generateStatement, generateProofOfNoBalancePDF } = require('../services/pdfService');
const { recordPaymentOnBlockchain, recordPayment, checkClearanceEligibilityOnChain, REQUIRED_CLEARANCE_SEMESTERS } = require('../services/blockchainService');
const BankStatement = require('../models/BankStatement');
const BankTransaction = require('../models/BankTransaction');
const matchingService = require('../services/matchingService');
const {
  createReconciliationPreview,
  approveReconciliationBatch,
  getReconciliationBatch,
} = require('../services/batchReconciliationService');

const EXPECTED_SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const MIN_STUDENT_NUMBERS = 1;
const axios = require('axios');
const logger = require('../utils/logger');
const env = require('../config/environment');
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

    const { isAllowedBank, normalizeBankName } = require('../utils/constants');
    if (!isAllowedBank(bank_name)) {
      return res.status(400).json({
        error: 'Invalid bank',
        message: 'Bank must be Zanaco Bank or ABSA Bank',
      });
    }
    const normalizedBank = normalizeBankName(bank_name);

    await client.query('BEGIN');

    const statementUrl = await uploadToStorage(statementFile, 'bank-statements');

    const uploadDate = upload_date || new Date().toISOString().split('T')[0];
    const statementResult = await client.query(
      `INSERT INTO bank_statements
       (bank_name, upload_date, statement_pdf_url, uploaded_by, processed)
       VALUES ($1, $2, $3, $4, false)
       RETURNING statement_id, created_at`,
      [normalizedBank, uploadDate, statementUrl, user_id]
    );

    const statement = statementResult.rows[0];

    await createAuditLog({
      user_id,
      user_type: role,
      action: 'BANK_STATEMENT_UPLOADED',
      entity_type: 'bank_statement',
      entity_id: statement.statement_id,
      details: { bank_name: normalizedBank, file: statementFile.originalname },
      ip_address: req.ip,
    });

    await client.query('COMMIT');

    logger.info(`Bank statement uploaded: ${statement.statement_id} by ${user_id}`);

    // Always process in background on long-lived hosts (VPS)
    processBankStatement(statement.statement_id, statementUrl, user_id).catch((err) => {
      logger.error('Background processing error:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Bank statement uploaded successfully',
      statement: {
        statement_id: statement.statement_id,
        bank_name: normalizedBank,
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
      message: 'An unexpected error occurred',
    });
  } finally {
    client.release();
  }
}

async function processBankStatement(statementId, statementUrl, uploadedBy) {
  const client = await getClient();
  let tempPdfPath = null;

  try {
    logger.info(`Starting background processing for statement: ${statementId}`);

    let fullPath = null;
    if (isRemoteUrl(statementUrl)) {
      fullPath = null;
    } else if (typeof statementUrl === 'string' && statementUrl.startsWith('sb:')) {
      // Materialize Supabase object to a temp file for Python OCR
      const buf = await readStoredFile(statementUrl);
      const tmpDir = path.join(process.cwd(), 'uploads', 'tmp');
      fs.mkdirSync(tmpDir, { recursive: true });
      tempPdfPath = path.join(tmpDir, `${statementId}.pdf`);
      fs.writeFileSync(tempPdfPath, buf);
      fullPath = tempPdfPath;
    } else {
      fullPath = path.join(process.cwd(), statementUrl.replace(/^\//, ''));
    }

    const { rows: payments } = await client.query(
      `SELECT payment_id, batch_number, amount, payment_date FROM student_payments WHERE status IN ('pending', 'manual_review')`
    );

    const pythonServiceUrl = env.PYTHON_SERVICE_URL;
    let transactions = [];
    let usedPythonService = false;

    // Try Python service first (extract-transactions) when configured
    if (pythonServiceUrl) {
      try {
        const apiBase = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;
        const extractResponse = await axios.post(
          `${pythonServiceUrl}/extract-transactions`,
          {
            pdf_url: isRemoteUrl(statementUrl) ? statementUrl : undefined,
            pdf_path: fullPath,
            statement_id: statementId,
            storage_ref: statementUrl,
            api_base: apiBase,
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

    if (transactions.length === 0) {
      try {
        const pdfBuffer = await readStoredFile(statementUrl);
        const pdfParse = require('pdf-parse');
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
                    transactions.push({
                      batch_number: ref,
                      amount: val,
                      date: new Date().toISOString().split('T')[0],
                      depositor_name: '',
                    });
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
    }

    if (extractedCount === 0) {
      logger.warn(`No transactions extracted from bank statement ${statementId}`);
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
    if (tempPdfPath) {
      try {
        fs.unlinkSync(tempPdfPath);
      } catch {
        /* ignore */
      }
    }
    client.release();
  }
}

async function verifyAllAutoMatched(req, res) {
  const client = await getClient();

  try {
    const user_id = req.user.user_id || req.user.userId;
    const role = req.user.role;

    if (role !== 'accountant' && role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await client.query(
      `SELECT sp.payment_id, sp.student_id, sp.semester, sp.academic_year,
              sp.amount, sp.batch_number, sp.bank_name, sp.payment_date,
              sp.deposit_slip_url, sp.matched_transaction_id,
              s.student_number, s.first_name, s.last_name, s.email, s.phone as phone_number
       FROM student_payments sp
       JOIN students s ON sp.student_id = s.student_id
       WHERE sp.status = 'auto_matched'
       ORDER BY sp.payment_date ASC`
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        verified_count: 0,
        failed_count: 0,
        failed: [],
      });
    }

    const verified = [];
    const failed = [];

    for (const payment of result.rows) {
      try {
        const paymentObj = {
          payment_id: payment.payment_id,
          student_id: payment.student_id,
          student_number: payment.student_number,
          semester: payment.semester,
          academic_year: payment.academic_year,
          amount: parseFloat(payment.amount),
          batch_number: payment.batch_number,
          bank_name: payment.bank_name,
          payment_date: payment.payment_date,
          verified_by: user_id,
          verified_date: new Date(),
        };

        const blockchain_tx_id = await recordPayment(paymentObj);
        logger.info(`Payment recorded on blockchain: ${payment.payment_id}, TX: ${blockchain_tx_id}`);

        const statementPdfUrl = await generateStatement({
          ...paymentObj,
          student_name: `${payment.first_name} ${payment.last_name}`,
          blockchain_tx_id,
        });

        await client.query('BEGIN');
        await client.query(
          `UPDATE student_payments
           SET status = 'verified',
               blockchain_tx_id = $1,
               verified_date = NOW(),
               verified_by = $2,
               statement_pdf_url = $3
           WHERE payment_id = $4`,
          [blockchain_tx_id, user_id, statementPdfUrl, payment.payment_id]
        );
        await client.query('COMMIT');

        await sendPaymentVerified({
          email: payment.email,
          phone: payment.phone_number,
          fullName: `${payment.first_name} ${payment.last_name}`,
          semester: payment.semester,
          academicYear: payment.academic_year,
          amount: payment.amount,
          statementPdfUrl,
        });

        await auditLog({
          userId: user_id,
          userType: role,
          action: 'PAYMENT_VERIFIED',
          entityType: 'student_payments',
          entityId: payment.payment_id,
          ipAddress: req.ip,
          userAgent: req.headers?.['user-agent'],
          details: { user: req.user },
        });

        verified.push({
          payment_id: payment.payment_id,
          student_id: payment.student_id,
          blockchain_tx_id,
          statement_pdf_url: statementPdfUrl,
        });
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {}
        logger.error(`Verify all failed for payment ${payment.payment_id}:`, error);
        failed.push({ payment_id: payment.payment_id, error: error.message });
      }
    }

    await createAuditLog({
      user_id,
      user_type: role,
      action: 'VERIFY_ALL_AUTO_MATCHED',
      details: {
        total: result.rows.length,
        verified: verified.length,
        failed: failed.length,
      },
      ip_address: req.ip,
    });

    logger.info(`Verify all auto-matched complete: ${verified.length} verified, ${failed.length} failed`);

    res.json({
      success: true,
      verified_count: verified.length,
      failed_count: failed.length,
      failed,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    logger.error('Verify all auto-matched error:', error);
    res.status(500).json({
      error: 'Failed to verify auto-matched payments',
      message: 'An unexpected error occurred',
    });
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
      if (blockchainTxId) {
        logger.info(`MatchPayment committed on ledger: ${payment_id}, hash: ${blockchainTxId}`);
      }
    } catch (blockchainError) {
      await client.query('ROLLBACK');
      logger.error('Blockchain recording failed:', blockchainError);
      return res.status(503).json({
        error: 'Blockchain unavailable',
        message:
          'Payment could not be recorded on the blockchain. Start the Fabric network or set BLOCKCHAIN_OPTIONAL=true for development.',
      });
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

    let proofPdfUrl = null;
    try {
      const { rows: verifiedPayments } = await client.query(
        `SELECT semester, academic_year, amount, payment_date, verified_date, batch_number
         FROM student_payments
         WHERE student_id = $1 AND status = 'verified'
         ORDER BY payment_date DESC, payment_id DESC`,
        [payment.student_id]
      );
      proofPdfUrl = await generateProofOfNoBalancePDF({
        student_number: payment.student_number,
        student_name: `${payment.first_name} ${payment.last_name}`,
        payments: verifiedPayments,
      });
    } catch (proofErr) {
      logger.warn('Proof of no balance PDF generation failed:', proofErr);
    }

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

    const proofNote = proofPdfUrl
      ? ` Your proof-of-no-balance document is available from the dashboard; open it with your student number (${payment.student_number}) as the password.`
      : '';
    await sendNotification({
      recipient_id: payment.student_id,
      recipient_type: 'student',
      type: 'PAYMENT_VERIFIED',
      title: 'Payment Verified!',
      message: `Your payment for ${payment.semester}, ${payment.academic_year} (K${payment.amount}) has been verified and recorded on blockchain. Download your statement from the dashboard.${proofNote}`,
      channels: ['email', 'sms'],
      proofPdfUrl,
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
        proof_of_no_balance_pdf_url: proofPdfUrl || undefined,
        verified_by: full_name,
        verified_date: new Date(),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Verify payment error:', error);
    res.status(500).json({
      error: 'Failed to verify payment',
      message: 'An unexpected error occurred',
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
    res.json({ preview: true, message: 'Preview only — results are not saved. Upload a bank statement to persist matches.', ...result });
  } catch (err) {
    logger.error('Batch verify error:', err);
    res.status(500).json({ error: 'Batch verification failed' });
  }
}

/**
 * OCR-based batch reconciliation: bank PDF + deposit slip images.
 * Returns side-by-side matches with confidence for accountant review.
 */
async function batchReconcileOcr(req, res) {
  const started = Date.now();
  try {
    const bankFile = req.files?.bankStatement?.[0];
    const slipFiles = req.files?.slips || [];
    const { bank_name: bankHint, statement_id: statementId } = req.body;
    const userId = req.user.user_id || req.user.userId;

    if (!bankFile) {
      return res.status(400).json({ error: 'Bank statement PDF required' });
    }
    if (!slipFiles.length) {
      return res.status(400).json({ error: 'At least one deposit slip image required' });
    }
    if (!env.PYTHON_SERVICE_URL) {
      return res.status(503).json({
        error: 'OCR service unavailable',
        message: 'Set PYTHON_SERVICE_URL and run the Python microservice with Tesseract installed',
      });
    }

    const result = await createReconciliationPreview({
      bankFile,
      slipFiles,
      bankHint,
      statementId: statementId || null,
      uploadedBy: userId,
    });

    await createAuditLog({
      user_id: userId,
      user_type: req.user.role,
      action: 'BATCH_OCR_RECONCILE_PREVIEW',
      entity_type: 'batch_reconciliation',
      entity_id: result.batch_id,
      details: {
        processing_ms: result.processing_ms,
        manual_flag_rate: result.manual_flag_rate,
        matched_count: result.matching?.matched_count,
      },
      ip_address: req.ip,
    });

    res.json({
      success: true,
      preview: true,
      message: 'Review OCR results and approve to commit on-chain',
      controller_overhead_ms: Date.now() - started - result.processing_ms,
      ...result,
    });
  } catch (err) {
    logger.error('Batch OCR reconcile error:', err);
    res.status(500).json({ error: 'Batch OCR reconciliation failed', message: err.message });
  }
}

async function approveBatchReconcile(req, res) {
  try {
    const { batchId } = req.params;
    const { approved_match_indexes: approvedMatchIndexes } = req.body || {};
    const userId = req.user.user_id || req.user.userId;

    const result = await approveReconciliationBatch(batchId, userId, approvedMatchIndexes);

    await createAuditLog({
      user_id: userId,
      user_type: req.user.role,
      action: 'BATCH_OCR_RECONCILE_COMMIT',
      entity_type: 'batch_reconciliation',
      entity_id: batchId,
      details: result,
      ip_address: req.ip,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Approve batch reconcile error:', err);
    res.status(500).json({ error: 'Failed to approve batch reconciliation', message: err.message });
  }
}

async function getBatchReconcile(req, res) {
  try {
    const run = await getReconciliationBatch(req.params.batchId);
    if (!run) return res.status(404).json({ error: 'Batch reconciliation run not found' });
    res.json(run);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch batch reconciliation' });
  }
}

/**
 * Bulk payment status / cross-reference: accept 1 or more student numbers,
 * return verification and payment status for each (semesters paid, clearance eligible).
 */
async function bulkPaymentStatus(req, res) {
  try {
    const role = req.user?.role;
    if (role !== 'accountant' && role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Accountant or admin only.' });
    }

    let studentNumbers = req.body.studentNumbers;
    if (Array.isArray(studentNumbers)) {
      studentNumbers = studentNumbers.map((n) => String(n).trim()).filter(Boolean);
    } else if (typeof studentNumbers === 'string') {
      studentNumbers = studentNumbers
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean);
    } else {
      return res.status(400).json({
        error: 'studentNumbers required',
        message: 'Provide an array of student numbers or a string (newline/comma separated). At least 1 required.',
      });
    }

    const unique = [...new Set(studentNumbers)];
    if (unique.length < MIN_STUDENT_NUMBERS) {
      return res.status(400).json({
        error: 'At least one student number required',
        message: `You provided ${unique.length} student number(s). Enter at least one for verification.`,
      });
    }

    const studentsResult = await query(
      `SELECT student_id, student_number, first_name, last_name
       FROM students
       WHERE student_number = ANY($1::text[])`,
      [unique]
    );
    const studentsByNumber = new Map(studentsResult.rows.map((r) => [r.student_number, r]));
    const studentIds = studentsResult.rows.map((r) => r.student_id);

    let paymentsByStudent = new Map();
    if (studentIds.length > 0) {
      const paymentsResult = await query(
        `SELECT student_id, semester, amount, status
         FROM student_payments
         WHERE student_id = ANY($1::text[]) AND status = 'verified'`,
        [studentIds]
      );
      for (const row of paymentsResult.rows) {
        if (!paymentsByStudent.has(row.student_id)) {
          paymentsByStudent.set(row.student_id, { semesters: new Set(), totalAmount: 0 });
        }
        const rec = paymentsByStudent.get(row.student_id);
        rec.semesters.add(String(row.semester).trim());
        rec.totalAmount += Number(row.amount) || 0;
      }
    }

    const results = [];
    let clearanceEligibleCount = 0;

    for (const num of unique) {
      const student = studentsByNumber.get(num);
      if (!student) {
        results.push({
          student_number: num,
          student_id: null,
          student_name: null,
          found: false,
          paid_semesters: [],
          missing_semesters: EXPECTED_SEMESTERS,
          clearance_eligible: false,
          total_verified_payments: 0,
          total_verified_amount: 0,
        });
        continue;
      }

      const rec = paymentsByStudent.get(student.student_id) || { semesters: new Set(), totalAmount: 0 };
      const paidSemesters = [...rec.semesters].sort();

      let missingSemesters = EXPECTED_SEMESTERS.filter((s) => !rec.semesters.has(s));
      let clearanceEligible = missingSemesters.length === 0;
      let eligibilitySource = 'postgres_cache';

      try {
        const chainResult = await checkClearanceEligibilityOnChain(
          student.student_id,
          REQUIRED_CLEARANCE_SEMESTERS
        );
        if (chainResult) {
          clearanceEligible = chainResult.eligible;
          missingSemesters = chainResult.missingSemesters.map(String);
          eligibilitySource = chainResult.source;
        }
      } catch (chainErr) {
        logger.warn(`On-chain clearance check skipped for ${student.student_number}:`, chainErr.message);
      }

      if (clearanceEligible) clearanceEligibleCount++;

      results.push({
        student_number: student.student_number,
        student_id: student.student_id,
        student_name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
        found: true,
        paid_semesters: paidSemesters,
        missing_semesters: missingSemesters,
        clearance_eligible: clearanceEligible,
        eligibility_source: eligibilitySource,
        total_verified_payments: rec.semesters.size,
        total_verified_amount: Math.round(rec.totalAmount * 100) / 100,
      });
    }

    const summary = {
      total_requested: unique.length,
      found: studentsResult.rows.length,
      not_found: unique.length - studentsResult.rows.length,
      clearance_eligible_count: clearanceEligibleCount,
    };

    logger.info(`Bulk payment status: ${summary.total_requested} requested, ${summary.found} found, ${summary.clearance_eligible_count} clearance eligible`);

    res.json({
      success: true,
      results,
      summary,
    });
  } catch (err) {
    logger.error('Bulk payment status error:', err);
    res.status(500).json({ error: 'Bulk payment status failed', message: err.message });
  }
}

async function listBankStatements(req, res) {
  try {
    const result = await BankStatement.list(req.query);
    res.json(result);
  } catch (err) {
    logger.error('List bank statements error:', err);
    res.status(500).json({ error: 'Failed to list bank statements' });
  }
}

async function getBankStatement(req, res) {
  try {
    const statement = await BankStatement.findById(req.params.id);
    if (!statement) return res.status(404).json({ error: 'Bank statement not found' });
    res.json(statement);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bank statement' });
  }
}

async function listBankTransactions(req, res) {
  try {
    const result = await BankTransaction.listByStatement(req.params.id, req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list transactions' });
  }
}

async function deleteBankStatement(req, res) {
  try {
    const deleted = await BankStatement.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Bank statement not found' });
    res.json({ success: true, message: 'Bank statement deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete bank statement' });
  }
}

module.exports = {
  uploadBankStatement,
  listBankStatements,
  getBankStatement,
  listBankTransactions,
  deleteBankStatement,
  verifyAllAutoMatched,
  getPendingPayments,
  verifyPayment,
  bulkVerifyPayments,
  getVerificationStats,
  batchVerify,
  batchReconcileOcr,
  approveBatchReconcile,
  getBatchReconcile,
  bulkPaymentStatus,
};
