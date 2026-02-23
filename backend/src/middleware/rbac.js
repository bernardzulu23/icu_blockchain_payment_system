const { authorize } = require('./auth');
const { ROLES } = require('../utils/constants');

const requireAdmin = authorize(ROLES.ADMIN);
const requireAccountant = authorize(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.REGISTRAR);
const requireRegistrar = authorize(ROLES.ADMIN, ROLES.REGISTRAR);
const requireStudent = authorize('student');

module.exports = { requireRole: authorize, requireAdmin, requireAccountant, requireRegistrar, requireStudent };
