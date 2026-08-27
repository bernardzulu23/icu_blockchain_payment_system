const express = require('express');
const studentController = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin, requireStudent } = require('../middleware/rbac');
const { upload, uploadImage } = require('../middleware/upload');
const { studentValidators, handleValidation, validatePagination, validateStudentIdParam } = require('../utils/validators');
const { publicCheckLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/check-payment', publicCheckLimiter, studentController.checkPayment);

router.get('/profile', authenticateToken, requireStudent, studentController.getProfile);
router.put('/profile', authenticateToken, requireStudent, studentController.updateProfile);
router.post(
  '/profile/picture',
  authenticateToken,
  requireStudent,
  uploadImage.single('profile_picture'),
  studentController.uploadProfilePicture
);

// Student CRUD — admin only (not registrar / not generic accountant list for writes)
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/', validatePagination, studentController.list);
router.get('/:id', validateStudentIdParam, studentController.getById);
router.post('/', studentValidators.create, handleValidation, studentController.create);
router.put('/:id', studentController.update);
router.delete('/:id', studentController.remove);

module.exports = router;
