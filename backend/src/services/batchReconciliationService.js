const crypto = require('crypto');
const { query, getClient } = require('../config/database');
const { computeBatchMerkleRoot } = require('../utils/merkle');
const { matchPaymentOnChain, submitBatchRootOnChain } = require('./blockchainService');
const { ocrReconcileBatch, multerFileBuffer } = require('./ocrService');
const { sanitizeOcrPreviewResult } = require('../utils/input-validation');
const logger = require('../utils/logger');

async function createReconciliationPreview({
  bankFile,
  slipFiles,
  bankHint,
  statementId,
  uploadedBy,
}) {
  const batchId = crypto.randomUUID();
  const started = Date.now();

  const ocrResult = await ocrReconcileBatch({
    bankBuffer: multerFileBuffer(bankFile),
    bankFilename: bankFile.originalname,
    bankMime: bankFile.mimetype,
    slipFiles,
    bankHint,
  });

  const approvedLeaves = (ocrResult.matching?.matches || [])
    .filter((m) => m.status === 'matched' && !m.slip?.needs_manual_entry)
    .map((m) => ({
      student_id: m.slip?.student_id,
      amount: m.slip?.amount,
      batch_reference: m.slip?.batch_reference,
      bank_batch: m.transaction?.batch_number,
    }))
    .filter((l) => l.student_id && l.amount);

  const merkleRoot = computeBatchMerkleRoot(approvedLeaves);
  const processingMs = Date.now() - started;

  await query(
    `INSERT INTO batch_reconciliation_runs
     (batch_id, statement_id, status, merkle_root, payment_count, processing_ms,
      manual_flag_rate, ocr_results, match_results, created_by)
     VALUES ($1, $2, 'preview', $3, $4, $5, $6, $7, $8, $9)`,
    [
      batchId,
      statementId || null,
      merkleRoot,
      approvedLeaves.length,
      processingMs,
      ocrResult.manual_flag_rate || 0,
      JSON.stringify({
        slips: ocrResult.slips,
        bank_transactions: ocrResult.bank_transactions,
        manual_flag_count: ocrResult.manual_flag_count,
        python_processing_ms: ocrResult.processing_ms,
        node_overhead_ms: ocrResult.node_overhead_ms,
      }),
      JSON.stringify(ocrResult.matching),
      uploadedBy,
    ]
  );

  logger.info('OCR batch reconciliation preview', {
    batchId,
    processingMs,
    manualFlagRate: ocrResult.manual_flag_rate,
    matched: ocrResult.matching?.matched_count,
  });

  return sanitizeOcrPreviewResult({
    batch_id: batchId,
    status: 'preview',
    merkle_root: merkleRoot,
    payment_count: approvedLeaves.length,
    processing_ms: processingMs,
    manual_flag_rate: ocrResult.manual_flag_rate,
    manual_flag_count: ocrResult.manual_flag_count,
    slips: ocrResult.slips,
    bank_transactions: ocrResult.bank_transactions,
    matching: ocrResult.matching,
    timing: {
      total_ms: processingMs,
      python_ms: ocrResult.processing_ms,
      node_overhead_ms: ocrResult.node_overhead_ms,
    },
  });
}

