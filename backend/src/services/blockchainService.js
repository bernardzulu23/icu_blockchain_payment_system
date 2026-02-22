const { getBlockchainConfig } = require('../config/blockchain');
const logger = require('../utils/logger');

async function recordPaymentOnChain(payload) {
  const config = getBlockchainConfig();
  try {
    // Placeholder - full implementation requires Fabric SDK
    // const contract = await getContract();
    // const txId = await contract.submitTransaction('RecordPayment', ...payload.args);
    // return txId;
    const { args, paymentData } = payload;
    logger.info('Blockchain record (placeholder):', { args: args?.[0], payment_id: paymentData?.payment_id });
    return '0x' + Buffer.from(JSON.stringify(payload)).toString('hex').slice(0, 64);
  } catch (err) {
    logger.warn('Blockchain unavailable, using synthetic tx hash');
    const id = payload?.paymentData?.payment_id || payload?.args?.[0] || 'unknown';
    return '0x' + Buffer.from(`${id}-${Date.now()}`).toString('hex').slice(0, 64);
  }
}

async function getPaymentFromChain(txId) {
  try {
    // const contract = await getContract();
    // const result = await contract.evaluateTransaction('GetPayment', txId);
    return null;
  } catch {
    return null;
  }
}

async function recordPaymentOnBlockchain(paymentData) {
  // Chaincode RecordPayment(paymentID, studentID, studentNumber, semester, academicYear,
  //   amountStr, batchNumber, bankName, paymentDate, verifiedBy)
  const args = [
    String(paymentData.payment_id),
    String(paymentData.student_id),
    String(paymentData.student_number || ''),
    String(paymentData.semester),
    String(paymentData.academic_year),
    String(Number(paymentData.amount).toFixed(2)),
    String(paymentData.batch_number || ''),
    String(paymentData.bank_name || ''),
    String(paymentData.payment_date),
    String(paymentData.verified_by || ''),
  ];
  return recordPaymentOnChain({ args, paymentData });
}

module.exports = { recordPaymentOnChain, recordPaymentOnBlockchain, getPaymentFromChain };
