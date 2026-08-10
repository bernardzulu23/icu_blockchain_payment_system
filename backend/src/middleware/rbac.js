const { authorize } = require('./auth');
const { ROLES } = require('../utils/constants');

const requireAdmin = authorize(ROLES.ADMIN);
/** Accountant operations (verify, bank upload, OCR) — admin + accountant only */
const requireAccountant = authorize(ROLES.ADMIN, ROLES.ACCOUNTANT);
const requireAccountantOrAdmin = authorize(ROLES.ADMIN, ROLES.ACCOUNTANT);
/** Clearance / registrar workflows */
const requireRegistrar = authorize(ROLES.ADMIN, ROLES.REGISTRAR);
/** Shared read paths: admin, accountant, or registrar */
const requireStaff = authorize(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.REGISTRAR);
const requireStudent = authorize('student');

module.exports = {
  requireRole: authorize,
  requireAdmin,
  requireAccountant,
  requireAccountantOrAdmin,
  requireRegistrar,
  requireStaff,
  requireStudent,
};
