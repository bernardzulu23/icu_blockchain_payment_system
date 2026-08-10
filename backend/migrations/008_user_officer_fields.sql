-- Staff/accountant profile fields for officer accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS residential_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id
  ON users (employee_id)
  WHERE employee_id IS NOT NULL;

-- Backfill employee_id from username where missing (existing staff)
UPDATE users
SET employee_id = username
WHERE employee_id IS NULL;
