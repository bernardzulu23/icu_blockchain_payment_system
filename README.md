# ICU Blockchain Payment System

A comprehensive blockchain-based payment reconciliation system for **Information and Communications University (ICU) Zambia** that eliminates duplicate payments and automates verification.

## 🚀 Key Features

### For Students
- **Upload Payment Proof**: Submit deposit slips with batch numbers
- **Duplicate Prevention**: System prevents paying twice for the same semester
- **Real-time Status**: Track payment verification status
- **Download Statements**: Get blockchain-verified payment statements (valid 20+ years)
- **No More Queues**: Eliminate 60-90 minute waits at accounts office

### For Accountants
- **Automated Matching**: Upload bank statement → System automatically matches 50+ payments
- **Bulk Verification**: Verify multiple payments in one click
- **Blockchain Recording**: Every verified payment stored immutably on Hyperledger Fabric
- **Audit Trail**: Complete forensic history of all transactions

### For Registrar
- **Automated Clearance**: Check student payment status for graduation
- **Blockchain Verification**: Instant verification from immutable records
- **Missing Payment Detection**: Identify unpaid semesters automatically

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND (React/Vite)                  │
│  Student Portal | Accountant Dashboard | Registrar Interface │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js)                     │
│  Authentication | Payment Management | File Uploads          │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────┐          ┌──────────────────────────┐
│  PostgreSQL Database │          │ Python Matching Service  │
│  Student Records     │          │ PDF Parsing (Flask)       │
│  Payment History     │          │ Fuzzy Matching           │
└──────────────────────┘          └──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│           BLOCKCHAIN (Hyperledger Fabric)                    │
│  Immutable Payment Records | Smart Contracts (Go)            │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 20+ (for local development)
- Python 3.11+ (for local development)
- Go 1.21+ (for blockchain development)
- 4GB RAM minimum
- 20GB disk space

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/icu-zambia/blockchain-payment-system.git
cd blockchain-payment-system
```

### 2. Deploy with Docker (Recommended)

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

This will:
- Create `.env` configuration
- Set up PostgreSQL database
- Start all services (Backend, Frontend, Python)
- Initialize the system

### 3. Access the System

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

### Default Credentials

**Admin User**
- Username: `admin`
- Password: `admin123`
- ⚠️ **CHANGE IMMEDIATELY AFTER FIRST LOGIN**

## 📁 Project Structure

```
ICU-Blockchain-Payment-System/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── config/             # Database, Redis, Blockchain config
│   │   ├── controllers/        # Request handlers
│   │   ├── middleware/         # Auth, validation, error handling
│   │   ├── models/             # Data models
│   │   ├── routes/             # API endpoints
│   │   ├── services/           # Business logic
│   │   └── utils/              # Helpers
│   ├── python-services/        # Batch Matching Service (Flask)
│   │   ├── api_server.py       # Flask API (extract, match)
│   │   ├── batch_matching.py   # CSV matching
│   │   ├── batch_matching_service.py
│   │   └── Dockerfile
│   ├── blockchain/             # Chaincode
│   │   └── chaincode/
│   │       └── payment-contract.go
│   ├── migrations/             # DB migrations
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── contexts/          # Auth, Theme
│   │   ├── pages/             # Page components
│   │   └── api/               # API client
│   ├── Dockerfile
│   ├── Dockerfile.prod         # Production (nginx)
│   └── package.json
│
├── blockchain/                 # Hyperledger Fabric config
│   ├── chaincode/
│   ├── crypto-config/
│   └── channel-artifacts/
│
├── database/
│   └── schema.sql             # PostgreSQL schema + seed
│
├── scripts/
│   └── deploy.sh              # Deployment script
│
├── docker-compose.yml         # Docker orchestration
├── .env.example               # Environment template
└── README.md
```

## 🔧 Configuration

### Environment Variables

Create `.env` file in project root:

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=icu_payments
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# URLs
FRONTEND_URL=http://localhost:3000
VITE_API_URL=

# Services
NODE_ENV=production
PORT=5000
PYTHON_SERVICE_URL=http://python-service:8000
PYTHON_SERVICE_PORT=8000
```

