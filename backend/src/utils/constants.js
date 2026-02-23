module.exports = {
  ROLES: {
    ADMIN: 'admin',
    ACCOUNTANT: 'accountant',
    REGISTRAR: 'registrar',
    STUDENT: 'student',
  },
  PAYMENT_STATUS: {
    PENDING: 'pending',
    AUTO_MATCHED: 'auto_matched',
    MANUAL_REVIEW: 'manual_review',
    VERIFIED: 'verified',
    REJECTED: 'rejected',
  },
  CLEARANCE_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    REQUIRES_PAYMENT: 'requires_payment',
  },
  USER_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
  },
};
