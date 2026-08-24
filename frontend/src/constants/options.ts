const ZANACO_ICON = '/assets/bank-zanaco.png';
const ABSA_ICON = '/assets/bank-absa.png';

/** Allowed banks for payments and statements */
export const BANKS = [
  { value: 'Zanaco Bank', label: 'Zanaco Bank', icon: ZANACO_ICON },
  { value: 'ABSA Bank', label: 'ABSA Bank', icon: ABSA_ICON },
] as const;

export const BANK_VALUES = BANKS.map((b) => b.value);

/** OCR / batch template hints (lowercase ids) */
export const BANK_TEMPLATES = [
  { value: 'zanaco', label: 'Zanaco Bank', icon: ZANACO_ICON },
  { value: 'absa', label: 'ABSA Bank', icon: ABSA_ICON },
] as const;

export function resolveBankIcon(bank: string | null | undefined): string | null {
  const n = (bank || '').toLowerCase();
  if (n.includes('zanaco')) return ZANACO_ICON;
  if (n.includes('absa')) return ABSA_ICON;
  return null;
}

export function resolveBankLabel(bank: string | null | undefined): string {
  const n = (bank || '').toLowerCase();
  if (n.includes('zanaco')) return 'Zanaco Bank';
  if (n.includes('absa')) return 'ABSA Bank';
  return bank?.trim() || '';
}

/** ICU bachelor programmes */
export const BACHELOR_PROGRAMS = [
  'Bachelor of Arts in Development Studies',
  'Bachelor of Economics and Finance',
  'Bachelor of Arts in Economics',
  'Bachelor of Human Resource Management',
  'Bachelor of Arts in Journalism',
  'Bachelor of Arts in Mass Communication',
  'Bachelor of Arts in Public Administration',
  'Bachelor of Arts in Project Management',
  'Bachelor of Social Work Practice and Development',
  'Bachelor of Business Administration',
  'Bachelor of Education in Business Studies',
  'Bachelor of Science in Agriculture with Education',
  'Bachelor of Information and Communications Technology with Education',
  'Bachelor of Design and Technology with Education',
  'Bachelor of Fine Art in Acting and Film Production',
  'Bachelor of Fine Art in Music and Dance Theater',
  'Bachelor of Information and Communications Technology in IT Business Management',
  'Bachelor of Science in Agriculture',
  'Bachelor of Architecture',
  'Bachelor Of Science In Environmental Management System',
  'Bachelor of Information and Communications Technology',
  'Bachelor of Information and Communications Technology in Information Systems',
  'Bachelor of Information Security and Computer Forensics',
  'Bachelor of Mobile Communications',
  'Bachelor of Information and Communications Technology in Network Technology',
  'Bachelor of Information and Communications Technology in Software Engineering',
  'Bachelor of Information and Communications Technology in Systems Engineering',
  'Bachelor of Information and Communications Technology in Technology Management',
  'Bachelor of Science in Electrical and Electronics Engineering',
] as const;

/** ICU masters programmes */
export const MASTERS_PROGRAMS = [
  'Master in Development Studies',
  'Master of Education',
  'Master in Project Planning Management',
  'Master in Business Administration',
  'Master of Arts in Economics',
  'Master of Design and Technology',
  'Master In Social Work',
  'Master of Public Administration',
  'Master of Science in Plant and Soil Science',
  'Master in Information and Communications Technology',
] as const;

export const PROGRAMS = [...BACHELOR_PROGRAMS, ...MASTERS_PROGRAMS] as const;

export const SCHOOLS = [
  'School of Business',
  'School of Education',
  'School of Engineering',
  'School of Humanities',
] as const;

export const TERMS = [1, 2, 3] as const;
export const SEMESTERS = Array.from({ length: 12 }, (_, i) => i + 1);

export const ACADEMIC_YEAR_START = 2000;
export const ACADEMIC_YEAR_END = 2099;

/** Calendar years 2000–2099 (admission year, DOB bounds, etc.) */
export const CALENDAR_YEARS = Array.from(
  { length: ACADEMIC_YEAR_END - ACADEMIC_YEAR_START + 1 },
  (_, i) => ACADEMIC_YEAR_START + i
);

/** Academic year spans e.g. 2000-2001 … 2098-2099 */
export const ACADEMIC_YEAR_OPTIONS = Array.from(
  { length: ACADEMIC_YEAR_END - ACADEMIC_YEAR_START },
  (_, i) => {
    const start = ACADEMIC_YEAR_START + i;
    return `${start}-${start + 1}`;
  }
);

export type ClearanceKind = 'graduation' | 'term' | 'semester';

export function formatClearanceType(kind: ClearanceKind, number?: number): string {
  if (kind === 'graduation') return 'Graduation';
  if (kind === 'term') return `Term ${number ?? 1}`;
  return `Semester ${number ?? 1}`;
}

export function parseClearanceType(
  value: string
): { kind: ClearanceKind; number?: number } | null {
  const v = value.trim();
  if (/^graduation$/i.test(v)) return { kind: 'graduation' };
  const term = /^Term\s+(\d+)$/i.exec(v);
  if (term) {
    const n = Number(term[1]);
    if (n >= 1 && n <= 3) return { kind: 'term', number: n };
  }
  const sem = /^Semester\s+(\d+)$/i.exec(v);
  if (sem) {
    const n = Number(sem[1]);
    if (n >= 1 && n <= 12) return { kind: 'semester', number: n };
  }
  return null;
}

/** Map a calendar date to academic year span YYYY-YYYY (Aug–Jul cycle). */
export function dateToAcademicYear(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth(); // 0–11
  const start = m >= 7 ? y : y - 1;
  const clamped = Math.min(Math.max(start, ACADEMIC_YEAR_START), ACADEMIC_YEAR_END - 1);
  return `${clamped}-${clamped + 1}`;
}
