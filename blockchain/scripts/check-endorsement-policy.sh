#!/usr/bin/env bash
#
# check-endorsement-policy.sh
# ----------------------------
# Prints the ACTUAL committed endorsement policy for reconciliation-chaincode
# on icupaymentchannel, and (optionally) shows how to re-commit an explicit
# dual-org policy if the current one isn't what you want to defend in front
# of the panel.
#
# WHY THIS MATTERS FOR THE DEFENCE:
# "Both Org1 (ICU Accounts) and Org2 (ICU Registrar) must endorse a payment
# write" is only a real security property if it's actually the policy in
# effect. Fabric's default lifecycle commit (no --signature-policy / -ccep)
# uses the channel's implicit majority policy, which for a 2-org channel
# usually *does* require both orgs — but "usually" is not something you
# want to say to a blockchain-literate panel. Run this, know the exact
# answer, and be ready to quote it.
#
# Run from the repo (preferred) or from ~/hyperledger/fabric-samples/test-network.
# Same directory conventions as blockchain/SETUP.md and verify-network.sh.

set -euo pipefail

CHANNEL="${FABRIC_CHANNEL:-${CHANNEL:-icupaymentchannel}}"
CHAINCODE="${FABRIC_CHAINCODE:-${FABRIC_CHAINCODE_NAME:-${CC_NAME:-reconciliation-chaincode}}}"
FABRIC_SAMPLES="${FABRIC_SAMPLES:-$HOME/hyperledger/fabric-samples}"
TEST_NETWORK="${FABRIC_SAMPLES}/test-network"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CC_PATH="${CC_PATH:-${REPO_ROOT}/blockchain/chaincode}"

echo "== ICU Pay: endorsement policy check =="
echo "Channel:   $CHANNEL"
echo "Chaincode: $CHAINCODE"
echo

if [[ ! -f "${TEST_NETWORK}/network.sh" ]]; then
  echo "Error: test-network not found at ${TEST_NETWORK}"
  echo "Set FABRIC_SAMPLES or complete blockchain/SETUP.md first."
  exit 1
fi

export PATH="${FABRIC_SAMPLES}/bin:${PATH}"
export FABRIC_CFG_PATH="${FABRIC_SAMPLES}/config/"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE="${TEST_NETWORK}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
export CORE_PEER_MSPCONFIGPATH="${TEST_NETWORK}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

cd "${TEST_NETWORK}"

echo "--- Querying committed chaincode definition (as Org1 / ICU Accounts) ---"
peer lifecycle chaincode querycommitted \
  --channelID "$CHANNEL" \
  --name "$CHAINCODE"

echo
echo "The output above includes an 'Approvals' map and, if an explicit"
echo "--signature-policy / -ccep was used at commit time, the endorsement"
echo "policy string itself. If no explicit policy shows, the channel's default"
echo "application endorsement policy from configtx.yaml applies (usually"
echo "MAJORITY Endorsement of channel members)."
echo

TMPDIR_CFG="$(mktemp -d)"
cleanup() { rm -rf "${TMPDIR_CFG}"; }
trap cleanup EXIT

echo "--- Inspecting channel config for the default application policy ---"
ORDERER_CA="${TEST_NETWORK}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem"

if peer channel fetch config "${TMPDIR_CFG}/config_block.pb" \
  -o localhost:7050 \
  -c "$CHANNEL" \
  --tls --cafile "${ORDERER_CA}" >/dev/null 2>&1; then

  if configtxlator proto_decode \
    --input "${TMPDIR_CFG}/config_block.pb" \
    --type common.Block \
    --output "${TMPDIR_CFG}/config_block.json" 2>/dev/null; then
    echo "Default channel Endorsement policy (Application/Policies):"
    if command -v jq >/dev/null 2>&1; then
      jq '.data.data[0].payload.data.config.channel_group.groups.Application.policies.Endorsement' \
        "${TMPDIR_CFG}/config_block.json" \
        || echo "(Could not auto-extract — inspect the decoded block for .channel_group.groups.Application.policies.Endorsement)"
    else
      echo "(jq not installed — install jq or inspect ${TMPDIR_CFG}/config_block.json)"
    fi
  else
    echo "(configtxlator decode failed — peer lifecycle querycommitted above is still authoritative)"
  fi
else
  echo "(Could not fetch channel config block — orderer TLS/CA path may differ. The querycommitted output above is still the source of truth for the chaincode.)"
fi

echo
echo "=========================================================="
echo "TO SET AN EXPLICIT DUAL-ORG POLICY (recommended before the demo,"
echo "so you can state the exact policy string to the panel):"
echo
echo "From the ICU repo, bump version/sequence and pass the policy:"
echo
cat <<EOF
  CC_VERSION=1.1 CC_SEQUENCE=2 \\
  CC_ENDORSEMENT_POLICY=\"AND('Org1MSP.peer','Org2MSP.peer')\" \\
  bash ${REPO_ROOT}/blockchain/scripts/deploy-chaincode.sh
EOF
echo
echo "Or manually from test-network:"
echo
cat <<EOF
  ./network.sh deployCC \\
    -c ${CHANNEL} \\
    -ccn ${CHAINCODE} \\
    -ccp ${CC_PATH} \\
    -ccl go \\
    -ccv 1.1 \\
    -ccs 2 \\
    -ccep "AND('Org1MSP.peer','Org2MSP.peer')"
EOF
echo
echo "This policy string translates to: a transaction is only committed"
echo "if it is endorsed by at least one peer from Org1 (ICU Accounts) AND"
echo "at least one peer from Org2 (ICU Registrar). That is the exact"
echo "sentence to say in the defence when asked what the policy enforces."
echo "=========================================================="
