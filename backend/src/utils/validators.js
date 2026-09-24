/**
 * Legacy validator exports — hardened chains live in input-validation.js.
 */
const { body, param } = require('express-validator');
const {
  handleValidation,
  handleValidationErrors,
  validateLogin,
  validatePaymentSubmit,
  validateDepositSlipMeta,
  validateStudentIdParam,
  validateUuidParam,
  validatePagination,
  sanitizeForDisplay,
  sanitizeMetadataString,
  sanitizeOcrText,
  sanitizeBankTransaction,
  sanitizeOcrSlip,
  sanitizeOcrPreviewResult,
} = require('./input-validation');

const authValidators = {
  login: validateLogin.slice(0, -1),
};

const paymentValidators = {
  create: validateDepositSlipMeta.slice(0, -1),
  submit: validatePaymentSubmit.slice(0, -1),
  uuidParam: validateUuidParam.slice(0, -1),
};

const optionalField = { values: 'falsy' };

const studentValidators = {
  create: [
    body('studentId')
      .trim()
      .notEmpty()
      .isLength({ max: 20 })
      .matches(/^[A-Za-z0-9\-]+$/)
      .withMessage('Student ID must be 1–20 letters, numbers, or hyphens'),
    body('studentNumber').optional(optionalField).trim().isLength({ max: 20 }),
    body('firstName').trim().notEmpty().isLength({ max: 100 }),
    body('lastName').trim().notEmpty().isLength({ max: 100 }),
    body('email').optional(optionalField).isEmail().normalizeEmail(),
    body('phone').optional(optionalField).trim().isLength({ max: 20 }),
    body('program').optional(optionalField).trim().isLength({ max: 100 }),
    body('department').optional(optionalField).trim().isLength({ max: 100 }),
    body('admissionYear').optional(optionalField).isInt({ min: 1990, max: 2100 }).toInt(),
    body('dateOfBirth')
      .optional(optionalField)
      .isISO8601()
      .withMessage('Invalid date format (YYYY-MM-DD)'),
    body('currentSemester').optional(optionalField).isInt({ min: 1, max: 12 }).toInt(),
    body('currentTerm').optional(optionalField).isInt({ min: 1, max: 3 }).toInt(),
    body('password')
      .trim()
      .notEmpty()
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be at least 8 characters'),
  ],
};

module.exports = {
  handleValidation,
  handleValidationErrors,
  authValidators,
  paymentValidators,
  studentValidators,
  validateLogin,
  validatePaymentSubmit,
  validateDepositSlipMeta,
  validateStudentIdParam,
  validateUuidParam,
  validatePagination,
  sanitizeForDisplay,
  sanitizeMetadataString,
  sanitizeOcrText,
  sanitizeBankTransaction,
  sanitizeOcrSlip,
  sanitizeOcrPreviewResult,
};
