#!/usr/bin/env node
/**
 * verify-chain.js
 * ----------------
 * INDEPENDENT chain verification tool for the ICU Pay defence demo.
 *
 * WHY THIS SCRIPT EXISTS:
 * The backend is the only runtime that normally talks to Fabric. That means
 * "trust the ledger" and "trust the backend" look like the same thing in a
 * panel demo. This script proves the opposite: it opens its own gateway
 * connection with its own wallet identity and never imports backend/src
 * services or Postgres. If someone tampers with Postgres, this script will
 * not agree with it.
 *
 * USAGE (from backend/):
 *   node scripts/verify-chain.js --student STU001 --semester 1
 *
 *   Supply the values you believe are in Postgres for an explicit MATCH / MISMATCH:
 *
 *   node scripts/verify-chain.js --student STU001 --semester 1 \
 *     --amount 5000 --batchNumber B12345
 *
 * ON-CHAIN FACTS (from blockchain/chaincode/reconciliation_chaincode.go):
 *   Query: GetStudentPaymentHistory(studentID)
 *   Payment JSON: paymentHash, studentID, amount, semester, batchNumber, txId, recordedAt
 *   academicYear and bankName are NOT stored on the ledger — do not pass them
 *   expecting an on-chain filter. They exist only in Postgres.
 *
 * HASH (must match backend/src/utils/paymentHash.js):
 *   sha256( studentId + "|" + amount + "|" + semester + "|" + batchNumber )
 *   Chaincode does not recompute the hash; it stores the hash the backend submitted.
 *
 * Env (same as the API): FABRIC_CONNECTION_PROFILE, FABRIC_WALLET_PATH,
 * FABRIC_CHANNEL, FABRIC_CHAINCODE, FABRIC_IDENTITY, FABRIC_AS_LOCALHOST.
 *
 * Requires fabric-network (backend dependency, ^2.2).
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const crypto = require('crypto');

const CHAINCODE_QUERY_FN = 'GetStudentPaymentHistory';

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].replace(/^--/, '');
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  if (!args.student) {
    console.error(
      'Usage: node scripts/verify-chain.js --student <studentID> [--semester N] [--amount N] [--batchNumber B]'
    );
    process.exit(1);
  }
  return args;
}

/** Same formula as backend/src/utils/paymentHash.js — inlined so this file does not import backend services. */
function computeExpectedHash({ studentID, amount, semester, batchNumber }) {
  const payload = [String(studentID), String(amount), String(semester), String(batchNumber)].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function field(rec, ...keys) {
  for (const k of keys) {
    if (rec[k] != null && rec[k] !== '') return rec[k];
  }
  return undefined;
}

function formatRecord(rec) {
  return [
    `  studentID:     ${field(rec, 'studentID', 'StudentID')}`,
    `  semester:      ${field(rec, 'semester', 'Semester')}`,
    `  amount:        ${field(rec, 'amount', 'Amount')}`,
    `  batchNumber:   ${field(rec, 'batchNumber', 'BatchNumber')}`,
    `  paymentHash:   ${field(rec, 'paymentHash', 'PaymentHash') ?? '(n/a)'}`,
    `  txId:          ${field(rec, 'txId', 'TxId', 'TxID') ?? '(n/a)'}`,
    `  recordedAt:    ${field(rec, 'recordedAt', 'RecordedAt') ?? '(n/a)'}`,
  ].join('\n');
}

async function main() {
  const args = parseArgs();

  const connectionProfilePath =
    process.env.FABRIC_CONNECTION_PROFILE ||
    path.join(__dirname, '../../blockchain/network/connection-profile.json');
  const walletPath =
    process.env.FABRIC_WALLET_PATH || path.join(__dirname, '../../blockchain/wallet');
  const channelName = process.env.FABRIC_CHANNEL || 'icupaymentchannel';
  const chaincodeName = process.env.FABRIC_CHAINCODE || 'reconciliation-chaincode';
  const identityLabel = process.env.FABRIC_IDENTITY || 'accountantAdmin';
  const asLocalhost = process.env.FABRIC_AS_LOCALHOST !== 'false';

  const ccpPath = path.resolve(connectionProfilePath);
  if (!fs.existsSync(ccpPath)) {
    console.error(`Connection profile not found: ${ccpPath}`);
    console.error('Set FABRIC_CONNECTION_PROFILE or generate the profile on the Fabric VPS.');
    process.exit(1);
  }

  const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
  const wallet = await Wallets.newFileSystemWallet(path.resolve(walletPath));

  const identity = await wallet.get(identityLabel);
  if (!identity) {
    console.error(`Identity "${identityLabel}" not found in wallet at ${walletPath}.`);
    console.error(
      'This script opens its own gateway — import an identity with: node scripts/import-fabric-identity.js'
    );
    process.exit(1);
  }

  const gateway = new Gateway();
  try {
    await gateway.connect(ccp, {
      wallet,
      identity: identityLabel,
      discovery: { enabled: true, asLocalhost },
    });

    const network = await gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);

    console.log(
      `\n[verify-chain] Connected directly to chaincode "${chaincodeName}" on channel "${channelName}" as "${identityLabel}".`
    );
    console.log('[verify-chain] This connection does NOT go through the backend API or Postgres.\n');

    if (args.academicYear || args.bankName) {
      console.log(
        '[verify-chain] Note: academicYear and bankName are Postgres-only; they are not on the Payment ledger object.\n'
      );
    }

    const resultBytes = await contract.evaluateTransaction(CHAINCODE_QUERY_FN, args.student);
    const raw = resultBytes && resultBytes.length ? resultBytes.toString() : '[]';
    const records = JSON.parse(raw);
    const list = Array.isArray(records) ? records : records ? [records] : [];

    if (list.length === 0) {
      console.log(`No on-chain payment history found for student "${args.student}".`);
      return;
    }

    let target = list;
    if (args.semester) {
      target = target.filter((r) => String(field(r, 'semester', 'Semester')) === String(args.semester));
    }

    if (target.length === 0) {
      console.log(
        `Student "${args.student}" has on-chain history, but none matching semester "${args.semester}".`
      );
      console.log('All on-chain records for this student:');
      list.forEach((r) => console.log(`${formatRecord(r)}\n`));
      return;
    }

    console.log(`Found ${target.length} matching on-chain record(s):\n`);
    target.forEach((rec) => console.log(`${formatRecord(rec)}\n`));

    if (args.amount && args.batchNumber) {
      const rec = target[0];
      const semester = args.semester ?? field(rec, 'semester', 'Semester');
      const expectedHash = computeExpectedHash({
        studentID: args.student,
        amount: args.amount,
        semester,
        batchNumber: args.batchNumber,
      });
      const chainHash = field(rec, 'paymentHash', 'PaymentHash');
      const chainAmount = String(field(rec, 'amount', 'Amount'));
      const chainBatch = String(field(rec, 'batchNumber', 'BatchNumber'));
      const chainSemester = String(field(rec, 'semester', 'Semester'));

      console.log('--- Independent verification result ---');
      console.log(`Hash from supplied values (studentId|amount|semester|batchNumber): ${expectedHash}`);
      console.log(`Hash stored on-chain:                                              ${chainHash}`);
      console.log(`On-chain amount / semester / batch: ${chainAmount} / ${chainSemester} / ${chainBatch}`);
      console.log(`Supplied amount / semester / batch: ${args.amount} / ${semester} / ${args.batchNumber}`);

      const hashMatch = expectedHash === chainHash;
      const fieldsMatch =
        chainAmount === String(args.amount) &&
        chainBatch === String(args.batchNumber) &&
        chainSemester === String(semester);

      if (hashMatch && fieldsMatch) {
        console.log('\n RESULT: MATCH — supplied values match the ledger.\n');
      } else {
        console.log('\n RESULT: MISMATCH — supplied (Postgres) values do NOT match the ledger.');
        console.log('Either Postgres was altered after verification, or it never matched what was recorded on-chain.\n');
      }
    }
  } catch (err) {
    console.error('\n[verify-chain] ERROR:', err.message);
    console.error('Common causes: wrong FABRIC_CONNECTION_PROFILE, peer unreachable,');
    console.error('identity not enrolled, or chaincode not committed on the channel.\n');
    process.exitCode = 1;
  } finally {
    gateway.disconnect();
  }
}

main();
