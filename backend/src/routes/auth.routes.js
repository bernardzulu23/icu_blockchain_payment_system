const express = require('express');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login/student', authController.studentLogin);
router.post('/login/staff', authController.staffLogin);

router.post('/login', (req, res, next) => {
  const { email, username, password } = req.body;
  req.body.username = username || email;
  authController.staffLogin(req, res, next);
});

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
router.post('/refresh', authController.refreshAccessToken);

router.get('/me', authenticateToken, authController.me);

module.exports = router;
