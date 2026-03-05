import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";

const DAY_MINUTES = 24 * 60;

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !json) {
    const message =
      typeof (json as { message?: string } | null)?.message === "string"
        ? (json as { message: string }).message
        : `Falha ao carregar dados (${response.status})`;
    throw new Error(message);
  }
  return json;
}

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function parseIdList(raw: string | null) {
  if (!raw) return [];
  const deduped = new Set<number>();
  raw
    .split(",")
    .map((part) => Number(part.trim()))
    .forEach((id) => {
      if (Number.isFinite(id) && id > 0) deduped.add(id);
    });
  return [...deduped].sort((a, b) => a - b);
}

export function setIdListParam(params: URLSearchParams, key: string, ids: number[]) {
  if (ids.length === 0) {
    params.delete(key);
    return;
  }
  params.set(key, ids.join(","));
}

export function buildZonedDate(
  parts: { year: number; month: number; day: number },
  timezone: string,
  hour = 0,
  minute = 0,
) {
  return makeUtcDateFromLocal({ ...parts, hour, minute }, timezone);
}

function addDaysToParts(parts: { year: number; month: number; day: number }, amount: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + amount);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

export function addMonthsToParts(parts: { year: number; month: number }, amount: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + amount);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 };
}

export function addDays(date: Date, amount: number, timezone: string) {
  const parts = getDateParts(date, timezone);
  return buildZonedDate(addDaysToParts(parts, amount), timezone, 12, 0);
}

export function parseDateParam(raw: string | null, timezone: string): Date | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const candidate = buildZonedDate({ year, month, day }, timezone, 12, 0);
  const resolved = getDateParts(candidate, timezone);
  if (resolved.year !== year || resolved.month !== month || resolved.day !== day) return null;
  return candidate;
}

export function formatDateParam(date: Date, timezone: string) {
  const parts = getDateParts(date, timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function getDayKey(date: Date, timezone: string) {
  const parts = getDateParts(date, timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function isSameDay(a: Date, b: Date, timezone: string) {
  const aa = getDateParts(a, timezone);
  const bb = getDateParts(b, timezone);
  return aa.year === bb.year && aa.month === bb.month && aa.day === bb.day;
}

export function getTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return { hour: Number(map.get("hour") || 0), minute: Number(map.get("minute") || 0) };
}

export function formatMonthLabel(parts: { year: number; month: number }) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  return new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function buildMonthCells(parts: { year: number; month: number }) {
  const firstDay = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  const daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  const mondayBasedOffset = (firstDay.getUTCDay() + 6) % 7;
  const cells: Array<{ year: number; month: number; day: number } | null> = [];
  for (let index = 0; index < mondayBasedOffset; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ year: parts.year, month: parts.month, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const rows: Array<Array<{ year: number; month: number; day: number } | null>> = [];
  for (let offset = 0; offset < cells.length; offset += 7) {
    rows.push(cells.slice(offset, offset + 7));
  }
  return rows;
}

function clampMinute(value: number) {
  return Math.max(0, Math.min(DAY_MINUTES, value));
}

function getMinuteOfDay(date: Date, timezone: string) {
  const parts = getTimeParts(date, timezone);
  return parts.hour * 60 + parts.minute;
}

export type ProjectedDayEvent<T extends { startsAt: string; endsAt: string }> = {
  event: T;
  start: Date;
  end: Date;
  startMinute: number;
  endMinute: number;
};

export function buildProjectedEvents<T extends { startsAt: string; endsAt: string }>(params: {
  events: T[];
  day: Date;
  timezone: string;
}) {
  const dayStart = buildZonedDate(getDateParts(params.day, params.timezone), params.timezone, 0, 0);
  const dayEnd = addDays(dayStart, 1, params.timezone);

  const projected = params.events
    .map((event) => {
      const rawStart = new Date(event.startsAt);
      const rawEnd = new Date(event.endsAt);
      if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) return null;
      if (rawEnd <= dayStart || rawStart >= dayEnd) return null;

      const clampedStart = new Date(Math.max(rawStart.getTime(), dayStart.getTime()));
      const clampedEnd = new Date(Math.min(rawEnd.getTime(), dayEnd.getTime()));
      const startMinute = clampMinute(getMinuteOfDay(clampedStart, params.timezone));
      const endMinute = clampMinute(getMinuteOfDay(clampedEnd, params.timezone));
      if (endMinute <= startMinute) return null;

      return {
        event,
        start: clampedStart,
        end: clampedEnd,
        startMinute,
        endMinute,
      };
    })
    .filter(Boolean) as ProjectedDayEvent<T>[];

  return projected.sort((left, right) => {
    if (left.startMinute !== right.startMinute) return left.startMinute - right.startMinute;
    return left.endMinute - right.endMinute;
  });
}
