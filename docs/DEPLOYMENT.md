# Deployment — Vercel + Neon (+ API VPS)

## Can you use Vercel and Neon?

**Yes — for two layers:**

| Layer | Host | Tool |
|-------|------|------|
| React frontend | **Vercel** | Static SPA from `frontend/dist` |
| PostgreSQL | **Neon** | Via [Vercel Neon integration](https://vercel.com/integrations/neon) |

**Not on Vercel alone:**

| Component | Why it needs another host |
|-----------|---------------------------|
| **Express API** | Fabric SDK uses persistent gRPC; OCR batches can exceed 60s |
| **Hyperledger Fabric** | Peers/orderer on a VPS |
| **Python OCR** | Tesseract + OpenCV long-running service |

Typical production layout:

```
Vercel (SPA)  ──HTTPS──►  VPS API :5000  ──►  Neon Postgres
                              │
                              ├── Fabric peers (same VPS)
                              └── Python OCR :8000
```

---

## Quick start: Vercel + Neon

### 1. Link Vercel and add Neon

```bash
npm i -g vercel
vercel login
vercel link

# Add Neon to your Vercel team/project
vercel integration add neon

# Pull Neon URLs into .env.local (do not commit)
npm run env:pull
```

Vercel injects (names may vary):

- `POSTGRES_URL` — **pooled** (use for API runtime)
- `POSTGRES_URL_NON_POOLING` — **direct** (use for migrations)

### 2. Run database migrations against Neon

```bash
# Uses POSTGRES_URL_NON_POOLING from .env.local when present
npm run db:migrate
```

Copy the Neon URLs from `.env.local` into your **API host** `backend/.env`:

```env
DATABASE_URL=<POSTGRES_URL pooled>
POSTGRES_URL_NON_POOLING=<direct URL>
DB_SSL=true
```

### 3. Deploy frontend to Vercel

**Project settings**

| Setting | Value |
|---------|-------|
| Root Directory | repository root (uses root `vercel.json`) |
| Build Command | `cd frontend && npm run build` |
| Output Directory | `frontend/dist` |

**Environment variables (Vercel → Production)**

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://api.your-domain.com/api` |

Redeploy after setting `VITE_API_URL` — it is baked in at build time.

### 4. Deploy API (VPS or Railway) with same Neon DB

```bash
cp backend/.env.example backend/.env
# Edit: FRONTEND_URL, DATABASE_URL, Neon URLs, Fabric, PYTHON_SERVICE_URL

cd backend && npm install
npm run db:migrate   # if not already applied to Neon

# VPS with PM2
pm2 start backend/ecosystem.config.cjs
```

**Required on API host**

```env
FRONTEND_URL=https://your-app.vercel.app
DATABASE_URL=postgresql://...@ep-xxx-pooler.neon.tech/neondb?sslmode=require
DB_SSL=true
JWT_SECRET=<strong-secret>
REDIS_ENABLED=false
BLOB_READ_WRITE_TOKEN=<from Vercel Blob store>
```

CORS allows your production Vercel URL and any `*.vercel.app` preview deployment.

### 5. Vercel Blob (file uploads)

1. Vercel Dashboard → Storage → Blob → Create store  
2. Copy `BLOB_READ_WRITE_TOKEN` to **API host** `backend/.env` (not required on frontend-only Vercel project)

Deposit slips and bank PDFs upload to Blob; the API stores public URLs in Neon.

---

## Environment file map

| File | Purpose |
|------|---------|
| `.env.example` | Repo template — read this first |
| `.env.local` | From `vercel env pull` — Neon URLs (gitignored) |
| `.env` | Local root overrides (minimal) |
| `frontend/.env.example` | `VITE_API_URL` for local dev |
| `backend/.env.example` | Full API + Neon + Fabric template |
| `backend/.env` | Your API secrets (gitignored) |

---

## What runs where (summary)

| Variable | Vercel (frontend) | API VPS | Local dev |
|----------|-------------------|---------|-----------|
| `VITE_API_URL` | ✅ Required | — | `http://localhost:5000/api` |
| `DATABASE_URL` | ❌ | ✅ Neon pooled | local or Neon |
| `POSTGRES_URL_NON_POOLING` | migrate only | migrate | migrate |
| `JWT_SECRET` | ❌ | ✅ | ✅ |
| `BLOB_READ_WRITE_TOKEN` | ❌ | ✅ | optional |
| `FABRIC_*` | ❌ | ✅ | optional |
| `PYTHON_SERVICE_URL` | ❌ | ✅ | `http://localhost:8000` |
| `BLOCKCHAIN_OPTIONAL` | — | `false` prod | `true` without Fabric |

---

## Demo without Fabric VPS

For UI + Neon only (no on-chain verification):

- Host API on Railway/Render with `BLOCKCHAIN_OPTIONAL=true`
- Skip `FABRIC_*` configuration
- OCR still needs `PYTHON_SERVICE_URL` or batch OCR endpoints return 503

Full thesis stack still needs the Fabric VPS from `blockchain/SETUP.md`.

---

## Detailed VPS / Fabric steps

See the rest of this file below for Fabric wallet import, PM2, Nginx, and health checks.

---

# Deployment Architecture — ICU Payment System (detail)

## Split deployment (required for Fabric)

| Component | Where | Why |
|-----------|-------|-----|
| **React frontend** | **Vercel** | Static SPA, Neon Postgres via API only |
| **Express API + Fabric SDK** | **Fabric VPS** (same host as peers) | Long-lived gRPC to `peer0.org1` / orderer |
| **PostgreSQL** | **Neon** (via Vercel integration) | Fast-query cache; not source of truth for verified payments |
| **Hyperledger Fabric** | **Fabric VPS** | Ledger source of truth (`MatchPayment`, `CheckClearanceEligibility`) |

### Why not Vercel serverless for the API?

The Fabric Node SDK (`fabric-network`) opens **persistent gRPC connections** to peers and the orderer. Vercel Functions:

- Cold-start on every invocation (multi-second gateway handshake)
- **60s max duration** (payment verify + chaincode endorse can exceed this under load)
- No background process for connection pooling
- Ephemeral filesystem (wallet/CCP paths are fragile)

The `fabricGateway.js` module **refuses to connect** when `VERCEL=1` and returns a clear error directing you to the VPS API.

`vercel.json` in this repo deploys **frontend only**. The `api/` serverless handler is **not used** in production.

```
┌─────────────────┐         HTTPS          ┌──────────────────────────────┐
│  Vercel         │ ──────────────────────►│  Fabric VPS                  │
│  React SPA      │   VITE_API_URL         │  Express :5000               │
│  (Neon via API) │                        │  fabricGateway.js (persistent)│
└─────────────────┘                        │  Fabric test-network         │
                                           │  peer0.org1 / orderer        │
                                           └──────────────────────────────┘
                                                      │
                                                      ▼
                                           ┌──────────────────────────────┐
                                           │  Neon PostgreSQL (cache)       │
                                           └──────────────────────────────┘
```

---

## 1. Fabric VPS — API deployment

### Prerequisites

- Prompt 1 network running (`icupaymentchannel`)
- Prompt 2 chaincode deployed (`reconciliation-chaincode`)
- Connection profile: `blockchain/network/connection-profile.json`
- CA identity in wallet:

```bash
node backend/scripts/import-fabric-identity.js \
  --msp ~/hyperledger/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/Accountant1@org1.example.com/msp \
  --label accountantAdmin
```

### Backend `.env` on VPS

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-app.vercel.app

# Neon (pooled URL for runtime)
DATABASE_URL=postgresql://...@...-pooler.neon.tech/neondb?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://...@....neon.tech/neondb?sslmode=require
DB_SSL=true

# Fabric — Org1 ICU Accounts
FABRIC_CONNECTION_PROFILE=./blockchain/network/connection-profile.json
FABRIC_WALLET_PATH=./blockchain/wallet
FABRIC_CHANNEL=icupaymentchannel
FABRIC_CHAINCODE=reconciliation-chaincode
FABRIC_IDENTITY=accountantAdmin
FABRIC_AS_LOCALHOST=true
BLOCKCHAIN_OPTIONAL=false

# Proposal NFRs
JWT_EXPIRES_IN=15m
BCRYPT_ROUNDS=12
```

### Run with PM2 (recommended)

```bash
cd /path/to/ICU-Blockchain-Payment-System
npm install
cd backend && npm install

# First-time DB schema on Neon
npm run db:migrate

pm2 start backend/ecosystem.config.cjs
pm2 save
pm2 startup
```

### Nginx reverse proxy (optional)

```nginx
server {
    listen 443 ssl;
    server_name api.icu-payments.example.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 2. Vercel — frontend only

### Project settings

| Setting | Value |
|---------|-------|
| Root Directory | repo root (or `frontend` with adjusted commands) |
| Build Command | `cd frontend && npm run build` |
| Output | `frontend/dist` |

### Environment variables (Vercel dashboard)

| Variable | Example |
|----------|---------|
| `VITE_API_URL` | `https://api.icu-payments.example.com/api` |

Do **not** set Fabric variables on Vercel — they are ignored and misleading.

### CORS

Set `FRONTEND_URL=https://your-app.vercel.app` on the **VPS** backend so CORS allows the Vercel origin. Preview URLs on `*.vercel.app` are allowed automatically.

---

## 3. Data flow after integration

### Payment verification (`POST /api/accountant/verify/:id`)

1. Accountant approves in UI → VPS API
2. **`MatchPayment`** submitted on Fabric ledger (source of truth)
3. Postgres on Neon updated with `status=verified`, `blockchain_tx_id=paymentHash`
4. PDF statement generated; notifications sent

If Fabric is down and `BLOCKCHAIN_OPTIONAL=false` (production default on VPS), approval **fails** with 503.

### Clearance (`POST /api/clearance/request`)

1. **`CheckClearanceEligibility`** evaluated on ledger
2. If eligible on-chain, bank batch cross-reference runs against Postgres cache
3. Clearance request created only if both pass

---

## 4. Security (proposal NFRs)

| Setting | Value | Location |
|---------|-------|----------|
| JWT access token TTL | **15 minutes** | `JWT_EXPIRES_IN=15m` |
| bcrypt cost factor | **12 rounds** | `BCRYPT_ROUNDS=12` |

---

## 5. Health checks

```bash
# API
curl https://api.icu-payments.example.com/health

# Fabric gateway (on VPS)
curl https://api.icu-payments.example.com/api/health
# → fabric.connected: true when gateway + wallet OK
```

---

## 6. Local development

- **Frontend**: `cd frontend && npm run dev` (proxies `/api` → localhost:5000)
- **Backend**: `cd backend && npm run dev` (Neon or local Postgres; `BLOCKCHAIN_OPTIONAL=true` without Fabric)
- **Do not** use `vercel dev` for Fabric testing — run Express directly
