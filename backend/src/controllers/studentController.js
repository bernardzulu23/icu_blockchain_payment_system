const { hashPassword } = require('../utils/password');
const Student = require('../models/Student');
const Payment = require('../models/Payment');

async function list(req, res, next) {
  try {
    const result = await Student.list(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const studentId = req.user.student_id || req.user.userId;
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ error: 'Profile not found' });
    res.json(student);
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const studentId = req.user.student_id || req.user.userId;
    const { firstName, lastName, email, phone, program, department, currentSemester, currentTerm } =
      req.body;
    const fields = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      program,
      department,
      current_semester: currentSemester,
      current_term: currentTerm,
    };
    const student = await Student.update(studentId, fields);
    res.json(student);
  } catch (err) {
    next(err);
  }
}

async function uploadProfilePicture(req, res, next) {
  try {
    const studentId = req.user.student_id || req.user.userId;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Profile picture required' });
    const url = `/uploads/profile-pictures/${file.filename}`;
    const student = await Student.update(studentId, { profile_picture_url: url });
    res.json({ success: true, profile_picture_url: url, student });
  } catch (err) {
    next(err);
  }
}

async function checkPayment(req, res, next) {
  try {
    const { studentId, studentNumber, reference } = req.query;
    const identifier = (studentId || studentNumber || '').toString().trim();
    const batchRef = (reference || '').toString().trim();

    if (!identifier || !batchRef) {
      return res.status(400).json({ message: 'Student number and batch/reference are required' });
    }

    const { pool } = require('../config/database');
    const { rows } = await pool.query(
      'SELECT student_id FROM students WHERE student_id = $1 OR student_number = $1',
      [identifier]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Student not found' });

    const payment = await Payment.findByStudentAndBatch(rows[0].student_id, batchRef, 'verified');
    if (!payment) {
      return res.status(404).json({ message: 'No verified payment found for this batch number' });
    }
    res.json(payment);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      studentId,
      studentNumber,
      firstName,
      lastName,
      email,
      phone,
      program,
      department,
      admissionYear,
      dateOfBirth,
      currentSemester,
      currentTerm,
      password,
    } = req.body;
    const hash = password
      ? await hashPassword(password)
      : await hashPassword(`change-me-${Date.now()}`);
    const student = await Student.create({
      studentId,
      studentNumber,
      firstName,
      lastName,
      email,
      phone,
      program,
      department,
      admissionYear,
      dateOfBirth,
      currentSemester,
      currentTerm,
      passwordHash: hash,
    });
    res.status(201).json(student);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Student ID or student number already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      program,
      department,
      admissionYear,
      currentSemester,
      currentTerm,
      status,
      password,
    } = req.body;
    const fields = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      program,
      department,
      admission_year: admissionYear,
      current_semester: currentSemester,
      current_term: currentTerm,
      status,
    };
    if (password) fields.password_hash = await hashPassword(password);
    const student = await Student.update(req.params.id, fields);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const student = await Student.remove(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ success: true, message: 'Student deactivated' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  getProfile,
  updateProfile,
  uploadProfilePicture,
  checkPayment,
  create,
  update,
  remove,
};
