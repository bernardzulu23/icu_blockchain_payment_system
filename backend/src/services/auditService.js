const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function log({ userId, userType, action, entityType, entityId, ipAddress, userAgent, details }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, user_type, action, entity_type, entity_id, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId || null,
        userType || 'system',
        action,
        entityType || null,
        entityId || null,
        ipAddress || null,
        userAgent || null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch (err) {
    logger.error('Audit log failed:', err);
  }
}

async function createAuditLog({
  user_id,
  user_type,
  action,
  entity_type,
  entity_id,
  details,
  ip_address,
  user_agent,
}) {
  return log({
    userId: user_id,
    userType: user_type,
    action,
    entityType: entity_type,
    entityId: entity_id,
    details,
    ipAddress: ip_address,
    userAgent: user_agent,
  });
}

module.exports = { log, createAuditLog };
