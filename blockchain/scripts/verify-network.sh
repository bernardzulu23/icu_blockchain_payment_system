#!/usr/bin/env bash
# Verify Fabric test-network containers and channel health.
set -euo pipefail

CHANNEL="${CHANNEL:-icupaymentchannel}"
FABRIC_SAMPLES="${FABRIC_SAMPLES:-$HOME/hyperledger/fabric-samples}"
TEST_NETWORK="${FABRIC_SAMPLES}/test-network"

export PATH="${FABRIC_SAMPLES}/bin:${PATH}"
export FABRIC_CFG_PATH="${FABRIC_SAMPLES}/config/"

echo "==> Docker containers"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "peer0|orderer|ca_org|NAMES" || docker ps

REQUIRED=("peer0.org1.example.com" "peer0.org2.example.com" "orderer.example.com")
for c in "${REQUIRED[@]}"; do
  if ! docker ps --format '{{.Names}}' | grep -q "$c"; then
    echo "WARN: container '$c' not found in docker ps"
  else
    echo "OK: $c running"
  fi
done

for c in ca_org1 ca_org2; do
  if docker ps --format '{{.Names}}' | grep -q "$c"; then
    echo "OK: $c running"
  else
    echo "WARN: $c not found (CA may use different compose naming)"
  fi
done

cd "$TEST_NETWORK"

echo ""
echo "==> peer channel getinfo (Org1 / ICU Accounts) — channel: ${CHANNEL}"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${TEST_NETWORK}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${TEST_NETWORK}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

peer channel getinfo -c "${CHANNEL}"

echo ""
echo "==> peer channel getinfo (Org2 / ICU Registrar) — channel: ${CHANNEL}"
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${TEST_NETWORK}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${TEST_NETWORK}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"
export CORE_PEER_ADDRESS=localhost:9051

peer channel getinfo -c "${CHANNEL}"

echo ""
echo "All checks passed for channel '${CHANNEL}'."
