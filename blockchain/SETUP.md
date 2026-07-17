# Hyperledger Fabric VPS Setup — ICU Payment Network

Reproducible guide for provisioning a **Hyperledger Fabric 2.x test network** on a fresh **Ubuntu 22.04 VPS** (minimum **4 vCPU / 8 GB RAM**).

This uses the official **fabric-samples/test-network** scripts **unchanged**. ICU-specific naming is applied via channel name, connection profiles, and documentation — not by editing `network.sh`.

## ICU org mapping (test-network defaults)

| fabric-samples org | ICU role | MSP ID | Peer container |
|--------------------|----------|--------|----------------|
| Org1 | ICU Accounts (accountants) | `Org1MSP` | `peer0.org1.example.com` |
| Org2 | ICU Registrar | `Org2MSP` | `peer0.org2.example.com` |

Channel: **`icupaymentchannel`**

Topology: 2 peer orgs (1 peer each), single-node Raft orderer, **Fabric CA enabled** (`-ca`).

---

## 1. VPS baseline (Ubuntu 22.04)

SSH into the VPS as a sudo user, then run:

```bash
sudo apt-get update
sudo apt-get upgrade -y

# Docker
sudo apt-get install -y ca-certificates curl gnupg lsb-release git make jq
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker "$USER"
newgrp docker

docker --version
docker compose version
```

### Go 1.21+ (chaincode build)

```bash
cd /tmp
curl -LO https://go.dev/dl/go1.22.10.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.22.10.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
echo 'export GOPATH=$HOME/go' >> ~/.bashrc
source ~/.bashrc
go version
```

### Fabric host prerequisites

```bash
sudo apt-get install -y python3 python3-pip
```

Optional: increase Docker memory if the provider allows (Fabric peers are memory-heavy).

---

## 2. Clone fabric-samples and install Fabric binaries/images

```bash
mkdir -p ~/hyperledger
cd ~/hyperledger

git clone https://github.com/hyperledger/fabric-samples.git
cd fabric-samples

# Pin to a stable 2.x release (adjust tag as needed)
git checkout v2.5.12

# Pull Fabric binaries (peer, orderer, configtxgen, cryptogen, fabric-ca-client, etc.)
# and Docker images for the same version
./scripts/bootstrap.sh

# Confirm binaries
export PATH=$HOME/hyperledger/fabric-samples/bin:$PATH
peer version
orderer version
fabric-ca-client version
```

Expected: Fabric **2.5.x** peer/orderer and **fabric-ca** client available in `~/hyperledger/fabric-samples/bin`.

---

## 3. Bring up test-network with Fabric CA

```bash
cd ~/hyperledger/fabric-samples/test-network

# Clean any prior run
./network.sh down

# Start: 2 orgs, 1 peer each, Raft orderer, Fabric CA enabled (NOT cryptogen-only)
./network.sh up -ca
```

### Confirm containers are running

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

You should see (names may include `fabric-` prefix depending on compose project):

| Container | Role |
|-----------|------|
| `peer0.org1.example.com` | ICU Accounts peer |
| `peer0.org2.example.com` | ICU Registrar peer |
| `orderer.example.com` | Raft orderer |
| `ca_org1` | Fabric CA for Org1 |
| `ca_org2` | Fabric CA for Org2 |

All should show **Up** / healthy.

---

## 4. Create ICU payment channel

```bash
cd ~/hyperledger/fabric-samples/test-network

./network.sh createChannel -c icupaymentchannel
```

This uses the stock `configtx/configtx.yaml` from test-network — **do not edit `network.sh`**. Channel name is the only ICU-specific parameter at this stage.

---

## 5. Verify channel health

```bash
cd ~/hyperledger/fabric-samples/test-network
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config/

# Org1 (ICU Accounts) peer channel info
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer channel getinfo -c icupaymentchannel
```

Repeat for Org2:

```bash
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer channel getinfo -c icupaymentchannel
```

Success: JSON output with `"height"` ≥ 1 and no TLS/connection errors.

Quick container health:

