function getCurrentSemester() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const semester = month >= 1 && month <= 6 ? 'Semester 1' : 'Semester 2';
  const academicYear = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  return { semester, academicYear };
}

module.exports = { getCurrentSemester };
