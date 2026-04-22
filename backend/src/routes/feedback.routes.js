const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

router.post(
  '/',
  requireRole('student', 'accountant', 'registrar'),
  feedbackController.submitFeedback
);

router.get(
  '/',
  requireRole('admin'),
  feedbackController.getAllFeedback
);

module.exports = router;
