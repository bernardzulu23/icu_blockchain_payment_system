# ICU Payment Backend

Blockchain-Based Payment Reconciliation System - Backend API.

## Project Structure

```
src/
├── config/          # database, redis, blockchain, environment
├── middleware/      # auth, rbac, errorHandler, rateLimit, upload, validator
├── models/         # Student, Payment, BankStatement, User, Clearance
├── controllers/    # auth, student, payment, accountant, clearance, admin
├── services/       # blockchain, pdf, ocr, matching, notification, audit, storage
├── routes/         # auth, student, payment, accountant, clearance, admin
├── utils/          # logger, validators, helpers, constants
└── app.js          # Express app entry
```

## Quick Start

```bash
npm install
npm run dev
```

## API Routes

| Path | Description |
|------|-------------|
| POST /api/auth/login | Staff login |
| GET /api/auth/me | Current user |
| GET /api/students/check-payment | Student payment lookup (public) |
| POST /api/students | Create student (auth) |
| GET /api/payments | List payments |
| POST /api/payments | Create payment |
| POST /api/payments/:id/verify | Verify payment |
| GET /api/payments/:id/receipt | Download PDF receipt |
| POST /api/accountant/batch/verify | Batch verification |
| POST /api/clearance | Request clearance |
| GET /api/admin/stats | Admin stats |
| GET /api/admin/audit-logs | Audit logs |

## Python Services

```bash
cd python-services
pip install -r requirements.txt
python api_server.py
```

Runs on port 8000. Used for batch matching and PDF parsing.

## Scripts

- `npm run db:migrate` - Run migrations
- `npm run db:seed` - Seed admin user
