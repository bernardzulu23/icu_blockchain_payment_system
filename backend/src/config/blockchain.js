const env = require('./environment');

const blockchainConfig = {
  caUrl: process.env.FABRIC_CA_URL || 'https://localhost:7054',
  peerUrl: process.env.FABRIC_PEER_URL || 'grpc://localhost:7051',
  channelName: process.env.FABRIC_CHANNEL_NAME || 'icu-channel',
  chaincodeName: 'payment-contract',
};

let fabricGateway = null;

async function connectBlockchain() {
  if (fabricGateway) return fabricGateway;
  try {
    // Placeholder - full Fabric SDK setup requires network config
    // const { Gateway } = require('fabric-network');
    // const gateway = new Gateway();
    // await gateway.connect(connectionProfile, options);
    return null;
  } catch (err) {
    console.warn('Blockchain connection not available:', err.message);
    return null;
  }
}

function getBlockchainConfig() {
  return blockchainConfig;
}

module.exports = { connectBlockchain, getBlockchainConfig };
