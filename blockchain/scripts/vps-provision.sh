#!/usr/bin/env bash
# ICU Fabric test-network bring-up wrapper.
# Uses stock fabric-samples/test-network/network.sh — does NOT patch it.
set -euo pipefail

CHANNEL="${CHANNEL:-icupaymentchannel}"
FABRIC_SAMPLES="${FABRIC_SAMPLES:-$HOME/hyperledger/fabric-samples}"
TEST_NETWORK="${FABRIC_SAMPLES}/test-network"

if [[ ! -f "${TEST_NETWORK}/network.sh" ]]; then
  echo "Error: ${TEST_NETWORK}/network.sh not found."
  echo "Complete SETUP.md sections 1–2 first (clone fabric-samples + bootstrap.sh)."
  exit 1
fi

export PATH="${FABRIC_SAMPLES}/bin:${PATH}"

echo "==> Stopping any existing network"
cd "$TEST_NETWORK"
./network.sh down

echo "==> Starting test-network with Fabric CA (-ca)"
./network.sh up -ca

echo "==> Creating channel: ${CHANNEL}"
./network.sh createChannel -c "${CHANNEL}"

echo "==> Running health verification"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHANNEL="${CHANNEL}" bash "${SCRIPT_DIR}/verify-network.sh"

echo ""
echo "Done. Channel '${CHANNEL}' is ready."
echo "Next: deploy chaincode (SETUP.md §7) and generate connection profile:"
echo "  bash blockchain/scripts/generate-connection-profile.sh"
