/** Máscara de telefone BR: (49) 99999-9999 (11 dígitos) ou (49) 9999-9999 (10). */
export function formatBrPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeBrPhone(value: string | null | undefined): string | null {
  if (value == null) return null;
  const d = digitsOnly(value);
  if (!d) return null;
  return d;
}

export function isValidBrPhone(digits: string): boolean {
  return digits.length === 10 || digits.length === 11;
}

/** Máscara de data: 14081990 → 14/08/1990 */
export function formatBrBirthDate(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function parseBrBirthDateToIso(value: string): string | null {
  const d = value.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4, 8));
  if (!isValidCalendarDate(year, month, day)) return null;
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  if (birth > today) return null;
  if (year < 1900) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isoToBrBirthDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return formatBrBirthDate(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function isBirthdayToday(
  iso: string | null | undefined,
  now = new Date()
): boolean {
  if (!iso) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();
  if (month === 2 && day === 29) {
    const isLeap =
      (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) ||
      now.getFullYear() % 400 === 0;
    if (!isLeap) return todayMonth === 2 && todayDay === 28;
  }
  return month === todayMonth && day === todayDay;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}
