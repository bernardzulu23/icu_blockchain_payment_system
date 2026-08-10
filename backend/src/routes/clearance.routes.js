const express = require('express');
const clearanceController = require('../controllers/clearanceController');
const { authenticateToken } = require('../middleware/auth');
const {
  requireAccountantOrAdmin,
  requireStaff,
  requireStudent,
} = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

router.post('/request', requireStudent, clearanceController.requestClearance);
router.get('/mine', requireStudent, clearanceController.getMyClearances);
router.post('/', requireAccountantOrAdmin, clearanceController.requestClearance);
router.get('/', requireStaff, clearanceController.listAll);
router.get('/student/:studentId', requireStaff, clearanceController.getByStudent);
router.patch('/mass-verify', requireStaff, clearanceController.massVerify);
router.get('/:id/certificate', clearanceController.downloadCertificate);
router.get('/:id', requireStaff, clearanceController.getById);
router.patch('/:id', requireStaff, clearanceController.updateStatus);
router.delete('/:id', requireStudent, clearanceController.remove);

module.exports = router;
