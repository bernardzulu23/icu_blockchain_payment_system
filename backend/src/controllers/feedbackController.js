const { query, getClient } = require('../config/database');
const logger = require('../utils/logger');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

async function submitFeedback(req, res) {
  try {
    const { role } = req.user;

    if (role === 'admin') {
      return res.status(403).json({
        error: 'Admins cannot submit feedback',
        message: 'Only students, accountants, and registrars can provide feedback.',
      });
    }

    if (!['student', 'accountant', 'registrar'].includes(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { message, rating } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const user_id = req.user.userId || req.user.user_id || req.user.student_id || String(req.user.id || '');
    const user_name =
      req.user.full_name ||
      req.user.name ||
      (req.user.first_name && req.user.last_name
        ? `${req.user.first_name} ${req.user.last_name}`
        : req.user.email || 'Anonymous');

    const result = await query(
      `INSERT INTO feedback (user_id, user_type, user_name, message, rating)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING feedback_id, user_id, user_type, user_name, message, rating, created_at`,
      [user_id, role, user_name, message.trim(), rating != null && rating >= 1 && rating <= 5 ? rating : null]
    );

    logger.info(`Feedback submitted by ${role} ${user_id}`);
    res.status(201).json({ success: true, message: 'Thank you for your feedback!', feedback: result.rows[0] });
  } catch (error) {
    logger.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback', message: error.message });
  }
}

async function getAllFeedback(req, res) {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const result = await query(
      `SELECT feedback_id, user_id, user_type, user_name, message, rating, created_at
       FROM feedback ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const { rows: countRows } = await query('SELECT COUNT(*) FROM feedback');
    res.json(paginatedResponse(result.rows, parseInt(countRows[0].count, 10), page, limit));
  } catch (error) {
    logger.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback', message: error.message });
  }
}

async function getMyFeedback(req, res) {
  try {
    const user_id = req.user.userId || req.user.user_id || req.user.student_id;
    const { rows } = await query(
      `SELECT feedback_id, user_id, user_type, user_name, message, rating, created_at
       FROM feedback WHERE user_id = $1 ORDER BY created_at DESC`,
      [user_id]
    );
    res.json({ items: rows, total: rows.length });
  } catch (error) {
    logger.error('Get my feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
}

async function getById(req, res) {
  try {
    const { rows } = await query('SELECT * FROM feedback WHERE feedback_id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Feedback not found' });
    const user_id = req.user.userId || req.user.user_id || req.user.student_id;
    if (req.user.role !== 'admin' && rows[0].user_id !== user_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
}

async function updateFeedback(req, res) {
  try {
    const { message, rating } = req.body;
    const user_id = req.user.userId || req.user.user_id || req.user.student_id;
    const { rows } = await query('SELECT * FROM feedback WHERE feedback_id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Feedback not found' });
    if (req.user.role !== 'admin' && rows[0].user_id !== user_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const result = await query(
      `UPDATE feedback SET message = COALESCE($1, message), rating = COALESCE($2, rating)
       WHERE feedback_id = $3
       RETURNING feedback_id, user_id, user_type, user_name, message, rating, created_at`,
      [message?.trim(), rating, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update feedback' });
  }
}

async function removeFeedback(req, res) {
  try {
    const user_id = req.user.userId || req.user.user_id || req.user.student_id;
    const { rows } = await query('SELECT * FROM feedback WHERE feedback_id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Feedback not found' });
    if (req.user.role !== 'admin' && rows[0].user_id !== user_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await query('DELETE FROM feedback WHERE feedback_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
}

module.exports = {
  submitFeedback,
  getAllFeedback,
  getMyFeedback,
  getById,
  updateFeedback,
  removeFeedback,
};
