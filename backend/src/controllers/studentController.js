const Student = require('../models/Student');
const Payment = require('../models/Payment');
const { query } = require('../config/database');

async function getProfile(req, res, next) {
  try {
    const studentId = req.user.student_id || req.user.userId;
    const { rows } = await query(
      `SELECT student_id, student_number, first_name, last_name, email, phone,
              program, department, date_of_birth, current_semester, current_term,
              profile_picture_url, admission_year, status
       FROM students WHERE student_id = $1`,
      [studentId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found' });
    res.json(rows[0]);
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
    await query(
      'UPDATE students SET profile_picture_url = $1, updated_at = NOW() WHERE student_id = $2',
      [url, studentId]
    );
    res.json({ success: true, profile_picture_url: url });
  } catch (err) {
    next(err);
  }
}

async function checkPayment(req, res, next) {
  try {
    const { studentId, reference } = req.query;
    if (!studentId || !reference) {
      return res.status(400).json({ message: 'Student ID and batch/reference are required' });
    }
    const payment = await Payment.findByStudentAndBatch(studentId, reference, 'verified');
    if (!payment) {
      return res.status(404).json({ message: 'No verified payment found' });
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
    const bcrypt = require('bcrypt');
    const hash = password
      ? await bcrypt.hash(password, 12)
      : await bcrypt.hash('change-me-' + Date.now(), 10);
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

module.exports = { checkPayment, create, getProfile, uploadProfilePicture };
