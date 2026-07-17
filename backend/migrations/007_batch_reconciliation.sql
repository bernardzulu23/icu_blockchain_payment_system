-- Batch OCR reconciliation runs (preview + committed) with timing metrics
CREATE TABLE IF NOT EXISTS batch_reconciliation_runs (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID REFERENCES bank_statements(statement_id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'preview'
        CHECK (status IN ('preview', 'committed', 'cancelled')),
    merkle_root VARCHAR(64),
    payment_count INTEGER DEFAULT 0,
    blockchain_tx_id VARCHAR(200),
    processing_ms INTEGER,
    manual_flag_rate DECIMAL(5,4),
    ocr_results JSONB,
    match_results JSONB,
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batch_recon_status ON batch_reconciliation_runs(status);
CREATE INDEX IF NOT EXISTS idx_batch_recon_created ON batch_reconciliation_runs(created_at DESC);
