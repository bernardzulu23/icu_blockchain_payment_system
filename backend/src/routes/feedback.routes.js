const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole, requireAdmin } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

router.post(
  '/',
  requireRole('student', 'accountant', 'registrar'),
  feedbackController.submitFeedback
);

router.get('/mine', requireRole('student', 'accountant', 'registrar'), feedbackController.getMyFeedback);
router.get('/', requireAdmin, feedbackController.getAllFeedback);
router.get('/:id', feedbackController.getById);
router.put('/:id', feedbackController.updateFeedback);
router.delete('/:id', feedbackController.removeFeedback);

module.exports = router;
