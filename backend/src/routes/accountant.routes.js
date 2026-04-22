const express = require('express');
const accountantController = require('../controllers/accountantController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole, requireAccountant } = require('../middleware/rbac');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.use(authenticateToken);
router.use(requireAccountant);

router.post(
  '/bank-statement',
  upload.single('statement'),
  accountantController.uploadBankStatement
);

router.post(
  '/verify-all-auto-matched',
  requireRole('accountant', 'admin'),
  accountantController.verifyAllAutoMatched
);

router.get('/pending-payments', accountantController.getPendingPayments);

router.post(
  '/verify/:payment_id',
  accountantController.verifyPayment
);

router.post('/bulk-verify', accountantController.bulkVerifyPayments);

router.get('/stats', accountantController.getVerificationStats);

router.post('/bulk-payment-status', accountantController.bulkPaymentStatus);

router.post(
  '/batch/verify',
  upload.fields([
    { name: 'payments', maxCount: 1 },
    { name: 'bankStatement', maxCount: 1 },
  ]),
  accountantController.batchVerify
);

module.exports = router;
