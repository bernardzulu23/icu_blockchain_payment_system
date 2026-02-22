const express = require('express');
const studentController = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/auth');
const { requireAccountant, requireStudent } = require('../middleware/rbac');
const { upload } = require('../middleware/upload');
const { studentValidators, handleValidation } = require('../utils/validators');

const router = express.Router();

router.get('/check-payment', studentController.checkPayment);

router.get('/profile', authenticateToken, requireStudent, studentController.getProfile);
router.post(
  '/profile/picture',
  authenticateToken,
  requireStudent,
  upload.single('profile_picture'),
  studentController.uploadProfilePicture
);

router.post(
  '/',
  authenticateToken,
  requireAccountant,
  studentValidators.create,
  handleValidation,
  studentController.create
);

module.exports = router;
