const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/stats', adminController.getStats);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