## 📊 Database Schema

Key tables:
- `students` - Student information
- `student_payments` - Payment records with blockchain_tx_id
- `bank_statements` - Uploaded bank statements
- `bank_transactions` - Extracted transactions for matching
- `users` - Accountant/admin accounts
- `clearance_requests` - Graduation clearance requests
- `audit_logs` - Complete audit trail
- `notifications` - SMS/email delivery tracking

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/login` - Staff login (email/password)
- `POST /api/auth/login/staff` - Staff login (username/password)
- `POST /api/auth/login/student` - Student login
- `POST /api/auth/register/student` - Student registration
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Current user

### Student Endpoints
- `POST /api/payments/submit` - Submit payment with deposit slip
- `GET /api/payments/my` - Payment history
- `GET /api/payments/check-duplicate` - Check duplicate payment
- `GET /api/payments/:id/statement` - Download statement

### Accountant Endpoints
- `POST /api/accountant/bank-statement` - Upload bank statement
- `GET /api/accountant/pending-payments` - Get pending payments
- `POST /api/accountant/verify/:id` - Verify single payment
- `POST /api/accountant/bulk-verify` - Bulk verify payments
- `GET /api/accountant/stats` - Verification statistics
- `POST /api/accountant/batch/verify` - Batch verify (CSV + PDF)

### Registrar Endpoints
- `POST /api/clearance` - Request clearance
- `GET /api/clearance/student/:studentId` - Get clearance by student

## 🔗 Blockchain Integration

### Smart Contract Functions

```go
// Record verified payment on blockchain
RecordPayment(paymentID, studentID, studentNumber, semester, academicYear, amount, batchNumber, bankName, paymentDate, verifiedBy)

// Query student's payment history
GetStudentPayments(studentID)

// Verify payment exists
VerifyPayment(studentID, semester, academicYear)

// Get complete audit trail
GetPaymentHistory(paymentID)
```

### Blockchain Transaction Flow

1. Accountant verifies payment in system
2. Backend calls `RecordPayment()` smart contract
3. Transaction recorded immutably on Hyperledger Fabric
4. Blockchain returns transaction ID
5. System stores transaction ID with payment record
6. Student receives verification notification

## 🧪 Local Development

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Python Service
```bash
cd backend/python-services
pip install -r requirements.txt
python api_server.py
```

### Database & Redis
```bash
docker-compose up -d postgres redis
```

## 🔍 Monitoring

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f python-service
```

### Service Health
```bash
# Check running containers
docker compose ps

# Health checks
curl http://localhost:5000/health
curl http://localhost:8000/health
```

## 🛠️ Troubleshooting

### Database Connection Issues
```bash
docker compose restart postgres
docker compose logs postgres
```

### Python Service Not Matching
```bash
docker compose restart python-service
docker compose logs python-service
```

### Blockchain Network (optional profile)
```bash
docker compose --profile blockchain up -d
```

## 🔒 Security Considerations

1. **Change Default Passwords**: Update admin password immediately
2. **JWT Secret**: Use strong random secret in production
3. **HTTPS**: Enable SSL/TLS in production
4. **Rate Limiting**: Implemented in backend
5. **Input Validation**: All inputs validated
6. **File Upload**: 5MB limit, PDF/JPG/PNG only
7. **SQL Injection**: Parameterized queries
8. **XSS Protection**: React auto-escapes, Helmet.js enabled

## 📈 Performance

- **Automated Matching**: Processes 50+ payments in under 2 minutes
- **Blockchain Write**: Average 3-5 seconds per transaction
- **API Response**: <100ms for most endpoints
- **File Upload**: Supports up to 5MB files

## 🚀 Production Deployment

### Production Checklist
- [ ] Change all default passwords
- [ ] Configure SSL/TLS certificates
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Enable firewall rules
- [ ] Set up log aggregation
- [ ] Test disaster recovery

## 📄 License

Copyright (c) 2024 Information and Communications University, Zambia.
All rights reserved.

---

**Built with ❤️ for ICU Zambia**
