const express = require('express');
const clearanceController = require('../controllers/clearanceController');
const { authenticateToken } = require('../middleware/auth');
const { requireAccountant, requireAccountantOrAdmin, requireStudent } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

router.post('/request', requireStudent, clearanceController.requestClearance);
router.get('/mine', requireStudent, clearanceController.getMyClearances);
router.post('/', requireAccountantOrAdmin, clearanceController.requestClearance);
router.get('/', requireAccountant, clearanceController.listAll);
router.get('/student/:studentId', requireAccountant, clearanceController.getByStudent);
router.patch('/mass-verify', requireAccountantOrAdmin, clearanceController.massVerify);
router.get('/:id/certificate', clearanceController.downloadCertificate);
router.get('/:id', requireAccountant, clearanceController.getById);
router.patch('/:id', requireAccountantOrAdmin, clearanceController.updateStatus);
router.delete('/:id', clearanceController.remove);

module.exports = router;
