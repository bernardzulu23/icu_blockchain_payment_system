const express = require('express');
const clearanceController = require('../controllers/clearanceController');
const { authenticateToken } = require('../middleware/auth');
const { requireAccountant, requireAccountantOrAdmin, requireStudent } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticateToken);

// Student requests clearance (studentId from req.user)
router.post('/request', requireStudent, clearanceController.requestClearance);

// Staff creates clearance on behalf of student (studentId in body)
router.post('/', requireAccountantOrAdmin, clearanceController.requestClearance);

// List/read: accountant, admin, registrar (registrar view-only)
router.get('/', requireAccountant, clearanceController.listAll);
router.get('/student/:studentId', requireAccountant, clearanceController.getByStudent);

// Download certificate: staff or student (own clearance only) - auth checked in handler
router.get('/:id/certificate', clearanceController.downloadCertificate);

// Verify/update: accountant and admin only (registrar cannot verify)
router.patch('/mass-verify', requireAccountantOrAdmin, clearanceController.massVerify);
router.patch('/:id', requireAccountantOrAdmin, clearanceController.updateStatus);

module.exports = router;
