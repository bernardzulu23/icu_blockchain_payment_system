-- =====================================================
-- SEED DATA - Run only if tables are empty
-- =====================================================

-- Initial admin user (password: admin123 - change immediately)
INSERT INTO users (username, email, password_hash, role, full_name, status)
SELECT 'admin', 'admin@icu.edu.zm', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5lW3J3z.pMQ3u', 'admin', 'System Administrator', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@icu.edu.zm');
