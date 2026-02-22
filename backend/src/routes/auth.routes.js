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

// Students are registered by admin only
router.post('/register/student', (req, res) =>
  res.status(403).json({ error: 'Student self-registration disabled', message: 'Students are registered by admin. Contact the accounts office.' })
);
router.post('/refresh', authController.refreshAccessToken);

router.get('/me', authenticateToken, authController.me);

module.exports = router;
