/** Allowed banks for payments and statements */
export const BANKS = [
  { value: 'Zanaco Bank', label: 'Zanaco Bank' },
  { value: 'ABSA Bank', label: 'ABSA Bank' },
] as const;

export const BANK_VALUES = BANKS.map((b) => b.value);

/** OCR / batch template hints (lowercase ids) */
export const BANK_TEMPLATES = [
  { value: 'zanaco', label: 'Zanaco Bank' },
  { value: 'absa', label: 'ABSA Bank' },
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
