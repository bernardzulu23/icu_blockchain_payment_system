/**
 * Hyperledger Fabric gateway — Org1 (ICU Accounts) connection.
 *
 * NOT compatible with Vercel serverless: gRPC peers need a persistent process.
 * Deploy this backend on the same VPS as the Fabric test network (see docs/DEPLOYMENT.md).
 */
const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const env = require('../config/environment');
const logger = require('../utils/logger');

const CONFIG = {
  connectionProfilePath:
    process.env.FABRIC_CONNECTION_PROFILE ||
    path.join(__dirname, '../../../blockchain/network/connection-profile.json'),
  walletPath:
    process.env.FABRIC_WALLET_PATH ||
    path.join(__dirname, '../../../blockchain/wallet'),
  channelName: process.env.FABRIC_CHANNEL || 'icupaymentchannel',
  chaincodeName: process.env.FABRIC_CHAINCODE || 'reconciliation-chaincode',
  identity: process.env.FABRIC_IDENTITY || 'accountantAdmin',
  discoveryAsLocalhost: process.env.FABRIC_AS_LOCALHOST !== 'false',
};

let gateway;
let connectPromise;

function assertNotServerless() {
  if (process.env.VERCEL === '1') {
    const err = new Error(
      'Fabric SDK cannot run on Vercel serverless functions. ' +
        'Deploy the Express API on the Fabric VPS and keep only the React frontend on Vercel. ' +
        'See docs/DEPLOYMENT.md.'
    );
    err.code = 'FABRIC_SERVERLESS_UNSUPPORTED';
    throw err;
  }
}

function loadConnectionProfile() {
  const ccpPath = path.resolve(CONFIG.connectionProfilePath);
  if (!fs.existsSync(ccpPath)) {
    throw new Error(
      `Fabric connection profile not found: ${ccpPath}. ` +
        'Run blockchain/scripts/generate-connection-profile.sh on the Fabric VPS.'
    );
  }
  return JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
}

async function connectGateway() {
  assertNotServerless();

  if (gateway) {
    return gateway;
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      const ccp = loadConnectionProfile();
      const walletPath = path.resolve(CONFIG.walletPath);
      const wallet = await Wallets.newFileSystemWallet(walletPath);

      const identity = await wallet.get(CONFIG.identity);
      if (!identity) {
        throw new Error(
          `Fabric identity "${CONFIG.identity}" not found in wallet ${walletPath}. ` +
            'Import a Fabric CA–enrolled Org1 accountant identity: ' +
            'node backend/scripts/import-fabric-identity.js'
        );
      }

      const gw = new Gateway();
      await gw.connect(ccp, {
        wallet,
        identity: CONFIG.identity,
        discovery: { enabled: true, asLocalhost: CONFIG.discoveryAsLocalhost },
      });

      logger.info('Fabric gateway connected', {
        channel: CONFIG.channelName,
        chaincode: CONFIG.chaincodeName,
        identity: CONFIG.identity,
        org: 'Org1MSP (ICU Accounts)',
      });

      gateway = gw;
      return gateway;
    })().catch((err) => {
      connectPromise = null;
      throw err;
    });
  }

  return connectPromise;
}

async function getContract() {
  const gw = await connectGateway();
  const network = await gw.getNetwork(CONFIG.channelName);
  return network.getContract(CONFIG.chaincodeName);
}

async function submitTransaction(fn, ...args) {
  const contract = await getContract();
  const stringArgs = args.map((a) => (a == null ? '' : String(a)));
  logger.debug(`Fabric submitTransaction: ${fn}`, { args: stringArgs });
  return contract.submitTransaction(fn, ...stringArgs);
}

async function evaluateTransaction(fn, ...args) {
  const contract = await getContract();
  const stringArgs = args.map((a) => (a == null ? '' : String(a)));
  logger.debug(`Fabric evaluateTransaction: ${fn}`, { args: stringArgs });
  return contract.evaluateTransaction(fn, ...stringArgs);
}

async function checkHealth() {
  if (process.env.VERCEL === '1') {
    return {
      connected: false,
      supported: false,
      reason: 'Fabric SDK disabled on Vercel serverless — API must run on Fabric VPS',
    };
  }

  try {
    await connectGateway();
    await getContract();
    return {
      connected: true,
      supported: true,
      channel: CONFIG.channelName,
      chaincode: CONFIG.chaincodeName,
      identity: CONFIG.identity,
    };
  } catch (err) {
    return { connected: false, supported: true, error: err.message };
  }
}

async function disconnect() {
  if (gateway) {
    gateway.disconnect();
    gateway = null;
    connectPromise = null;
    logger.info('Fabric gateway disconnected');
  }
}

function getConfig() {
  return { ...CONFIG };
}

module.exports = {
  connectGateway,
  submitTransaction,
  evaluateTransaction,
  checkHealth,
  disconnect,
  getConfig,
  assertNotServerless,
};
