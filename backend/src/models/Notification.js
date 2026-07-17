const { pool } = require('../config/database');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

async function listForRecipient(recipientId, recipientType, queryParams = {}) {
  const { page, limit, offset } = parsePagination(queryParams);
  const { rows } = await pool.query(
    `SELECT * FROM notifications
     WHERE recipient_id = $1 AND recipient_type = $2
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [recipientId, recipientType, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND recipient_type = $2`,
    [recipientId, recipientType]
  );
  return paginatedResponse(rows, parseInt(countRows[0].count, 10), page, limit);
}

async function findById(notificationId) {
  const { rows } = await pool.query('SELECT * FROM notifications WHERE notification_id = $1', [
    notificationId,
  ]);
  return rows[0];
}

async function create({ recipientId, recipientType, notificationType, title, message, sentViaEmail, sentViaSms }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications
     (recipient_id, recipient_type, notification_type, title, message, sent_via_email, sent_via_sms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [recipientId, recipientType, notificationType, title, message, !!sentViaEmail, !!sentViaSms]
  );
  return rows[0];
}

async function markRead(notificationId) {
  const { rows } = await pool.query(
    `UPDATE notifications SET read = TRUE, read_at = NOW() WHERE notification_id = $1 RETURNING *`,
    [notificationId]
  );
  return rows[0];
}

async function markAllRead(recipientId, recipientType) {
  await pool.query(
    `UPDATE notifications SET read = TRUE, read_at = NOW()
     WHERE recipient_id = $1 AND recipient_type = $2 AND read = FALSE`,
    [recipientId, recipientType]
  );
}

async function remove(notificationId) {
  const { rowCount } = await pool.query('DELETE FROM notifications WHERE notification_id = $1', [
    notificationId,
  ]);
  return rowCount > 0;
}

module.exports = { listForRecipient, findById, create, markRead, markAllRead, remove };
