const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/auth-hardening');
const { forgotPasswordLimiter } = require('../middleware/rateLimit');
const { body } = require('express-validator');
const { handleValidation, validateLogin } = require('../utils/validators');
const { isPasswordStrong } = require('../utils/password');
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

const loginValidation = validateLogin;

router.post('/login/student', loginLimiter, loginValidation, authController.studentLogin);
router.post('/login/staff', loginLimiter, loginValidation, authController.staffLogin);
router.post('/login', loginLimiter, loginValidation, authController.unifiedLogin);

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  body('email').isEmail().normalizeEmail(),
  handleValidation,
  authController.forgotPassword
);
router.post(
  '/reset-password/:token',
  body('newPassword')
    .custom((value) => {
      if (!isPasswordStrong(value)) {
        throw new Error(
          'Password must be at least 12 characters with upper, lower, digit, and symbol'
        );
      }
      return true;
    }),
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
