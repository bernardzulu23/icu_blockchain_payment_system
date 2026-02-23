const express = require('express');
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');
const { requireAccountant, requireRole } = require('../middleware/rbac');
const { upload } = require('../middleware/upload');
const { paymentValidators, handleValidation } = require('../utils/validators');

const router = express.Router();

const requireStudent = requireRole('student');

router.get('/check', authenticateToken, requireStudent, paymentController.checkPaymentExists);
router.get('/check-duplicate', authenticateToken, requireStudent, paymentController.checkPaymentExists);
router.get('/my', authenticateToken, requireStudent, paymentController.getPaymentHistory);
router.post(
  '/submit',
  authenticateToken,
  requireStudent,
  upload.single('depositSlip'),
  paymentController.submitPayment
);

router.get(
  '/:id/statement',
  authenticateToken,
  requireStudent,
  paymentValidators.uuidParam,
  handleValidation,
  paymentController.downloadStatement
);

router.use(authenticateToken);
router.use(requireAccountant);

router.get('/', paymentController.list);
router.get('/:id', paymentValidators.uuidParam, handleValidation, paymentController.getById);
router.post('/', paymentValidators.create, handleValidation, paymentController.create);
router.post('/:id/verify', paymentValidators.uuidParam, handleValidation, paymentController.verify);
router.get('/:id/receipt', paymentValidators.uuidParam, handleValidation, paymentController.receipt);

module.exports = router;
