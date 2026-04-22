-- =====================================================
-- COMPLETE DATABASE SCHEMA FOR ICU PAYMENT SYSTEM
-- =====================================================

-- Table 1: Students
CREATE TABLE IF NOT EXISTS students (
    student_id VARCHAR(20) PRIMARY KEY,
    student_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(200) UNIQUE,
    phone VARCHAR(20),
    program VARCHAR(100),
    department VARCHAR(100),
    admission_year INTEGER,
    expected_graduation_year INTEGER,
    date_of_birth DATE,
    current_semester INTEGER CHECK (current_semester IS NULL OR (current_semester >= 1 AND current_semester <= 12)),
    current_term INTEGER CHECK (current_term IS NULL OR (current_term >= 1 AND current_term <= 3)),
    profile_picture_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'suspended')),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table 2: Student Payments
CREATE TABLE IF NOT EXISTS student_payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id),
    semester VARCHAR(20) NOT NULL,
    academic_year VARCHAR(10) NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    batch_number VARCHAR(50) NOT NULL,
    bank_name VARCHAR(100),
    payment_date DATE NOT NULL,
    deposit_slip_url VARCHAR(500),

    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'auto_matched', 'manual_review', 'verified', 'rejected')),
    matched_with_bank BOOLEAN DEFAULT FALSE,

    -- Blockchain reference
    blockchain_tx_id VARCHAR(200),
    verified_date TIMESTAMP,
    verified_by VARCHAR(100),

    -- Generated documents
    statement_pdf_url VARCHAR(500),
    statement_pdf_hash VARCHAR(64),

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Prevent duplicate payments for same semester
    UNIQUE(student_id, semester, academic_year)
);

-- Table 3: Bank Statements
CREATE TABLE IF NOT EXISTS bank_statements (
    statement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_date DATE NOT NULL,
    bank_name VARCHAR(100),
    statement_pdf_url VARCHAR(500) NOT NULL,
    uploaded_by VARCHAR(100) NOT NULL,

    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    total_transactions INTEGER DEFAULT 0,
    matched_count INTEGER DEFAULT 0,
    unmatched_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 4: Bank Transactions (extracted from bank statements)
CREATE TABLE IF NOT EXISTS bank_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID REFERENCES bank_statements(statement_id) ON DELETE CASCADE,

    batch_number VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    transaction_date DATE NOT NULL,
    depositor_name VARCHAR(200),

    -- Matching status
    matched_with_student BOOLEAN DEFAULT FALSE,
    matched_payment_id UUID REFERENCES student_payments(payment_id),

    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 5: Users (accountants, admins, registrar)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('accountant', 'registrar', 'admin')),
    full_name VARCHAR(200) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- Table 6: Clearance Requests
CREATE TABLE IF NOT EXISTS clearance_requests (
    clearance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id),
    clearance_type VARCHAR(50) DEFAULT 'graduation',

    -- Calculated from blockchain
    total_semesters_expected INTEGER,
    total_semesters_paid INTEGER,
    missing_semesters TEXT[],

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'requires_payment')),
    requested_date TIMESTAMP DEFAULT NOW(),
    approved_date TIMESTAMP,
    approved_by VARCHAR(100),
    rejection_reason TEXT,

    -- Generated certificate
    clearance_certificate_url VARCHAR(500)
);

-- Table 7: Audit Logs (forensic trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(50),
    user_type VARCHAR(20) CHECK (user_type IN ('student', 'accountant', 'admin', 'registrar', 'system')),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(200),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Table 8: Notifications
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id VARCHAR(20) NOT NULL,
    recipient_type VARCHAR(20) CHECK (recipient_type IN ('student', 'user')),
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    -- Delivery channels
    sent_via_email BOOLEAN DEFAULT FALSE,
    sent_via_sms BOOLEAN DEFAULT FALSE,

    -- Status
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_payments_batch ON student_payments(batch_number);
CREATE INDEX IF NOT EXISTS idx_payments_student ON student_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON student_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_semester ON student_payments(semester, academic_year);
CREATE INDEX IF NOT EXISTS idx_bank_txn_batch ON bank_transactions(batch_number);
CREATE INDEX IF NOT EXISTS idx_bank_txn_statement ON bank_transactions(statement_id);
CREATE INDEX IF NOT EXISTS idx_clearance_student ON clearance_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_clearance_status ON clearance_requests(status);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, recipient_type);

-- =====================================================
-- PASSWORD RESET
-- =====================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP;

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash ON users (reset_token_hash);
CREATE INDEX IF NOT EXISTS idx_students_reset_token_hash ON students (reset_token_hash);

-- =====================================================
-- SEED DATA
-- =====================================================

INSERT INTO users (username, email, password_hash, role, full_name, status)
SELECT 'admin', 'admin@icu.edu.zm', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lW3J3z.pMQ3u', 'admin', 'System Administrator', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@icu.edu.zm');
