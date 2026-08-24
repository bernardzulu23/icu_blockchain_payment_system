-- tamper-demo.sql
-- -----------------
-- Live defence demo: simulate an insider (compromised admin/DBA, or a rogue
-- accountant with DB access) directly tampering with a verified payment in
-- Postgres — bypassing the Express API entirely. Then use verify-chain.js to
-- show the tamper is detected independently of the application.
--
-- RUN THIS AGAINST A DEMO/STAGING DATABASE. Do not run against production.
-- Note the payment_id / original amount so you can restore it (Step 4)
-- before the panel leaves. The reveal should be deliberate.
--
-- Schema notes (backend/migrations/001_schema.sql):
--   PK is payment_id (UUID), not id.
--   blockchain_tx_id stores the MatchPayment paymentHash (sha256 of
--   studentId|amount|semester|batchNumber), not a Fabric block number.
--   academic_year and bank_name are Postgres-only; they are NOT on-chain.
--   Direct SQL does NOT write audit_logs (app-level only).

-- ============================================================
-- STEP 0 — Before the demo: pick a real verified payment.
-- Note payment_id, student_id, semester, amount, batch_number, blockchain_tx_id.
-- ============================================================
SELECT
  payment_id,
  student_id,
  semester,
  academic_year,
  amount,
  batch_number,
  bank_name,
  status,
  blockchain_tx_id,
  verified_date
FROM student_payments
WHERE status = 'verified'
  AND blockchain_tx_id IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;

-- Replace the placeholders below with one row from Step 0.
-- Example: payment_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
--          original amount = 5000.00


-- ============================================================
-- STEP 1 — During the demo: show the record looks normal.
-- ============================================================
SELECT payment_id, student_id, semester, amount, batch_number, blockchain_tx_id, status
FROM student_payments
WHERE payment_id = '<PAYMENT_ID>';

-- Talking point: "This is what the registrar and the accountant see when
-- they check this student. It looks fine — nothing in the UI or Postgres
-- alone tells you whether this number is trustworthy."


-- ============================================================
-- STEP 2 — THE TAMPER: alter the amount, bypassing the API,
-- RBAC, and audit_logs. This is a DBA-level insider on Postgres alone.
-- amount is DECIMAL(10,2) CHECK (amount > 0); 999999.00 is valid.
-- ============================================================
UPDATE student_payments
SET amount = 999999.00,
    updated_at = NOW()
WHERE payment_id = '<PAYMENT_ID>';

-- Confirm the row now shows the tampered value; blockchain_tx_id unchanged:
SELECT payment_id, student_id, semester, amount, batch_number, blockchain_tx_id, status
FROM student_payments
WHERE payment_id = '<PAYMENT_ID>';

-- Talking point: "I just changed this student's paid amount directly in
-- the database. Nothing in Postgres flags this. Now we check the ledger
-- independently of this database and this application."


-- ============================================================
-- STEP 3 — Independent verification (separate terminal, on the Fabric VPS).
--
-- From backend/ (uses its own gateway; does not read Postgres):
--
--   node scripts/verify-chain.js \
--     --student <STUDENT_ID> \
--     --semester <SEMESTER> \
--     --amount 999999.00 \
--     --batchNumber <BATCH_NUMBER>
--
-- Do NOT pass --academicYear expecting an on-chain filter; it is not stored
-- on the Payment object. Hash is sha256(studentId|amount|semester|batchNumber).
--
-- Expected: RESULT: MISMATCH — the hash from the tampered amount will not
-- match paymentHash on-chain, because the ledger copy is untouched.
--
-- Optional control: re-run with the ORIGINAL amount (e.g. 5000) and the
-- same student/semester/batch — that should MATCH, proving the ledger
-- still has the verified values.
-- ============================================================


-- ============================================================
-- STEP 4 — RESTORE immediately after the demo.
-- ============================================================
UPDATE student_payments
SET amount = 5000.00,   -- replace with the ORIGINAL value from Step 0
    updated_at = NOW()
WHERE payment_id = '<PAYMENT_ID>';

SELECT payment_id, student_id, amount, batch_number, blockchain_tx_id, status
FROM student_payments
WHERE payment_id = '<PAYMENT_ID>';

-- Direct SQL never hits audit_logs. Optional: record the demo so the trail
-- does not have an unexplained amount swing.
INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, details)
VALUES (
  'defence-demo',
  'system',
  'TAMPER_DEMO_RESTORE',
  'student_payments',
  '<PAYMENT_ID>',
  jsonb_build_object(
    'note', 'Restored amount after live insider-tamper defence demo',
    'restored_amount', 5000.00
  )
);
