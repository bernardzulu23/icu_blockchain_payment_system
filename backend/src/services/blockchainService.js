const env = require('../config/environment');
const logger = require('../utils/logger');
const { computePaymentHash } = require('../utils/paymentHash');
const fabricGateway = require('./fabricGateway');

const REQUIRED_CLEARANCE_SEMESTERS = parseInt(process.env.CLEARANCE_REQUIRED_SEMESTERS || '8', 10);

/**
 * Record verified payment on Fabric ledger (source of truth).
 * Postgres is updated afterward as the fast-query cache.
 */
async function matchPaymentOnChain(payment) {
  const studentId = String(payment.student_id);
  const amount = String(parseFloat(payment.amount));
  const semester = String(payment.semester || '');
  const batchNumber = String(payment.batch_number || payment.reference || '');
  const paymentHash = computePaymentHash(studentId, amount, semester, batchNumber);

  try {
    await fabricGateway.submitTransaction(
      'MatchPayment',
      paymentHash,
      studentId,
      amount,
      semester,
      batchNumber
    );
    logger.info('MatchPayment committed on ledger', { paymentHash, studentId, semester });
    return paymentHash;
  } catch (fabricError) {
    if (env.BLOCKCHAIN_OPTIONAL) {
      logger.warn('Fabric unavailable (BLOCKCHAIN_OPTIONAL=true) — Postgres-only verify', {
        error: fabricError.message,
      });
      return null;
    }
    throw fabricError;
  }
}

async function checkClearanceEligibilityOnChain(studentId, requiredSemesters = REQUIRED_CLEARANCE_SEMESTERS) {
  try {
    const result = await fabricGateway.evaluateTransaction(
      'CheckClearanceEligibility',
      String(studentId),
      String(requiredSemesters)
    );
    const parsed = JSON.parse(result.toString());
    return {
      eligible: Boolean(parsed.eligible),
      missingSemesters: Array.isArray(parsed.missingSemesters)
        ? parsed.missingSemesters.map(Number)
        : [],
      source: 'ledger',
    };
  } catch (fabricError) {
    if (env.BLOCKCHAIN_OPTIONAL) {
      logger.warn('Fabric clearance check unavailable — caller should not rely on Postgres-only path', {
        error: fabricError.message,
      });
      return null;
    }
    throw fabricError;
  }
}

async function getStudentPaymentHistoryOnChain(studentId) {
  const result = await fabricGateway.evaluateTransaction('GetStudentPaymentHistory', String(studentId));
  if (!result || result.length === 0) return [];
  const parsed = JSON.parse(result.toString());
  return Array.isArray(parsed) ? parsed : [];
}

async function queryPaymentOnChain(studentId, semester, academicYear = '') {
  const result = await fabricGateway.evaluateTransaction(
    'QueryPayment',
    String(studentId),
    String(semester),
    String(academicYear)
  );
  if (!result || result.length === 0) return null;
  return JSON.parse(result.toString());
}

async function checkFabricHealth() {
  return fabricGateway.checkHealth();
}

/**
 * Anchor an OCR batch with a single Merkle root transaction (Pseudocode 1).
 */
async function submitBatchRootOnChain(merkleRoot, batchId, paymentCount) {
  try {
    await fabricGateway.submitTransaction(
      'SubmitBatchRoot',
      String(merkleRoot),
      String(batchId),
      String(paymentCount)
    );
    logger.info('SubmitBatchRoot committed on ledger', { merkleRoot, batchId, paymentCount });
    return merkleRoot;
  } catch (fabricError) {
    if (env.BLOCKCHAIN_OPTIONAL) {
      logger.warn('Fabric unavailable — batch root not anchored', { error: fabricError.message });
      return null;
    }
    throw fabricError;
  }
}

// --- Legacy aliases used by existing controllers ---

async function recordPayment(payment) {
  return matchPaymentOnChain(payment);
}

async function recordPaymentOnBlockchain(payment) {
  return matchPaymentOnChain(payment);
}

async function queryPayment(studentId, semester, academicYear) {
  return queryPaymentOnChain(studentId, semester, academicYear);
}

async function getAllPayments(studentId) {
  return getStudentPaymentHistoryOnChain(studentId);
}

module.exports = {
  matchPaymentOnChain,
  checkClearanceEligibilityOnChain,
  getStudentPaymentHistoryOnChain,
  recordPayment,
  recordPaymentOnBlockchain,
  queryPayment,
  getAllPayments,
  checkFabricHealth,
  submitBatchRootOnChain,
  REQUIRED_CLEARANCE_SEMESTERS,
};
