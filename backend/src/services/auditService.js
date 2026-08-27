const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { logAuditEvent } = require('../utils/db-safe-queries');

async function log({ userId, userType, action, entityType, entityId, ipAddress, userAgent, details }) {
  try {
    await logAuditEvent(null, {
      actorId: userId,
      actorType: userType,
      action,
      targetTable: entityType,
      targetId: entityId,
      metadata: details,
      ipAddress,
      userAgent,
    });
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

/** Transaction-safe audit write — pass an open pg client from BEGIN…COMMIT. */
async function createAuditLogTx(client, fields) {
  return logAuditEvent(client, {
    actorId: fields.user_id,
    actorType: fields.user_type,
    action: fields.action,
    targetTable: fields.entity_type,
    targetId: fields.entity_id,
    metadata: fields.details,
    ipAddress: fields.ip_address,
    userAgent: fields.user_agent,
  });
}

module.exports = { log, createAuditLog, createAuditLogTx };
