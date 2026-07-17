const { hashPassword } = require('../utils/password');
const User = require('../models/User');
const { createAuditLog } = require('../services/auditService');

async function list(req, res, next) {
  try {
    const result = await User.list(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { username, email, password, role, fullName, full_name } = req.body;
    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'username, email, password, and role are required' });
    }
    if (!['accountant', 'registrar', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const hash = await hashPassword(password);
    const user = await User.create({
      username,
      email,
      passwordHash: hash,
      role,
      fullName: fullName || full_name || username,
    });
    await createAuditLog({
      user_id: req.user.userId || req.user.user_id,
      user_type: req.user.role,
      action: 'USER_CREATED',
      entity_type: 'user',
      entity_id: user.user_id,
      ip_address: req.ip,
    });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { username, email, role, fullName, full_name, status, password } = req.body;
    const fields = {
      username,
      email,
      role,
      full_name: fullName || full_name,
      status,
    };
    if (password) {
      fields.password_hash = await hashPassword(password);
    }
    const user = await User.update(req.params.id, fields);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const user = await User.remove(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getById, create, update, remove };
