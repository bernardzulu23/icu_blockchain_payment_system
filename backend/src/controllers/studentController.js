const { hashPassword } = require('../utils/password');
const Student = require('../models/Student');
const Payment = require('../models/Payment');
const { query } = require('../config/database');

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
      'SELECT student_id, first_name, last_name FROM students WHERE student_id = $1 OR student_number = $1',
      [identifier]
    );
    // Uniform response to reduce enumeration
    if (!rows[0]) {
      return res.status(404).json({ verified: false, message: 'No verified payment found' });
    }

    const payment = await Payment.findByStudentAndBatch(rows[0].student_id, batchRef, 'verified');
    if (!payment) {
      return res.status(404).json({ verified: false, message: 'No verified payment found' });
    }

    // Minimal public payload — no internal IDs or full financial dump
    res.json({
      verified: true,
      studentName: `${rows[0].first_name || ''} ${rows[0].last_name || ''}`.trim(),
      amount: payment.amount,
      reference: batchRef,
      semester: payment.semester,
      academicYear: payment.academicYear || payment.academic_year,
      status: 'verified',
    });
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

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!studentId || !studentNumber || !firstName || !lastName) {
      return res.status(400).json({
        message: 'Student ID, student number, first name, and last name are required',
      });
    }
    if (!normalizedEmail) {
      return res.status(400).json({
        message: 'Email is required — students log in with this email and password',
      });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({
        message: 'Password is required (min 6 characters) — this is the student login password',
      });
    }

    const existingEmail = await query(
      `SELECT student_id FROM students WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
      [normalizedEmail]
    );
    if (existingEmail.rows.length) {
      return res.status(400).json({ message: 'A student with this email already exists' });
    }

    const hash = await hashPassword(String(password));
    const student = await Student.create({
      studentId: String(studentId).trim(),
      studentNumber: String(studentNumber).trim(),
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: normalizedEmail,
      phone,
      program,
      department,
      admissionYear,
      dateOfBirth,
      currentSemester,
      currentTerm,
      passwordHash: hash,
    });
    res.status(201).json({
      ...student,
      login_hint: `Student can sign in with email "${normalizedEmail}" (or student number) and the password you set`,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Student ID, student number, or email already exists' });
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
      email: typeof email === 'string' ? email.trim().toLowerCase() : email,
      phone,
      program,
      department,
      admission_year: admissionYear,
      current_semester: currentSemester,
      current_term: currentTerm,
      status,
    };
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      fields.password_hash = await hashPassword(password);
    }
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
