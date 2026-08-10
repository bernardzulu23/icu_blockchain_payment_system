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
    const {
      username,
      email,
      password,
      role,
      fullName,
      full_name,
      residentialAddress,
      residential_address,
      dateOfBirth,
      date_of_birth,
      employeeId,
      employee_id,
    } = req.body;

    const name = String(fullName || full_name || '').trim();
    const staffRole = role || 'accountant';

    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Full name, email, and password are required',
      });
    }
    if (!['accountant', 'registrar', 'admin'].includes(staffRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const address = String(residentialAddress || residential_address || '').trim();
    const dob = dateOfBirth || date_of_birth || null;

    if (staffRole === 'accountant') {
      if (!address) {
        return res.status(400).json({ error: 'Residential address is required for accountant officers' });
      }
      if (!dob) {
        return res.status(400).json({ error: 'Date of birth is required for accountant officers' });
      }
    }

    const hash = await hashPassword(password);
    const generatedId = employeeId || employee_id || (await User.nextEmployeeId(staffRole));

    const user = await User.create({
      username: username || generatedId,
      email: String(email).trim().toLowerCase(),
      passwordHash: hash,
      role: staffRole,
      fullName: name,
      employeeId: generatedId,
      residentialAddress: address || null,
      dateOfBirth: dob,
    });

    await createAuditLog({
      user_id: req.user.userId || req.user.user_id,
      user_type: req.user.role,
      action: 'USER_CREATED',
      entity_type: 'user',
      entity_id: user.user_id,
      details: { employee_id: user.employee_id, role: user.role },
      ip_address: req.ip,
    });

    res.status(201).json(user);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Employee ID, username, or email already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const {
      username,
      email,
      role,
      fullName,
      full_name,
      status,
      password,
      residentialAddress,
      residential_address,
      dateOfBirth,
      date_of_birth,
      employeeId,
      employee_id,
    } = req.body;

    const fields = {
      username,
      email: email ? String(email).trim().toLowerCase() : email,
      role,
      full_name: fullName || full_name,
      status,
      residential_address:
        residentialAddress !== undefined || residential_address !== undefined
          ? residentialAddress || residential_address
          : undefined,
      date_of_birth:
        dateOfBirth !== undefined || date_of_birth !== undefined
          ? dateOfBirth || date_of_birth
          : undefined,
      employee_id:
        employeeId !== undefined || employee_id !== undefined
          ? employeeId || employee_id
          : undefined,
    };

    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      fields.password_hash = await hashPassword(password);
    }

    const user = await User.update(req.params.id, fields);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Employee ID, username, or email already exists' });
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
