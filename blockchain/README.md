# ICU Blockchain (Hyperledger Fabric)

This directory contains the chaincode for the ICU Payment System.

## Chaincode (Go)

- **payment_cc.go**: Smart contract for recording and verifying payments on the ledger
- Functions: `RecordPayment`, `GetPayment`, `QueryPayment`, `GetAllPayments`, `VerifyPayment`

## Deployment

To deploy with Hyperledger Fabric 2.5:

1. Install [Fabric samples](https://hyperledger-fabric.readthedocs.io/en/latest/install.html)
2. Build chaincode: `cd chaincode && go build -o payment_cc .`
3. Package and install per your Fabric network setup
4. Set `FABRIC_CONNECTION_PROFILE`, `FABRIC_WALLET_PATH`, `FABRIC_CHANNEL`, `FABRIC_CHAINCODE`, `FABRIC_IDENTITY` in backend `.env`

## Verification (peer CLI)

Use `peer chaincode query` for read-only operations (not `invoke`):

```bash
# Get all payments for a student
peer chaincode query -C payments-channel -n payment-contract -c '{"Args":["GetAllPayments","STU001"]}'

# Query specific payment (studentId, semester, academicYear)
peer chaincode query -C payments-channel -n payment-contract -c '{"Args":["QueryPayment","STU001","1","2025"]}'
```

## Integration

The Node.js backend uses fabric-network to submit transactions. Clearance checks use `GetAllPayments` from the chain; if Fabric is unavailable, the system falls back to the database.
