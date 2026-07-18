const express = require('express');
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

router.get('/', notificationController.list);
router.patch('/read-all', notificationController.markAllRead);
router.get('/:id', notificationController.getById);
router.patch('/:id/read', notificationController.markRead);
router.delete('/:id', notificationController.remove);

module.exports = router;
