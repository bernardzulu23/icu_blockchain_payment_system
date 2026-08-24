# ICU Blockchain Payment System

**Institution:** Information and Communications University (ICU), Zambia  
**Product name:** ICU Pay  
**Purpose:** Blockchain-based student payment reconciliation that stops duplicate semester payments, automates bank-slip matching, and supports graduation / term / semester clearance.

---

## 1. Problem this system solves

At ICU Zambia, students historically queued 60–90 minutes at the accounts office with paper deposit slips. Duplicate payments for the same semester were common. Accountants matched slips against bank PDFs by hand. The registrar could not quickly prove that a student had paid all required semesters.

This system:

- Lets students submit deposit slips online (batch number + bank + amount + date).
- Blocks a second payment for the same student + semester + academic year.
- Lets accountants upload Zanaco / ABSA bank statement PDFs; the system extracts batch numbers and auto-matches student slips.
- Records verified payments immutably on **Hyperledger Fabric**.
- Lets the registrar (and students) request **Graduation**, **Term 1–3**, or **Semester 1–12** clearance from ledger + database records.

---

## 2. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend — React 18 + Vite + TypeScript + Tailwind         │
│  Student portal | Accountant | Registrar | Admin            │
└───────────────────────────┬─────────────────────────────────┘
                            │  REST JSON  (/api)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend — Node.js Express (persistent process on VPS)      │
│  JWT auth | RBAC | payments | files | clearance | audit     │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│ Supabase     │  │ Python Flask    │  │ Hyperledger Fabric   │
│ Postgres     │  │ OCR / matching  │  │ 2.5  (private ledger)│
│ Storage      │  │ (Tesseract,     │  │ Go chaincode         │
│ (icu-uploads)│  │  pdf-parse)     │  │ channel: icupayment  │
└──────────────┘  └─────────────────┘  └──────────────────────┘
```

| Layer | Technology | Host |
|-------|------------|------|
| UI | React, Vite, TypeScript, Tailwind, Lucide, react-query | VPS nginx or Cloudflare Pages |
| API | Node.js, Express, `pg`, JWT, Helmet | VPS (long-lived; not serverless) |
| Database | PostgreSQL | **Supabase** (transaction pooler port 6543) |
| Files | Supabase Storage, private bucket `icu-uploads` | Supabase |
| OCR / matching | Python 3.11, Flask, Tesseract | Same VPS as API (port 8000) |
| Ledger | Hyperledger Fabric 2.5, Raft orderer, Fabric CA | Fabric VPS |
| Chaincode | Go 1.21, `fabric-contract-api-go` | Deployed on Fabric peers |
| Email | Resend (optional) | API |
| SMS | Africa’s Talking (optional) | API |

This is **not** Ethereum, Bitcoin, or any public chain. There is no Solidity.

---

## 3. User roles

| Role | Who | What they do |
|------|-----|----------------|
| **Student** | Enrolled student | Login, profile, submit slip, payment history, request clearance, notifications, feedback |
| **Accountant** | Accounts office | Upload bank PDFs, verify / reject payments, batch OCR reconciliation, bulk status, mass clearance |
| **Registrar** | Academic registry | Clearance dashboard, mass clearance |
| **Admin** | System admin | Students, staff, register accountant, audit logs, feedback inbox, stats |

RBAC is enforced on the API (`requireRole` / `requireStudent`) and in the React router (`RoleRoute`).

---

## 4. Domain rules

### Banks

Only two banks are accepted:

- **Zanaco Bank** (OCR template id `zanaco`)
- **ABSA Bank** (OCR template id `absa`)

Names are normalized (`zanaco` → `Zanaco Bank`). The UI uses original geometric SVG marks (not official bank trademarks):

- `/assets/bank-zanaco.svg` — green circular Z
- `/assets/bank-absa.svg` — red rectangular A

Bank picker cards are used on Submit Payment, Upload Statement, and Batch Reconciliation.

### Academic year

Stored as a span `YYYY-YYYY` (e.g. `2025-2026`). Calendar date maps to an **August–July** cycle. Allowed range: **2000–2099**.

### Clearance types

- Graduation
- Term 1, Term 2, Term 3
- Semester 1 … Semester 12  
Transfer clearance is **not** supported.

### Payment statuses

`pending` → `auto_matched` or `manual_review` → `verified` or `rejected`

Duplicate constraint: unique `(student_id, semester, academic_year)`.

### Brand

- App title: **ICU Pay**
- Vector crest: `/assets/icu-logo.svg` (navy `#1e3a5f`, gold `#e8b923`)
- Favicon matches the crest
- UI style: brutalist (ink borders, paper background, dark mode)

