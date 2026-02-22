# ICU Blockchain (Hyperledger Fabric)

This directory contains the chaincode for the ICU Payment System.

## Chaincode (Go)

- **payment_cc.go**: Smart contract for recording and verifying payments on the ledger
- Functions: `RecordPayment`, `GetPayment`, `VerifyPayment`

## Deployment

To deploy with Hyperledger Fabric 2.5:

1. Install [Fabric samples](https://hyperledger-fabric.readthedocs.io/en/latest/install.html)
2. Build chaincode: `cd chaincode && go build -o payment_cc .`
3. Package and install per your Fabric network setup
4. Set `FABRIC_CA_URL`, `FABRIC_PEER_URL`, `FABRIC_CHANNEL_NAME` in backend `.env`

## Integration

The Node.js backend generates a synthetic `tx_hash` for each verified payment. In production, replace this with actual Fabric transaction submission via the Fabric SDK.