```bash
docker inspect -f '{{.Name}} {{.State.Health.Status}}' \
  peer0.org1.example.com peer0.org2.example.com orderer.example.com ca_org1 ca_org2 2>/dev/null \
  || docker ps --filter "name=peer0\|orderer\|ca_org" --format "{{.Names}} {{.Status}}"
```

---

## 6. Fabric CA — real identity issuance (not cryptogen-only)

With `-ca`, the network uses **Fabric CA** for enrollment. The test-network `registerEnroll.sh` flow (invoked by `network.sh up -ca`) creates admin users. For **ICU staff** (accountants, registrar), register additional identities via CA:

### Org1 — ICU Accounts staff (example: accountant)

```bash
cd ~/hyperledger/fabric-samples/test-network
export PATH=${PWD}/../bin:$PATH
export FABRIC_CA_CLIENT_HOME=${PWD}/organizations/peerOrganizations/org1.example.com/

# Enroll Org1 admin (if not already present from network bring-up)
fabric-ca-client enroll -u https://admin:adminpw@localhost:7054 --caname ca-org1 --tls.certfiles "${PWD}/organizations/fabric-ca/org1/tls-ca-cert.pem"

# Register accountant user
fabric-ca-client register --caname ca-org1 --id.name accountant1 --id.secret accountant1pw --id.type client --tls.certfiles "${PWD}/organizations/fabric-ca/org1/tls-ca-cert.pem"

# Enroll accountant into wallet/msp
mkdir -p "${PWD}/organizations/peerOrganizations/org1.example.com/users/Accountant1@org1.example.com/msp"
fabric-ca-client enroll -u https://accountant1:accountant1pw@localhost:7054 --caname ca-org1 -M "${PWD}/organizations/peerOrganizations/org1.example.com/users/Accountant1@org1.example.com/msp" --tls.certfiles "${PWD}/organizations/fabric-ca/org1/tls-ca-cert.pem"
```

### Org2 — ICU Registrar staff (example: registrar)

```bash
export FABRIC_CA_CLIENT_HOME=${PWD}/organizations/peerOrganizations/org2.example.com/

fabric-ca-client enroll -u https://admin:adminpw@localhost:8054 --caname ca-org2 --tls.certfiles "${PWD}/organizations/fabric-ca/org2/tls-ca-cert.pem"

fabric-ca-client register --caname ca-org2 --id.name registrar1 --id.secret registrar1pw --id.type client --tls.certfiles "${PWD}/organizations/fabric-ca/org2/tls-ca-cert.pem"

mkdir -p "${PWD}/organizations/peerOrganizations/org2.example.com/users/Registrar1@org2.example.com/msp"
fabric-ca-client enroll -u https://registrar1:registrar1pw@localhost:8054 --caname ca-org2 -M "${PWD}/organizations/peerOrganizations/org2.example.com/users/Registrar1@org2.example.com/msp" --tls.certfiles "${PWD}/organizations/fabric-ca/org2/tls-ca-cert.pem"
```

> **CA ports (default test-network):** Org1 CA `7054`, Org2 CA `8054`.  
> Store enrolled MSP folders securely; import into the Node.js wallet for the backend (see §8).

---

## 7. Deploy ReconciliationChaincode (Go)

Chaincode: `blockchain/chaincode/reconciliation_chaincode.go`  
Deploy name: **`reconciliation-chaincode`**  
Channel: **`icupaymentchannel`**

### Run unit tests (on VPS or dev machine with Go 1.21+)

```bash
cd /path/to/ICU-Blockchain-Payment-System/blockchain/chaincode
go test ./... -v
```

### Package / install / approve / commit (both Org1 and Org2)

```bash
# Automated — runs tests then network.sh deployCC
bash blockchain/scripts/deploy-chaincode.sh
```

Manual equivalent (stock `network.sh`, unchanged):

```bash
cd ~/hyperledger/fabric-samples/test-network
./network.sh deployCC \
  -c icupaymentchannel \
  -ccn reconciliation-chaincode \
  -ccp /path/to/ICU-Blockchain-Payment-System/blockchain/chaincode \
  -ccl go \
  -ccv 1.0 \
  -ccs 1
```

### Chaincode functions (ReconciliationChaincode)

