-- Add matching metadata to student_payments for auto-match tracking

ALTER TABLE student_payments ADD COLUMN IF NOT EXISTS matched_transaction_id UUID REFERENCES bank_transactions(transaction_id);
ALTER TABLE student_payments ADD COLUMN IF NOT EXISTS match_confidence DECIMAL(5,4);
ALTER TABLE student_payments ADD COLUMN IF NOT EXISTS manually_matched BOOLEAN DEFAULT FALSE;
