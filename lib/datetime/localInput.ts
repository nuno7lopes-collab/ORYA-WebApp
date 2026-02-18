const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_RE = /^\d{2}:\d{2}$/;
const LOCAL_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function isValidLocalDate(value: string | null | undefined) {
  if (!value || !LOCAL_DATE_RE.test(value)) return false;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const candidate = new Date(year, month - 1, day);
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day;
}

export function isValidLocalTime(value: string | null | undefined) {
  if (!value || !LOCAL_TIME_RE.test(value)) return false;
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function isValidLocalDateTime(value: string | null | undefined) {
  if (!value || !LOCAL_DATE_TIME_RE.test(value)) return false;
  const [datePart, timePart] = value.split("T");
  return isValidLocalDate(datePart) && isValidLocalTime(timePart);
}

export function splitLocalDateTime(value: string | null | undefined): { date: string; time: string } {
  if (!value || !isValidLocalDateTime(value)) {
    return { date: "", time: "" };
  }
  const [date, time] = value.split("T");
  return { date, time };
}

export function joinLocalDateTime(date: string | null | undefined, time: string | null | undefined) {
  if (!isValidLocalDate(date ?? "") || !isValidLocalTime(time ?? "")) return "";
  return `${date}T${time}`;
}

export function isoToLocalInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function localInputToIso(value: string | null | undefined) {
  if (!value || !isValidLocalDateTime(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function compareLocalDate(left: string, right: string) {
  if (!isValidLocalDate(left) || !isValidLocalDate(right)) return 0;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function compareLocalTime(left: string, right: string) {
  if (!isValidLocalTime(left) || !isValidLocalTime(right)) return 0;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function clampLocalDate(value: string, minDate?: string, maxDate?: string) {
  if (!isValidLocalDate(value)) return "";
  if (minDate && isValidLocalDate(minDate) && compareLocalDate(value, minDate) < 0) return minDate;
  if (maxDate && isValidLocalDate(maxDate) && compareLocalDate(value, maxDate) > 0) return maxDate;
  return value;
}

export function clampLocalTime(value: string, minTime?: string, maxTime?: string) {
  if (!isValidLocalTime(value)) return "";
  if (minTime && isValidLocalTime(minTime) && compareLocalTime(value, minTime) < 0) return minTime;
  if (maxTime && isValidLocalTime(maxTime) && compareLocalTime(value, maxTime) > 0) return maxTime;
  return value;
}

export function floorTimeToStep(value: string, stepMinutes: number) {
  if (!isValidLocalTime(value)) return "";
  const safeStep = Math.max(1, stepMinutes);
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const minutesOfDay = hour * 60 + minute;
  const floored = Math.floor(minutesOfDay / safeStep) * safeStep;
  const nextHour = Math.floor(floored / 60);
  const nextMinute = floored % 60;
  return `${pad2(nextHour)}:${pad2(nextMinute)}`;
}

export function ceilTimeToStep(value: string, stepMinutes: number) {
  if (!isValidLocalTime(value)) return "";
  const safeStep = Math.max(1, stepMinutes);
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const minutesOfDay = hour * 60 + minute;
  const ceiled = Math.min(24 * 60 - 1, Math.ceil(minutesOfDay / safeStep) * safeStep);
  const nextHour = Math.floor(ceiled / 60);
  const nextMinute = ceiled % 60;
  return `${pad2(nextHour)}:${pad2(nextMinute)}`;
}

export function buildTimeOptions(stepMinutes: number) {
  const safeStep = Math.max(1, stepMinutes);
  const list: string[] = [];
  for (let minute = 0; minute < 24 * 60; minute += safeStep) {
    const hour = Math.floor(minute / 60);
    const mins = minute % 60;
    list.push(`${pad2(hour)}:${pad2(mins)}`);
  }
  return list;
}

export function addDaysToLocalDate(value: string, amount: number) {
  if (!isValidLocalDate(value)) return value;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function addMonthsToLocalDate(value: string, amount: number) {
  if (!isValidLocalDate(value)) return value;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
  date.setMonth(date.getMonth() + amount);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function startOfWeekLocalDate(value: string) {
  if (!isValidLocalDate(value)) return value;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function endOfWeekLocalDate(value: string) {
  return addDaysToLocalDate(startOfWeekLocalDate(value), 6);
}

export function formatLocalDateLabel(value: string) {
  if (!isValidLocalDate(value)) return "";
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatLocalDateLong(value: string) {
  if (!isValidLocalDate(value)) return "";
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function normalizeStepMinutes(value: number | null | undefined): 5 | 10 | 15 | 30 {
  if (value === 5 || value === 10 || value === 15 || value === 30) return value;
  return 15;
}
