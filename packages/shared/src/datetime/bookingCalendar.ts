export type IsoDateParts = { year: number; month: number; day: number };
export type IsoYearMonth = { year: number; month: number };

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/;

function isValidDateParts(parts: IsoDateParts) {
  if (!Number.isInteger(parts.year) || !Number.isInteger(parts.month) || !Number.isInteger(parts.day)) return false;
  if (parts.month < 1 || parts.month > 12) return false;
  if (parts.day < 1 || parts.day > 31) return false;
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (
    utc.getUTCFullYear() === parts.year &&
    utc.getUTCMonth() + 1 === parts.month &&
    utc.getUTCDate() === parts.day
  );
}

function isValidYearMonth(parts: IsoYearMonth) {
  if (!Number.isInteger(parts.year) || !Number.isInteger(parts.month)) return false;
  return parts.month >= 1 && parts.month <= 12;
}

export function parseIsoDateStrict(value: string | null | undefined): IsoDateParts | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = ISO_DATE_RE.exec(trimmed);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  return isValidDateParts(parts) ? parts : null;
}

export function parseIsoYearMonthStrict(value: string | null | undefined): IsoYearMonth | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = ISO_YEAR_MONTH_RE.exec(trimmed);
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
  };
  return isValidYearMonth(parts) ? parts : null;
}

export function formatIsoDate(parts: IsoDateParts): string {
  if (!isValidDateParts(parts)) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function formatIsoYearMonth(parts: IsoYearMonth): string {
  if (!isValidYearMonth(parts)) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export function addMonthsToIsoYearMonth(value: string, deltaMonths: number): string | null {
  const parsed = parseIsoYearMonthStrict(value);
  if (!parsed || !Number.isInteger(deltaMonths)) return null;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + deltaMonths);
  return formatIsoYearMonth({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
}

export function monthKeyFromIsoYearMonth(value: string): number | null {
  const parsed = parseIsoYearMonthStrict(value);
  if (!parsed) return null;
  return parsed.year * 12 + (parsed.month - 1);
}

export function formatIsoDateLabel(
  value: string,
  options?: {
    locale?: string;
    weekday?: "long" | "short" | "narrow";
    month?: "long" | "short" | "narrow" | "2-digit" | "numeric";
    day?: "2-digit" | "numeric";
  },
): string {
  const parsed = parseIsoDateStrict(value);
  if (!parsed) return value;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0));
  return date.toLocaleDateString(options?.locale ?? "pt-PT", {
    weekday: options?.weekday ?? "short",
    month: options?.month ?? "short",
    day: options?.day ?? "2-digit",
    timeZone: "UTC",
  });
}

export function formatIsoYearMonthLabel(
  value: string,
  options?: { locale?: string; month?: "long" | "short" | "narrow"; year?: "numeric" | "2-digit" },
): string {
  const parsed = parseIsoYearMonthStrict(value);
  if (!parsed) return value;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, 1, 0, 0, 0));
  return date.toLocaleDateString(options?.locale ?? "pt-PT", {
    month: options?.month ?? "long",
    year: options?.year ?? "numeric",
    timeZone: "UTC",
  });
}

export function getIsoDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = map.get("year");
  const month = map.get("month");
  const day = map.get("day");
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

export function getIsoYearMonthInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = map.get("year");
  const month = map.get("month");
  if (!year || !month) return "";
  return `${year}-${month}`;
}
