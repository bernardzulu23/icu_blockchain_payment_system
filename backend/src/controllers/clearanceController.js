const Clearance = require('../models/Clearance');

async function requestClearance(req, res, next) {
  try {
    const { studentId, clearanceType } = req.body;
    const clearance = await Clearance.create({
      studentId: studentId || req.params.studentId,
      clearanceType: clearanceType || 'graduation',
    });
    res.status(201).json(clearance);
  } catch (err) {
    next(err);
  }
}

async function getByStudent(req, res, next) {
  try {
    const clearances = await Clearance.findByStudent(req.params.studentId);
    res.json(clearances);
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status, rejectionReason } = req.body;
    await Clearance.updateStatus(req.params.id, {
      status,
      approvedBy: req.user.userId,
      approvedDate: new Date(),
      rejectionReason,
    });
    res.json({ message: 'Clearance status updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { requestClearance, getByStudent, updateStatus };
