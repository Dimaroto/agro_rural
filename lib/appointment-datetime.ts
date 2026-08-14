import {
  formatBrBirthDate,
  isValidCalendarDate,
} from "@/lib/br-contact";

export const APPOINTMENT_TZ = "America/Sao_Paulo";

export type AppointmentRange = "today" | "upcoming" | "all";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function zonedParts(date: Date, timeZone = APPOINTMENT_TZ): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Interpreta data/hora civil em America/Sao_Paulo e devolve Instant UTC. */
export function dateFromSaoPaulo(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  const shown = zonedParts(new Date(utc));
  const asUtc = Date.UTC(
    shown.year,
    shown.month - 1,
    shown.day,
    shown.hour,
    shown.minute,
    0
  );
  return new Date(utc - (asUtc - utc));
}

export function startOfSaoPauloDay(date = new Date()): Date {
  const p = zonedParts(date);
  return dateFromSaoPaulo(p.year, p.month, p.day, 0, 0, 0);
}

export function startOfNextSaoPauloDay(date = new Date()): Date {
  const p = zonedParts(date);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return dateFromSaoPaulo(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    0
  );
}

export function formatBrTime(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function parseBrTime(
  value: string
): { hour: number; minute: number } | null {
  const d = value.replace(/\D/g, "");
  if (d.length !== 4) return null;
  const hour = Number(d.slice(0, 2));
  const minute = Number(d.slice(2, 4));
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }
  return { hour, minute };
}

export function parseBrDateParts(
  value: string
): { year: number; month: number; day: number } | null {
  const d = value.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const day = Number(d.slice(0, 2));
  const month = Number(d.slice(2, 4));
  const year = Number(d.slice(4, 8));
  if (!isValidCalendarDate(year, month, day)) return null;
  if (year < 2000 || year > 2100) return null;
  return { year, month, day };
}

export function parseAppointmentStartsAt(
  dateMasked: string,
  timeMasked: string
): Date | null {
  const date = parseBrDateParts(dateMasked);
  const time = parseBrTime(timeMasked);
  if (!date || !time) return null;
  return dateFromSaoPaulo(
    date.year,
    date.month,
    date.day,
    time.hour,
    time.minute,
    0
  );
}

export function formatAppointmentDate(date: Date): string {
  const p = zonedParts(date);
  return `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}/${p.year}`;
}

export function formatAppointmentTime(date: Date): string {
  const p = zonedParts(date);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function formatAppointmentDateTime(date: Date): string {
  return `${formatAppointmentDate(date)} ${formatAppointmentTime(date)}`;
}

export function isoDateFromMasked(masked: string): string {
  const p = parseBrDateParts(masked);
  if (!p) return "";
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function maskedDateFromIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return formatBrBirthDate(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function isoTimeFromMasked(masked: string): string {
  const t = parseBrTime(masked);
  if (!t) return "";
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

export function rangeBounds(range: AppointmentRange, now = new Date()) {
  const todayStart = startOfSaoPauloDay(now);
  const tomorrowStart = startOfNextSaoPauloDay(now);
  if (range === "today") {
    return { gte: todayStart, lt: tomorrowStart };
  }
  if (range === "upcoming") {
    return { gte: tomorrowStart, lt: undefined as Date | undefined };
  }
  return { gte: undefined as Date | undefined, lt: undefined as Date | undefined };
}