---

## 5. Features by role

### Students

- Unified login (email, student number, or employee ID — students use email / student number)
- Password reset (email token)
- Profile + profile picture
- Submit payment: semester, academic year (date picker → span), amount (ZMW), batch number, bank (Zanaco/ABSA cards), payment date, deposit slip (JPG/PNG/PDF)
- Duplicate check before submit (`GET /api/payments/check-duplicate`)
- Payment history; download receipts / statements
- Request Graduation / Term / Semester clearance
- Notifications
- Feedback

### Accountants

- Dashboard with verification shortcuts
- Upload bank statement PDF (Zanaco or ABSA)
- Background processing: extract transactions, match batch number + amount to pending slips
- Verification queue: approve, reject, view slip
- Bulk verify auto-matched payments
- OCR batch reconciliation (statement PDF + many slip images → Merkle root on Fabric on approve)
- Bank statements list
- Mass clearance
- Bulk payment status lookup (student numbers)

### Registrar

- Clearance overview
- Mass clearance
- Eligibility from database and, when Fabric is up, chaincode `CheckClearanceEligibility`

### Admin

- Register students (email + password required)
- Register accountants (full name, auto Employee ID `ACC-YYYY-####`, email, password, address, DOB)
- Staff CRUD
- Students CRUD
- Audit logs
- Feedback list
- Stats

---

## 6. Frontend

**Path:** `frontend/`  
**Stack:** React 18, Vite 5, TypeScript, Tailwind 3, React Router 6, react-query, react-hook-form, axios, lucide-react, recharts, react-toastify

**Dev:** `cd frontend && npm run dev` → typically `http://localhost:5173`  
**API:** `VITE_API_URL` (local default `http://localhost:5000/api`)

### Public routes

| Path | Page |
|------|------|
| `/login` | Unified login |
| `/forgot-password` | Request reset |
| `/reset-password/:token` | Set new password |
| `/student` | Public payment-status check (student number + reference) |

### Student portal (`/student-portal`, role `student`)

| Path | Page |
|------|------|
| `/student-portal` | Dashboard |
| `/student-portal/profile` | Profile |
| `/student-portal/payments` | My payments |
| `/student-portal/submit-payment` | Submit slip |
| `/student-portal/clearance` | Clearance |
| `/student-portal/notifications` | Notifications |
| `/student-portal/feedback` | Feedback |

### Accountant (`/accountant`)

| Path | Page |
|------|------|
| `/accountant` | Dashboard |
| `/accountant/verification` | Verify payments |
| `/accountant/upload-statement` | Upload bank PDF |
| `/accountant/bank-statements` | Statement list |
| `/accountant/batch-reconciliation` | OCR batch + Merkle approve |
| `/accountant/mass-clearance` | Mass clearance |
| `/accountant/bulk-payment-status` | Bulk status |

### Registrar / Admin

| Path | Page |
|------|------|
| `/registrar` | Registrar dashboard |
| `/admin` | Admin hub |
| `/admin/dashboard` | Stats |
| `/admin/students` | Students |
| `/admin/staff` | Staff |
| `/admin/register-student` | Register student |
| `/admin/register-accountant` | Register accountant |
| `/admin/audit-logs` | Audit |
| `/admin/feedback` | Feedback inbox |

