-- ICU Pay — least-privilege application DB role (run once as Supabase postgres / superuser)
-- Do NOT run from the Node app. Use Supabase SQL editor or psql as an admin.
--
-- After creating the role, point DATABASE_URL at icu_pay_app instead of postgres.

-- CREATE ROLE icu_pay_app LOGIN PASSWORD 'replace-with-strong-password';

-- GRANT CONNECT ON DATABASE postgres TO icu_pay_app;
-- GRANT USAGE ON SCHEMA public TO icu_pay_app;

-- GRANT SELECT, INSERT, UPDATE ON TABLE
--   students,
--   student_payments,
--   bank_statements,
--   bank_transactions,
--   users,
--   clearance_requests,
--   audit_logs,
--   notifications
-- TO icu_pay_app;

-- Sequences (needed for UUID defaults / serial columns if any)
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO icu_pay_app;

-- Explicitly deny destructive DDL (default for non-owner, but document intent)
-- REVOKE CREATE ON SCHEMA public FROM icu_pay_app;

-- Optional: read-only role for reporting / analytics
-- CREATE ROLE icu_pay_readonly LOGIN PASSWORD '...';
-- GRANT CONNECT ON DATABASE postgres TO icu_pay_readonly;
-- GRANT USAGE ON SCHEMA public TO icu_pay_readonly;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO icu_pay_readonly;