async function approveReconciliationBatch(batchId, approvedBy, approvedMatchIndexes = null) {
  const client = await getClient();
  const started = Date.now();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM batch_reconciliation_runs WHERE batch_id = $1 FOR UPDATE`,
      [batchId]
    );
    if (!rows.length) throw new Error('Batch reconciliation run not found');
    const run = rows[0];
    if (run.status !== 'preview') throw new Error(`Batch already ${run.status}`);

    const matching =
      typeof run.match_results === 'string' ? JSON.parse(run.match_results) : run.match_results || {};
    const matches = matching.matches || [];
    const toCommit =
      approvedMatchIndexes === null
        ? matches.filter((m) => m.status === 'matched')
        : matches.filter((_, idx) => approvedMatchIndexes.includes(idx));

    const leaves = [];
    const committedPayments = [];

    for (const m of toCommit) {
      const slip = m.slip || {};
      const txn = m.transaction || {};
      if (slip.needs_manual_entry) continue;

      const ocrStudentRef = String(slip.student_id || '').replace(/\D/g, '');
      const amount = slip.amount;
      const batchNumber = slip.batch_reference || txn.batch_number;
      if (!amount || !batchNumber) continue;

      const paymentUpdate = await client.query(
        `UPDATE student_payments sp
         SET status = 'auto_matched',
             matched_with_bank = true,
             batch_number = COALESCE(NULLIF(sp.batch_number, ''), $3),
             match_confidence = $4,
             updated_at = NOW()
         FROM students s
         WHERE sp.student_id = s.student_id
           AND sp.status IN ('pending', 'manual_review')
           AND ABS(sp.amount - $2) < 0.02
           AND (
             UPPER(REPLACE(sp.batch_number, ' ', '')) = UPPER(REPLACE($3::text, ' ', ''))
             OR ($1 <> '' AND (
               s.student_number = $1
               OR REGEXP_REPLACE(s.student_number, '[^0-9]', '', 'g') = $1
               OR REGEXP_REPLACE(s.student_id, '[^0-9]', '', 'g') = $1
             ))
           )
         RETURNING sp.payment_id, sp.student_id, sp.semester, sp.academic_year, sp.amount, sp.batch_number`,
        [ocrStudentRef, amount, batchNumber, m.match_confidence || 0.8]
      );

      if (paymentUpdate.rows.length) {
        const payment = paymentUpdate.rows[0];
        leaves.push({ student_id: payment.student_id, amount: payment.amount });
        committedPayments.push({ ...payment, match: m });
      }
    }

    const merkleRoot = computeBatchMerkleRoot(leaves);
    let blockchainTxId = null;

    if (leaves.length > 0) {
      blockchainTxId = await submitBatchRootOnChain(merkleRoot, batchId, leaves.length);
    }

    for (const payment of committedPayments) {
      try {
        const txHash = await matchPaymentOnChain(payment);
        if (txHash) {
          await client.query(
            `UPDATE student_payments SET blockchain_tx_id = $1, status = 'verified',
             verified_date = NOW(), verified_by = $2 WHERE payment_id = $3`,
            [txHash, approvedBy, payment.payment_id]
          );
        }
      } catch (chainErr) {
        logger.warn(`MatchPayment skipped for ${payment.payment_id}:`, chainErr.message);
      }
    }

    const totalMs = Date.now() - started + (run.processing_ms || 0);

    await client.query(
      `UPDATE batch_reconciliation_runs
       SET status = 'committed', merkle_root = $2, payment_count = $3,
           blockchain_tx_id = $4, approved_at = NOW(), approved_by = $5,
           processing_ms = $6
       WHERE batch_id = $1`,
      [batchId, merkleRoot, leaves.length, blockchainTxId, approvedBy, totalMs]
    );

    await client.query('COMMIT');

    return {
      batch_id: batchId,
      status: 'committed',
      merkle_root: merkleRoot,
      payment_count: leaves.length,
      blockchain_tx_id: blockchainTxId,
      committed_payments: committedPayments.length,
      processing_ms: totalMs,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getReconciliationBatch(batchId) {
  const { rows } = await query(
    `SELECT batch_id, statement_id, status, merkle_root, payment_count,
            blockchain_tx_id, processing_ms, manual_flag_rate,
            ocr_results, match_results, created_at, approved_at, approved_by
     FROM batch_reconciliation_runs WHERE batch_id = $1`,
    [batchId]
  );
  return rows[0] || null;
}

module.exports = {
  createReconciliationPreview,
  approveReconciliationBatch,
  getReconciliationBatch,
};
