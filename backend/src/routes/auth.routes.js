const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { forgotPasswordLimiter } = require('../middleware/rateLimit');
const { body } = require('express-validator');
const { handleValidation } = require('../utils/validators');
const env = require('../config/environment');

const router = express.Router();

router.use((req, res, next) => {
  if (!env.JWT_OK) {
    return res.status(503).json({
      error: 'Auth misconfigured',
      message:
        'Set JWT_SECRET and JWT_REFRESH_SECRET in Vercel (each at least 32 characters), then redeploy.',
    });
  }
  return next();
});

const loginValidation = [
  body('identifier').optional().trim(),
  body('username').optional().trim(),
  body('email').optional().trim(),
  body('student_number').optional().trim(),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }),
  handleValidation,
];

router.post('/login/student', loginValidation, authController.studentLogin);
router.post('/login/staff', loginValidation, authController.staffLogin);
router.post('/login', loginValidation, authController.unifiedLogin);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  body('email').isEmail().normalizeEmail(),
  handleValidation,
  authController.forgotPassword
);
router.post(
  '/reset-password/:token',
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) throw new Error('Passwords do not match');
    return true;
  }),
  handleValidation,
  authController.resetPassword
);
router.post('/refresh', authController.refreshAccessToken);

router.get('/me', authenticateToken, authController.me);

module.exports = router;
