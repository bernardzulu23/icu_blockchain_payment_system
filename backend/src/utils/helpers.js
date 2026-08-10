function getCurrentSemester() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0–11
  const semester = month >= 0 && month <= 5 ? '1' : '2';
  const startYear = month >= 7 ? year : year - 1;
  const academicYear = `${startYear}-${startYear + 1}`;
  return { semester, academicYear };
}

module.exports = { getCurrentSemester };
