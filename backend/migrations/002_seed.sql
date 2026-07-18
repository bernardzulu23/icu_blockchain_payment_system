-- =====================================================
-- SEED DATA - Run only if tables are empty
-- =====================================================

-- Initial admin user (password: admin123 - change immediately)
INSERT INTO users (username, email, password_hash, role, full_name, status)
SELECT 'admin', 'admin@icu.edu.zm', '$2b$10$mNrWK23pxqPQaz/rV8n3eeIhy0OaRsL8C3luVK2ub6g4BN8auv3jO', 'admin', 'System Administrator', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@icu.edu.zm');
