const crypto = require('crypto');

/**
 * Deterministic payment hash used as the ledger key for MatchPayment.
 * Must stay in sync with chaincode duplicate-prevention logic.
 */
function computePaymentHash(studentId, amount, semester, batchNumber) {
  const payload = [String(studentId), String(amount), String(semester), String(batchNumber)].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

module.exports = { computePaymentHash };
