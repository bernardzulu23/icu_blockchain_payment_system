#!/usr/bin/env bash
# Generate connection-profile.json from a running fabric-samples test-network.
# Does NOT modify network.sh or any Fabric core scripts.
set -euo pipefail

FABRIC_SAMPLES="${FABRIC_SAMPLES:-$HOME/hyperledger/fabric-samples}"
TEST_NETWORK="${FABRIC_SAMPLES}/test-network"
OUTPUT="${1:-$(cd "$(dirname "$0")/../network" && pwd)/connection-profile.json}"

if [[ ! -d "$TEST_NETWORK/organizations" ]]; then
  echo "Error: test-network not found at $TEST_NETWORK"
  echo "Run SETUP.md steps 2–3 first."
  exit 1
fi

python3 - "$TEST_NETWORK" "$OUTPUT" <<'PY'
import json, sys, pathlib

test_network = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])

def read_pem(rel):
    p = test_network / rel
    if not p.is_file():
        raise SystemExit(f"Missing TLS cert: {p}")
    return p.read_text(encoding="utf-8")

org1_pem = read_pem("organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt")
org2_pem = read_pem("organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt")
orderer_pem = read_pem("organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem")
ca1_pem = read_pem("organizations/fabric-ca/org1/tls-ca-cert.pem")
ca2_pem = read_pem("organizations/fabric-ca/org2/tls-ca-cert.pem")

profile = {
  "name": "icu-payment-network",
  "version": "1.0.0",
  "client": {
    "organization": "Org1",
    "connection": {
      "timeout": {
        "peer": {"endorser": "300"},
        "orderer": "300",
      }
    },
  },
  "organizations": {
    "Org1": {
      "mspid": "Org1MSP",
      "peers": ["peer0.org1.example.com"],
      "certificateAuthorities": ["ca.org1.example.com"],
    },
    "Org2": {
      "mspid": "Org2MSP",
      "peers": ["peer0.org2.example.com"],
      "certificateAuthorities": ["ca.org2.example.com"],
    },
  },
  "orderers": {
    "orderer.example.com": {
      "url": "grpcs://127.0.0.1:7050",
      "tlsCACerts": {"pem": orderer_pem},
      "grpcOptions": {
        "ssl-target-name-override": "orderer.example.com",
        "hostnameOverride": "orderer.example.com",
      },
    }
  },
  "peers": {
    "peer0.org1.example.com": {
      "url": "grpcs://127.0.0.1:7051",
      "tlsCACerts": {"pem": org1_pem},
      "grpcOptions": {
        "ssl-target-name-override": "peer0.org1.example.com",
        "hostnameOverride": "peer0.org1.example.com",
      },
    },
    "peer0.org2.example.com": {
      "url": "grpcs://127.0.0.1:9051",
      "tlsCACerts": {"pem": org2_pem},
      "grpcOptions": {
        "ssl-target-name-override": "peer0.org2.example.com",
        "hostnameOverride": "peer0.org2.example.com",
      },
    },
  },
  "certificateAuthorities": {
    "ca.org1.example.com": {
      "url": "https://127.0.0.1:7054",
      "caName": "ca-org1",
      "tlsCACerts": {"pem": ca1_pem},
      "httpOptions": {"verify": False},
    },
    "ca.org2.example.com": {
      "url": "https://127.0.0.1:8054",
      "caName": "ca-org2",
      "tlsCACerts": {"pem": ca2_pem},
      "httpOptions": {"verify": False},
    },
  },
  "channels": {
    "icupaymentchannel": {
      "orderers": ["orderer.example.com"],
      "peers": {
        "peer0.org1.example.com": {
          "endorsingPeer": True,
          "chaincodeQuery": True,
          "ledgerQuery": True,
          "eventSource": True,
        },
        "peer0.org2.example.com": {
          "endorsingPeer": True,
          "chaincodeQuery": True,
          "ledgerQuery": True,
          "eventSource": True,
        },
      },
    }
  },
}

output.write_text(json.dumps(profile, indent=2), encoding="utf-8")
print(f"Wrote {output}")
PY

echo "Set backend .env: FABRIC_CHANNEL=icupaymentchannel"
