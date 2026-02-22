const { body, param, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
  }
  next();
};

const authValidators = {
  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  register: [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('role').optional().isIn(['accountant', 'registrar', 'admin']),
  ],
};

const paymentValidators = {
  create: [
    body('studentId').trim().notEmpty(),
    body('amount').isFloat({ min: 0.01 }),
    body('reference').trim().notEmpty(),
    body('studentName').optional(),
    body('bankName').optional(),
  ],
  uuidParam: [param('id').isUUID()],
};

const studentValidators = {
  create: [
    body('studentId').trim().notEmpty(),
    body('studentNumber').optional(),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('email').optional().isEmail(),
    body('phone').optional(),
    body('program').optional(),
    body('department').optional(),
    body('admissionYear').optional().isInt(),
    body('dateOfBirth').optional().isISO8601().withMessage('Invalid date format (YYYY-MM-DD)'),
    body('currentSemester').optional().isInt({ min: 1, max: 12 }),
    body('currentTerm').optional().isInt({ min: 1, max: 3 }),
    body('password').optional().isLength({ min: 6 }),
  ],
};

module.exports = {
  handleValidation,
  authValidators,
  paymentValidators,
  studentValidators,
};
