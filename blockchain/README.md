# ICU Blockchain (Hyperledger Fabric)

Hyperledger Fabric network for immutable payment records on the ICU Payment System ledger.

## Quick start (VPS)

Full reproducible steps: **[SETUP.md](./SETUP.md)**

```bash
# On Ubuntu 22.04 VPS after fabric-samples is installed:
bash blockchain/scripts/vps-provision.sh
bash blockchain/scripts/generate-connection-profile.sh
```

## Topology

| Component | ICU role |
|-----------|----------|
| Org1MSP | ICU Accounts (accountants) |
| Org2MSP | ICU Registrar |
| Channel | `icupaymentchannel` |
| Orderer | Single-node Raft |
| Identity | Fabric CA enabled (`-ca`) |

Uses stock `fabric-samples/test-network/network.sh` — **not modified**.

## Chaincode (Go) — ReconciliationChaincode

Implements **Chapter 3 / Pseudocode 2** reconciliation logic:

| Function | Description |
|----------|-------------|
| `MatchPayment` | Proactive duplicate prevention by `paymentHash`; emits `PaymentVerified` |
| `GetStudentPaymentHistory` | Range query by student, ordered by semester |
| `CheckClearanceEligibility` | Returns eligibility + missing semester numbers |
| `SubmitBatchRoot` | Stores one Merkle root per OCR batch (1 tx vs N) |

Legacy wrappers: `RecordPayment`, `GetAllPayments`, `QueryPayment` (backend compatibility).

### Tests

```bash
cd blockchain/chaincode && go test ./... -v
```

### Deploy

```bash
bash blockchain/scripts/deploy-chaincode.sh
```

## Backend integration

```env
FABRIC_CONNECTION_PROFILE=./blockchain/network/connection-profile.json
FABRIC_WALLET_PATH=./blockchain/wallet
FABRIC_CHANNEL=icupaymentchannel
FABRIC_CHAINCODE=reconciliation-chaincode
FABRIC_IDENTITY=admin
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/vps-provision.sh` | Bring up CA network + create channel |
| `scripts/verify-network.sh` | `docker ps` + `peer channel getinfo` |
| `scripts/generate-connection-profile.sh` | Build connection profile from running network |

## Verification (peer CLI)

```bash
peer chaincode query -C icupaymentchannel -n reconciliation-chaincode \
  -c '{"Args":["GetAllPayments","STU001"]}'
```

The Node.js backend uses `fabric-network`. If Fabric is unavailable and `BLOCKCHAIN_OPTIONAL=true`, verification falls back to the database.
