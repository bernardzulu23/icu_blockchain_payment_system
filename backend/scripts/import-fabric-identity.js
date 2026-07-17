#!/usr/bin/env node
/**
 * Import a Fabric CA–enrolled Org1 identity into the filesystem wallet.
 *
 * Usage (on Fabric VPS after CA enrollment per blockchain/SETUP.md):
 *   node backend/scripts/import-fabric-identity.js \
 *     --msp ~/hyperledger/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Accountant1@org1.example.com/msp \
 *     --label accountantAdmin
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Wallets } = require('fabric-network');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { label: process.env.FABRIC_IDENTITY || 'accountantAdmin' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--msp') opts.mspPath = args[++i];
    if (args[i] === '--label') opts.label = args[++i];
    if (args[i] === '--wallet') opts.walletPath = args[++i];
  }
  return opts;
}

async function main() {
  const { mspPath, label, walletPath } = parseArgs();
  if (!mspPath) {
    console.error('Usage: node import-fabric-identity.js --msp <path-to-msp> [--label accountantAdmin]');
    process.exit(1);
  }

  const resolvedMsp = path.resolve(mspPath);
  const certFile = path.join(resolvedMsp, 'signcerts', 'cert.pem');
  const keyDir = path.join(resolvedMsp, 'keystore');
  if (!fs.existsSync(certFile) || !fs.existsSync(keyDir)) {
    console.error(`Invalid MSP path (need signcerts/cert.pem and keystore/): ${resolvedMsp}`);
    process.exit(1);
  }

  const keyFiles = fs.readdirSync(keyDir).filter((f) => f.endsWith('_sk'));
  if (keyFiles.length === 0) {
    console.error('No private key found in keystore');
    process.exit(1);
  }

  const walletDir =
    walletPath ||
    process.env.FABRIC_WALLET_PATH ||
    path.join(__dirname, '../../blockchain/wallet');

  const wallet = await Wallets.newFileSystemWallet(path.resolve(walletDir));
  const identity = {
    credentials: {
      certificate: fs.readFileSync(certFile, 'utf8'),
      privateKey: fs.readFileSync(path.join(keyDir, keyFiles[0]), 'utf8'),
    },
    mspId: 'Org1MSP',
    type: 'X.509',
  };

  await wallet.put(label, identity);
  console.log(`Imported CA identity "${label}" (Org1MSP) into wallet: ${path.resolve(walletDir)}`);
  console.log('Set backend .env: FABRIC_IDENTITY=' + label);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
