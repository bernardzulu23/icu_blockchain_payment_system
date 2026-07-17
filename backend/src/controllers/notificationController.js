const Notification = require('../models/Notification');

function getRecipient(req) {
  if (req.user.role === 'student') {
    return { id: req.user.student_id || req.user.userId, type: 'student' };
  }
  return { id: req.user.userId || req.user.user_id, type: 'user' };
}

async function list(req, res, next) {
  try {
    const { id, type } = getRecipient(req);
    const result = await Notification.listForRecipient(id, type, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    const { id, type } = getRecipient(req);
    if (notification.recipient_id !== id || notification.recipient_type !== type) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(notification);
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    const { id, type } = getRecipient(req);
    if (notification.recipient_id !== id || notification.recipient_type !== type) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const updated = await Notification.markRead(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    const { id, type } = getRecipient(req);
    await Notification.markAllRead(id, type);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    const { id, type } = getRecipient(req);
    if (notification.recipient_id !== id || notification.recipient_type !== type) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await Notification.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, markRead, markAllRead, remove };
