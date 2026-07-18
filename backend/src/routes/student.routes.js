const express = require('express');
const studentController = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/auth');
const { requireAccountant, requireStudent } = require('../middleware/rbac');
const { upload } = require('../middleware/upload');
const { studentValidators, handleValidation } = require('../utils/validators');

const router = express.Router();

router.get('/check-payment', studentController.checkPayment);

router.get('/profile', authenticateToken, requireStudent, studentController.getProfile);
router.put('/profile', authenticateToken, requireStudent, studentController.updateProfile);
router.post(
  '/profile/picture',
  authenticateToken,
  requireStudent,
  upload.single('profile_picture'),
  studentController.uploadProfilePicture
);

router.use(authenticateToken);
router.use(requireAccountant);

router.get('/', studentController.list);
router.get('/:id', studentController.getById);
router.post('/', studentValidators.create, handleValidation, studentController.create);
router.put('/:id', studentController.update);
router.delete('/:id', studentController.remove);

module.exports = router;
