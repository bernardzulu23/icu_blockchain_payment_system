function getCurrentSemester() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const semester = month >= 1 && month <= 6 ? 'Semester 1' : 'Semester 2';
  const academicYear = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return { semester, academicYear };
}

function generateTxHash(id) {
  return '0x' + Buffer.from(`${id}-${Date.now()}`).toString('hex').slice(0, 64);
}

module.exports = { getCurrentSemester, generateTxHash };