| Function | Type | Purpose |
|----------|------|---------|
| `MatchPayment` | invoke | Duplicate prevention by `paymentHash`; emits `PaymentVerified` |
| `GetStudentPaymentHistory` | query | All payments for student, ordered by semester |
| `CheckClearanceEligibility` | query | Returns `{eligible, missingSemesters}` |
| `SubmitBatchRoot` | invoke | One Merkle root per OCR batch |
| `RecordPayment` | invoke | Legacy JSON wrapper → `MatchPayment` |
| `GetAllPayments` | query | Legacy alias → `GetStudentPaymentHistory` |

### Verify deployment

```bash
peer chaincode query -C icupaymentchannel -n reconciliation-chaincode \
  -c '{"Args":["GetStudentPaymentHistory","STU001"]}'
```

---

## 8. Connect the ICU backend

Copy the example connection profile and point the backend `.env` at it:

```bash
cp blockchain/network/connection-profile.vps.json.example blockchain/network/connection-profile.json
# Edit grpcs://127.0.0.1:7051 if backend runs on the same VPS
```

Backend environment (`backend/.env` on the VPS):

```env
FABRIC_CONNECTION_PROFILE=./blockchain/network/connection-profile.json
FABRIC_WALLET_PATH=./blockchain/wallet
FABRIC_CHANNEL=icupaymentchannel
FABRIC_CHAINCODE=reconciliation-chaincode
FABRIC_IDENTITY=admin
BLOCKCHAIN_OPTIONAL=false
```

Import an enrolled identity into the wallet using the Fabric Node SDK, or copy MSP material from the CA enroll step into `blockchain/wallet/`.

If the backend runs **on the same VPS** as Fabric, keep `discovery.asLocalhost: true` in `blockchainService.js`. If the backend runs **remotely**, set the VPS public IP in the connection profile and use `asLocalhost: false`.

---

## 9. Tear down / rebuild

```bash
cd ~/hyperledger/fabric-samples/test-network
./network.sh down
```

To fully rebuild from scratch, repeat sections **3 → 5**. Channel and chaincode deployment must be re-run after a fresh `up`.

---

## 10. Automated helper scripts (this repo)

Optional wrappers that **do not modify** `network.sh`:

```bash
# From repo root on the VPS (after fabric-samples is installed)
bash blockchain/scripts/vps-provision.sh    # runs documented steps 3–4
bash blockchain/scripts/verify-network.sh # docker ps + peer channel getinfo
```

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `peer` not found | `export PATH=~/hyperledger/fabric-samples/bin:$PATH` |
| CA connection refused | `docker ps \| grep ca_org`; wait for CA healthy |
| Channel create fails | `./network.sh down` then `up -ca` again; disk space `df -h` |
| OOM / peer exits | VPS RAM < 8 GB — reduce concurrent containers or upgrade VPS |
| TLS handshake error | `CORE_PEER_TLS_ROOTCERT_FILE` path must match org peer TLS CA |

---

## Command summary (copy-paste rebuild)

```bash
# === One-shot rebuild sequence ===
cd ~/hyperledger/fabric-samples/test-network
./network.sh down
./network.sh up -ca
./network.sh createChannel -c icupaymentchannel
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config/
export CORE_PEER_TLS_ENABLED=true CORE_PEER_LOCALMSPID="Org1MSP" \
  CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp \
  CORE_PEER_ADDRESS=localhost:7051
peer channel getinfo -c icupaymentchannel
docker ps
```

---

## Files in this repo (configuration only — not network.sh)

| File | Purpose |
|------|---------|
| `blockchain/network/connection-profile.vps.json.example` | Backend connection profile template |
| `blockchain/network/org-mapping.json` | Org1/Org2 → ICU Accounts/Registrar mapping |
| `blockchain/scripts/vps-provision.sh` | Non-invasive automation wrapper |
| `blockchain/scripts/verify-network.sh` | Post-deploy health checks |

**Do not edit** `~/hyperledger/fabric-samples/test-network/network.sh`. Customize via connection profiles, channel name (`-c`), and CA enrollment — not script patches.
