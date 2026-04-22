const { query, getClient } = require('../config/database');
const logger = require('../utils/logger');

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
        : req.user.email ||
          'Anonymous');

    await query(
      `INSERT INTO feedback (user_id, user_type, user_name, message, rating)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING feedback_id, user_id, user_type, user_name, message, rating, created_at`,
      [
        user_id,
        role,
        user_name,
        message.trim(),
        rating != null && rating >= 1 && rating <= 5 ? rating : null,
      ]
    );

    logger.info(`Feedback submitted by ${role} ${user_id}`);

    res.status(201).json({
      success: true,
      message: 'Thank you for your feedback!',
    });
  } catch (error) {
    logger.error('Submit feedback error:', error);
    res.status(500).json({
      error: 'Failed to submit feedback',
      message: error.message,
    });
  }
}

async function getAllFeedback(req, res) {
  try {
    const { role } = req.user;

    if (role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only admins can view feedback.',
      });
    }

    const result = await query(
      `SELECT feedback_id, user_id, user_type, user_name, message, rating, created_at
       FROM feedback
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      feedback: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    logger.error('Get feedback error:', error);
    res.status(500).json({
      error: 'Failed to fetch feedback',
      message: error.message,
    });
  }
}

module.exports = { submitFeedback, getAllFeedback };
