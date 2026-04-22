const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const FABRIC_CONFIG = {
  connectionProfilePath:
    process.env.FABRIC_CONNECTION_PROFILE ||
    path.join(__dirname, '../../../blockchain/network/connection-profile.json'),
  walletPath:
    process.env.FABRIC_WALLET_PATH ||
    path.join(__dirname, '../../../blockchain/wallet'),
  channelName: process.env.FABRIC_CHANNEL || 'payments-channel',
  chaincodeName: process.env.FABRIC_CHAINCODE || 'payment-contract',
  identity: process.env.FABRIC_IDENTITY || 'admin',
};

async function getGateway() {
  const ccpPath = FABRIC_CONFIG.connectionProfilePath;
  if (!fs.existsSync(ccpPath)) {
    throw new Error(`Connection profile not found: ${ccpPath}`);
  }
  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

  const walletPath = FABRIC_CONFIG.walletPath;
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: FABRIC_CONFIG.identity,
    discovery: { enabled: true, asLocalhost: true },
  });

  return gateway;
}

async function recordPayment(payment) {
  let gateway;
  try {
    gateway = await getGateway();
    const network = await gateway.getNetwork(FABRIC_CONFIG.channelName);
    const contract = network.getContract(FABRIC_CONFIG.chaincodeName);

    const studentName =
      payment.student_name ||
      [payment.first_name, payment.last_name].filter(Boolean).join(' ') ||
      'Unknown';

    const payload = JSON.stringify({
      id: payment.payment_id,
      studentId: String(payment.student_id),
      studentName,
      semester: String(payment.semester || ''),
      academicYear: String(payment.academic_year || ''),
      amount: parseFloat(payment.amount),
      currency: 'ZMW',
      reference: payment.batch_number || '',
      status: 'verified',
      timestamp: new Date().toISOString(),
    });

    const result = await contract.submitTransaction('RecordPayment', payload);
    const txId = result && result.length > 0 ? Buffer.from(result).toString('hex') : null;
    return txId || Buffer.from(JSON.stringify({ id: payment.payment_id, ts: Date.now() })).toString('hex').slice(0, 64);
  } catch (fabricError) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Fabric unavailable - using dev placeholder hash');
      return '0x' + Buffer.from(JSON.stringify(payment)).toString('hex').slice(0, 64);
    }
    throw fabricError;
  } finally {
    if (gateway) {
      gateway.disconnect();
    }
  }
}

async function queryPayment(studentId, semester, academicYear) {
  let gateway;
  try {
    gateway = await getGateway();
    const network = await gateway.getNetwork(FABRIC_CONFIG.channelName);
    const contract = network.getContract(FABRIC_CONFIG.chaincodeName);

    const result = await contract.evaluateTransaction(
      'QueryPayment',
      studentId,
      semester,
      academicYear
    );
    return result ? JSON.parse(result.toString()) : null;
  } finally {
    if (gateway) {
      gateway.disconnect();
    }
  }
}

async function getAllPayments(studentId) {
  let gateway;
  try {
    gateway = await getGateway();
    const network = await gateway.getNetwork(FABRIC_CONFIG.channelName);
    const contract = network.getContract(FABRIC_CONFIG.chaincodeName);

    const result = await contract.evaluateTransaction('GetAllPayments', studentId);
    if (!result || result.length === 0) return [];
    const str = result.toString();
    const parsed = str ? JSON.parse(str) : [];
    return Array.isArray(parsed) ? parsed : [];
  } finally {
    if (gateway) {
      gateway.disconnect();
    }
  }
}

async function checkFabricHealth() {
  try {
    const gateway = await getGateway();
    await gateway.getNetwork(FABRIC_CONFIG.channelName);
    gateway.disconnect();
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function recordPaymentOnBlockchain(paymentData) {
  return recordPayment(paymentData);
}

async function recordPaymentOnChain(payload) {
  const paymentData = payload?.paymentData || payload;
  return recordPayment(paymentData);
}

async function getPaymentFromChain(txId) {
  try {
    // Would require chaincode support for GetPaymentByTxId
    return null;
  } catch {
    return null;
  }
}

module.exports = {
  recordPayment,
  recordPaymentOnBlockchain,
  recordPaymentOnChain,
  queryPayment,
  getAllPayments,
  checkFabricHealth,
  getPaymentFromChain,
};
