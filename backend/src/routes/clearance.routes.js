const express = require('express');
const clearanceController = require('../controllers/clearanceController');
const { authenticateToken } = require('../middleware/auth');
const { requireAccountant } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAccountant);

router.post('/', clearanceController.requestClearance);
router.get('/student/:studentId', clearanceController.getByStudent);
router.patch('/:id', clearanceController.updateStatus);

module.exports = router;