Shared components include `Layout` (sidebar + BrandLogo), `BrandLogo`, `BankMark`, `BankPicker`, `RoleRoute`, `LoadingSpinner` (percentage bar), `Modal`, authenticated file URLs (`getAuthenticatedFileUrl` for `sb:` storage refs).

---

## 7. Backend API

**Path:** `backend/`  
**Entry:** `backend/src/app.js` → `createApp.js`  
**Port:** `5000`  
**Health:** `GET /health` (includes Fabric connectivity)

### Auth

- `POST /api/auth/login` — unified: try staff, then student (identifier = email / username / student number / employee ID)
- `POST /api/auth/login/staff`
- `POST /api/auth/login/student`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/:token`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

JWT access (~15m) + refresh token. Role is loaded from the database, not trusted from the client. Production requires strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (≥ 32 chars).

### Students

- `GET /api/students/check-payment` — public lookup
- `GET/PUT /api/students/profile` — student self
- `GET/POST/PUT/DELETE /api/students` — staff CRUD (admin)

### Payments

- `POST /api/payments/submit` — student slip upload
- `GET /api/payments/my`
- `GET /api/payments/check-duplicate`
- `GET /api/payments/:id/receipt`
- CRUD `/api/payments` for staff

### Accountant

- `POST /api/accountant/bank-statement`
- `GET /api/accountant/bank-statements`
- `GET /api/accountant/pending-payments`
- `POST /api/accountant/verify/:id`
- `POST /api/accountant/bulk-verify`
- `GET /api/accountant/stats`
- `POST /api/accountant/bulk-payment-status`
- `POST /api/accountant/batch/verify`
- `POST /api/accountant/batch/reconcile`
- `GET /api/accountant/batch/reconcile/:batchId`
- `POST /api/accountant/batch/reconcile/:batchId/approve`

### Clearance / admin / files / other

- `POST /api/clearance/request`, `GET /api/clearance/mine`, staff clearance routes
- `GET /api/admin/stats`, `GET /api/admin/audit-logs`
- `GET /api/files/*` — authenticated file download (local path or `sb:bucket/path`)
- Feedback, users, notifications

CORS is locked to `FRONTEND_URL` / `FRONTEND_URLS`. Rate limits on `/api/` and auth. Helmet. Uploads go to memory when Supabase is configured, then to Storage.

---

## 8. Database (Supabase Postgres)

Migrations live in `backend/migrations/` and run with `npm run db:migrate` (uses **direct / session** URL on port 5432, not the transaction pooler).

| File | Purpose |
|------|---------|
| `001_schema.sql` | Core tables |
| `002_seed.sql` | Default admin |
| `003_student_profile_fields.sql` | Extra student fields |
| `004_matching_columns.sql` | Matching helpers |
| `005_feedback.sql` | Feedback |
| `006_password_reset.sql` | Reset tokens |
| `007_batch_reconciliation.sql` | OCR batch / Merkle |
| `008_user_officer_fields.sql` | `employee_id`, address, DOB |

### Main tables

- `students` — student_id, student_number, names, email, password_hash, program, semester/term, profile picture
- `student_payments` — amount, batch_number, bank_name, status, `blockchain_tx_id`, slip URL, unique (student, semester, year)
- `bank_statements` — PDF URL, processed flags, match counts
- `bank_transactions` — extracted rows linked to a statement
- `users` — staff (admin / accountant / registrar), employee_id
- `clearance_requests` — type, status, certificate URL
- `audit_logs`
- `notifications`
- `feedback`
- password-reset tokens, batch reconciliation tables (007)

**Seed admin (change immediately):**

- Username: `admin`
- Email: `admin@icu.edu.zm`
- Password: `admin123`

---

## 9. File storage

When `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set:

1. Files upload to private bucket **`icu-uploads`**.
2. DB stores a ref like `sb:icu-uploads/deposit-slips/….jpg`.
3. Browser never talks to Supabase with the service role. It calls `/api/files/_sb/...` with a JWT.
4. Students may only fetch their own slips / certificates / photos.

Without Supabase keys, files are stored under local `uploads/` (dev).

OCR for `sb:` refs: the accountant processor downloads the object and writes a temp PDF for the Python service.

---

## 10. Python matching / OCR

**Path:** `backend/python-services/`  
**Run:** `python api_server.py` (port **8000**)

Typical endpoints:

- `/extract-transactions` — parse bank PDF (Zanaco / ABSA templates)
- `/match-payments` — match extracted rows to pending student payments
- OCR pipeline for batch reconciliation (Tesseract + templates)

The Node API calls this when `PYTHON_SERVICE_URL` is set; otherwise it falls back to `pdf-parse` + local matching.

---

## 11. Blockchain (Hyperledger Fabric)

**Not a public cryptocurrency.** Private permissioned network for ICU.

### Network

| Item | Value |
|------|--------|
| Platform | Hyperledger Fabric **2.5** |
| Images | `fabric-peer:2.5`, `fabric-orderer:2.5`, `fabric-ca:2.5` |
| Channel | `icupaymentchannel` |
| Chaincode name | `reconciliation-chaincode` |
| Consensus | Raft (single-node orderer) |
| Identity | Fabric CA |
| Org1MSP | ICU Accounts (accountants) |
| Org2MSP | ICU Registrar |
| Base | stock `fabric-samples/test-network` (`network.sh` not forked) |

### Chaincode (Go)

File: `blockchain/chaincode/reconciliation_chaincode.go`

| Function | Role |
|----------|------|
| `MatchPayment` | Write verified payment if hash and student+semester are new; emit `PaymentVerified` |
| `GetStudentPaymentHistory` | Range query by student, ordered by semester |
| `CheckClearanceEligibility` | Semesters 1..N paid? + missing list |
| `SubmitBatchRoot` | One Merkle root per OCR batch (1 Fabric tx vs N payments) |
| `RecordPayment`, `GetAllPayments`, `QueryPayment` | Legacy wrappers for the Node backend |

Ledger objects: `Payment` (paymentHash, studentID, amount, semester, batchNumber, txId) and `BatchRoot` (batchId, merkleRoot, paymentCount).

Tests: `cd blockchain/chaincode && go test ./...`

### Node SDK

`fabric-network` **v2.2** in `backend/src/services/fabricGateway.js`.

Env:

```
FABRIC_CONNECTION_PROFILE=.../connection-profile.json
FABRIC_WALLET_PATH=.../blockchain/wallet
FABRIC_CHANNEL=icupaymentchannel
FABRIC_CHAINCODE=reconciliation-chaincode
FABRIC_IDENTITY=accountantAdmin
BLOCKCHAIN_OPTIONAL=true|false
```

**Flow after accountant verifies a payment:**

1. API updates Postgres to `verified`.
2. SDK invokes chaincode (`MatchPayment` / `RecordPayment`).
3. Fabric returns a transaction ID.
4. API stores `blockchain_tx_id` on `student_payments`.
5. Student can download a statement that includes that TX id.

If Fabric is down and `BLOCKCHAIN_OPTIONAL=true`, verification still completes in Postgres.

Fabric **cannot** run on serverless (needs long-lived gRPC). Deploy the Express API on a VPS next to (or able to reach) the peers.

---

## 12. Security

- JWT fail-closed in production; refresh tokens typed; role from DB
- CORS allow-list (`FRONTEND_URL`)
- Helmet, rate limits, `trust proxy` in production
- Parameterized SQL (`pg`)
- Upload MIME/size checks; no public `/uploads` in production
- Authenticated `/api/files` with student ownership checks
- Service role key **never** in the frontend
- Bcrypt (12 rounds)
- Scrubbed error messages in production
- Default admin password must be changed

---

## 13. Local development

Prerequisites: Node 20+, Python 3.11+, Docker (optional Postgres), Go 1.21+ for chaincode.

```bash
# Database (Supabase URLs in backend/.env, or local Postgres)
cd backend
npm install
npm run db:migrate
npm run db:seed
npm run dev

# Frontend
cd frontend
npm install
npm run dev

# OCR (optional)
cd backend/python-services
pip install -r requirements.txt
python api_server.py
```

Docker: `docker-compose up` (app + Postgres). Fabric: `docker-compose --profile blockchain up`.

Frontend: `http://localhost:5173`  
API: `http://localhost:5000`  
Health: `http://localhost:5000/health`

---

## 14. Production deployment

Documented in `docs/DEPLOYMENT.md`.

1. Create a **Supabase** project.
2. Set on the API:
   - `DATABASE_URL` — transaction pooler (`:6543`)
   - `DATABASE_DIRECT_URL` — session/direct (`:5432`)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=icu-uploads`
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`
   - `FRONTEND_URL`
3. `cd backend && npm run db:migrate && npm run db:seed`
4. Run Express (+ Python OCR) on a VPS; TLS via nginx.
5. Build frontend with `VITE_API_URL=https://api.your-domain.example/api` and serve `dist/` (nginx / Cloudflare Pages). **Not Vercel.**
6. Provision Fabric on the Fabric VPS; import wallet identity; set `BLOCKCHAIN_OPTIONAL=false` when ready.

---

## 15. Environment variables (API)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase pooled Postgres |
| `DATABASE_DIRECT_URL` | Migrations |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage + admin (server only) |
| `SUPABASE_STORAGE_BUCKET` | Default `icu-uploads` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Auth |
| `FRONTEND_URL` | CORS origin |
| `PYTHON_SERVICE_URL` | Flask OCR (`http://127.0.0.1:8000`) |
| `API_PUBLIC_URL` | Public API base for OCR callbacks |
| `FABRIC_*` | Connection profile, wallet, channel, chaincode, identity |
| `BLOCKCHAIN_OPTIONAL` | Allow API without Fabric |
| `REDIS_ENABLED` | Optional Redis |
| `RESEND_API_KEY` | Email |
| `AFRICASTALKING_*` | SMS |

Frontend: `VITE_API_URL` only (build-time).

---

## 16. Repository layout

```
ICU-Blockchain-Payment-System/
├── frontend/                 React + Vite UI
│   ├── public/assets/        icu-logo.svg, bank-zanaco.svg, bank-absa.svg
│   └── src/pages/            student | accountant | admin | registrar
├── backend/
│   ├── src/                  Express API
│   ├── migrations/           001–008 SQL
│   ├── python-services/      Flask OCR / matching
│   └── scripts/              migrate.js, seed.js
├── blockchain/
│   ├── chaincode/            Go reconciliation chaincode + tests
│   ├── network/              connection profile, org-mapping.json
│   └── scripts/              VPS provision, deploy chaincode
├── docs/DEPLOYMENT.md
├── docker-compose.yml
├── docker-compose.prod.yml
└── project.md                this file
```

GitHub: `https://github.com/bernardzulu23/icu_blockchain_payment_system`

---

## 17. Default credentials (development only)

| User | Login | Password |
|------|--------|----------|
| Admin | `admin` or `admin@icu.edu.zm` | `admin123` |

Change after first login. Do not use these in production.

---

## 18. License

Copyright (c) Information and Communications University, Zambia. All rights reserved.

---

## 19. One-sentence summary

ICU Pay is a private Hyperledger Fabric + Supabase system that lets ICU Zambia students submit Zanaco/ABSA deposit slips, accountants auto-match them to bank PDFs, and the registrar clear students against an immutable payment ledger.
