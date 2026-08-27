/**
 * ICU Pay — Input Validation & Output Encoding
 * Validate on the way in; sanitize OCR/metadata text on the way out.
 *
 * npm i express-validator dompurify jsdom
 */
const { body, param, query, validationResult } = require('express-validator');

let domPurifyInstance;

function getDOMPurify() {
  if (!domPurifyInstance) {
    const createDOMPurify = require('dompurify');
    const { JSDOM } = require('jsdom');
    domPurifyInstance = createDOMPurify(new JSDOM('').window);
  }
  return domPurifyInstance;
}

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'Validation failed.',
      details: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  return next();
}

/** @deprecated alias — prefer handleValidationErrors */
const handleValidation = handleValidationErrors;

function loginIdentifierPresent(value, { req }) {
  const id =
    req.body.identifier ||
    req.body.username ||
    req.body.email ||
    req.body.student_number ||
    req.body.loginId;
  if (!id || String(id).trim().length < 3) {
    throw new Error('Provide a valid email, username, or student/employee ID.');
  }
  if (String(id).length > 100) {
    throw new Error('Login identifier is too long.');
  }
  return true;
}

const validateLogin = [
  body('identifier').optional().trim().isLength({ max: 100 }),
  body('username').optional().trim().isLength({ max: 100 }),
  body('email').optional().trim().isLength({ max: 200 }),
  body('student_number').optional().trim().isLength({ max: 50 }),
  body('loginId').optional().trim().isLength({ max: 100 }),
  body('password')
    .isLength({ min: 1, max: 128 })
    .withMessage('Password is required.'),
  body().custom(loginIdentifierPresent),
  handleValidationErrors,
];

const validatePaymentSubmit = [
  body('semester')
    .trim()
    .notEmpty()
    .isLength({ max: 20 })
    .withMessage('Semester is required.'),
  body('academic_year')
    .trim()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be YYYY-YYYY.'),
  body('amount')
    .isFloat({ min: 1, max: 1000000 })
    .withMessage('Amount must be a positive number within an expected range.')
    .toFloat(),
  body('batch_number')
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[A-Za-z0-9\-\/]+$/)
    .withMessage('Batch number contains invalid characters.'),
  body('bank_name').trim().notEmpty().isLength({ max: 100 }),
  body('payment_date')
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Payment date must be YYYY-MM-DD.'),
  handleValidationErrors,
];

const validateDepositSlipMeta = [
  body('studentId')
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Za-z0-9\-]+$/)
    .withMessage('Student ID format is invalid.'),
  body('amount')
    .isFloat({ min: 1, max: 1000000 })
    .withMessage('Amount must be a positive number within an expected range.')
    .toFloat(),
  body('reference')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[A-Za-z0-9\-\/]+$/),
  body('bankReference')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .matches(/^[A-Za-z0-9\-\/]+$/),
  body('bankName').optional().trim().isLength({ max: 100 }),
  handleValidationErrors,
];

const validateStudentIdParam = [
  param('id')
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Za-z0-9\-]+$/)
    .withMessage('Invalid student ID.'),
  handleValidationErrors,
];

const validateUuidParam = [
  param('id').isUUID().withMessage('Invalid ID format.'),
  handleValidationErrors,
];

const validatePagination = [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt(),
  handleValidationErrors,
];

function sanitizeForDisplay(rawText) {
  if (typeof rawText !== 'string') return '';
  return getDOMPurify().sanitize(rawText, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

function sanitizeMetadataString(input, maxLength = 255) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, maxLength)
    .trim();
}

/** Sanitize OCR / bank fields before DB write or API response. */
function sanitizeOcrText(value, maxLength = 200) {
  return sanitizeMetadataString(sanitizeForDisplay(String(value ?? '')), maxLength);
}

function sanitizeBankTransaction(txn = {}) {
  return {
    ...txn,
    batch_number: sanitizeMetadataString(String(txn.batch_number ?? ''), 50),
    depositor_name: sanitizeOcrText(txn.depositor_name, 200),
  };
}

function sanitizeOcrSlip(slip = {}) {
  return {
    ...slip,
    student_id: sanitizeMetadataString(String(slip.student_id ?? ''), 20),
    batch_reference: sanitizeMetadataString(String(slip.batch_reference ?? ''), 50),
    bank_name: sanitizeOcrText(slip.bank_name, 100),
    raw_text: sanitizeOcrText(slip.raw_text, 2000),
  };
}

function sanitizeOcrPreviewResult(result = {}) {
  return {
    ...result,
    slips: Array.isArray(result.slips) ? result.slips.map(sanitizeOcrSlip) : [],
    bank_transactions: Array.isArray(result.bank_transactions)
      ? result.bank_transactions.map(sanitizeBankTransaction)
      : [],
    matching: result.matching,
  };
}

module.exports = {
  handleValidationErrors,
  handleValidation,
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
