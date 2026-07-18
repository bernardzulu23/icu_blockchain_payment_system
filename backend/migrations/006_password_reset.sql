ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_reset_token_hash ON users (reset_token_hash);
CREATE INDEX IF NOT EXISTS idx_students_reset_token_hash ON students (reset_token_hash);
