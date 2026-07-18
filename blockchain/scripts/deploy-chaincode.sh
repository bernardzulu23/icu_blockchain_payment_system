#!/usr/bin/env bash
# Package, install, approve, and commit ReconciliationChaincode to icupaymentchannel.
# Uses stock fabric-samples/test-network/network.sh — does NOT patch it.
set -euo pipefail

CHANNEL="${CHANNEL:-icupaymentchannel}"
CC_NAME="${CC_NAME:-reconciliation-chaincode}"
CC_VERSION="${CC_VERSION:-1.0}"
CC_SEQUENCE="${CC_SEQUENCE:-1}"
CC_LANG="${CC_LANG:-go}"

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CC_PATH="${CC_PATH:-${REPO_ROOT}/blockchain/chaincode}"
FABRIC_SAMPLES="${FABRIC_SAMPLES:-$HOME/hyperledger/fabric-samples}"
TEST_NETWORK="${FABRIC_SAMPLES}/test-network"

if [[ ! -f "${TEST_NETWORK}/network.sh" ]]; then
  echo "Error: test-network not found at ${TEST_NETWORK}"
  echo "Complete blockchain/SETUP.md first."
  exit 1
fi

if [[ ! -f "${CC_PATH}/reconciliation_chaincode.go" ]]; then
  echo "Error: chaincode not found at ${CC_PATH}"
  exit 1
fi

echo "==> Running chaincode unit tests"
cd "${CC_PATH}"
go test ./... -v
cd - >/dev/null

export PATH="${FABRIC_SAMPLES}/bin:${PATH}"

echo "==> Deploying ${CC_NAME} v${CC_VERSION} to channel ${CHANNEL}"
cd "${TEST_NETWORK}"

# network.sh deployCC handles package/install/approve/commit on Org1 and Org2
./network.sh deployCC \
  -c "${CHANNEL}" \
  -ccn "${CC_NAME}" \
  -ccp "${CC_PATH}" \
  -ccl "${CC_LANG}" \
  -ccv "${CC_VERSION}" \
  -ccs "${CC_SEQUENCE}"

echo ""
echo "Deployed: ${CC_NAME} on ${CHANNEL}"
echo "Query example:"
echo "  peer chaincode query -C ${CHANNEL} -n ${CC_NAME} \\"
echo "    -c '{\"Args\":[\"GetStudentPaymentHistory\",\"STU001\"]}'"
