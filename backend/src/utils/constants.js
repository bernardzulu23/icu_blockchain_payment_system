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
  /** Allowed clearance types: Graduation, Term 1–3, Semester 1–12 (no transfer) */
  CLEARANCE_TYPES: [
    'Graduation',
    ...[1, 2, 3].map((n) => `Term ${n}`),
    ...Array.from({ length: 12 }, (_, i) => `Semester ${i + 1}`),
  ],
  ALLOWED_BANKS: ['Zanaco Bank', 'ABSA Bank'],
  BANK_TEMPLATE_IDS: ['zanaco', 'absa'],
  ACADEMIC_YEAR_MIN: 2000,
  ACADEMIC_YEAR_MAX: 2099,
  USER_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
  },
  AUTH: {
    JWT_EXPIRES_IN: '15m',
    BCRYPT_ROUNDS: 12,
  },
};

function isAllowedBank(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.trim().toLowerCase();
  return (
    n === 'zanaco bank' ||
    n === 'zanaco' ||
    n === 'absa bank' ||
    n === 'absa'
  );
}

function normalizeBankName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (n.includes('zanaco')) return 'Zanaco Bank';
  if (n.includes('absa')) return 'ABSA Bank';
  return null;
}

function isValidClearanceType(type) {
  const { CLEARANCE_TYPES } = module.exports;
  const normalized = String(type || '').trim();
  if (CLEARANCE_TYPES.includes(normalized)) return true;
  // Accept legacy lowercase "graduation"
  if (normalized.toLowerCase() === 'graduation') return true;
  return false;
}

function isValidAcademicYearSpan(value) {
  const m = /^(\d{4})-(\d{4})$/.exec(String(value || '').trim());
  if (!m) return false;
  const start = Number(m[1]);
  const end = Number(m[2]);
  const { ACADEMIC_YEAR_MIN, ACADEMIC_YEAR_MAX } = module.exports;
  return (
    end === start + 1 &&
    start >= ACADEMIC_YEAR_MIN &&
    end <= ACADEMIC_YEAR_MAX
  );
}

module.exports.isAllowedBank = isAllowedBank;
module.exports.normalizeBankName = normalizeBankName;
module.exports.isValidClearanceType = isValidClearanceType;
module.exports.isValidAcademicYearSpan = isValidAcademicYearSpan;
