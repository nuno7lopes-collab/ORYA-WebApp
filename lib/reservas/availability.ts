type Interval = { startMinute: number; endMinute: number };

export type AvailabilitySlot = {
  startsAt: Date;
  durationMinutes: number;
};

const MINUTES_PER_DAY = 24 * 60;

function clampMinute(value: number) {
  return Math.max(0, Math.min(MINUTES_PER_DAY, value));
}

function parseInterval(raw: any): Interval | null {
  const start = Number(raw?.startMinute);
  const end = Number(raw?.endMinute);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const startMinute = clampMinute(Math.round(start));
  const endMinute = clampMinute(Math.round(end));
  if (endMinute <= startMinute) return null;
  return { startMinute, endMinute };
}

export function normalizeIntervals(raw: unknown): Interval[] {
  if (!Array.isArray(raw)) return [];
  const parsed = raw.map(parseInterval).filter(Boolean) as Interval[];
  if (!parsed.length) return [];
  const sorted = parsed.sort((a, b) => a.startMinute - b.startMinute);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(interval);
      continue;
    }
    if (interval.startMinute <= last.endMinute) {
      last.endMinute = Math.max(last.endMinute, interval.endMinute);
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

function subtractIntervals(base: Interval[], blocks: Interval[]) {
  if (!blocks.length) return base;
  const output: Interval[] = [];
  for (const interval of base) {
    let segments: Interval[] = [interval];
    for (const block of blocks) {
      const next: Interval[] = [];
      for (const seg of segments) {
        if (block.endMinute <= seg.startMinute || block.startMinute >= seg.endMinute) {
          next.push(seg);
          continue;
        }
        if (block.startMinute > seg.startMinute) {
          next.push({ startMinute: seg.startMinute, endMinute: Math.min(block.startMinute, seg.endMinute) });
        }
        if (block.endMinute < seg.endMinute) {
          next.push({ startMinute: Math.max(block.endMinute, seg.startMinute), endMinute: seg.endMinute });
        }
      }
      segments = next;
      if (!segments.length) break;
    }
    output.push(...segments);
  }
  return output.filter((interval) => interval.endMinute > interval.startMinute);
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(map.get("year"));
  const month = Number(map.get("month"));
  const day = Number(map.get("day"));
  const hour = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  const second = Number(map.get("second"));
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return (asUtc - date.getTime()) / 60000;
}

export function makeUtcDateFromLocal(
  params: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
) {
  const utcDate = new Date(Date.UTC(params.year, params.month - 1, params.day, params.hour, params.minute, 0));
  const offsetMinutes = getTimeZoneOffset(utcDate, timeZone);
  return new Date(utcDate.getTime() - offsetMinutes * 60 * 1000);
}

function getDateKey(year: number, month: number, day: number) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function getDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
  };
}

function addDays(parts: { year: number; month: number; day: number }, days: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + days);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

export function resolveIntervalsForDate(params: {
  dayOfWeek: number;
  templatesByDay: Map<number, Interval[]>;
  overrides: Array<{ kind: string; intervals: Interval[] }>;
}) {
  let intervals = params.templatesByDay.get(params.dayOfWeek) ?? [];
  if (!params.overrides.length) return intervals;
  for (const override of params.overrides) {
    if (override.kind === "CLOSED") {
      intervals = [];
      continue;
    }
    if (override.kind === "OPEN") {
      intervals = override.intervals;
      continue;
    }
    if (override.kind === "BLOCK") {
      intervals = subtractIntervals(intervals, override.intervals);
    }
  }
  return intervals;
}

const DEFAULT_SLOT_STEP_MINUTES = 15;

export function buildSlotsForRange(params: {
  rangeStart: Date;
  rangeEnd: Date;
  timezone: string;
  templates: Array<{ dayOfWeek: number; intervals: unknown }>;
  overrides: Array<{ date: Date; kind: string; intervals: unknown }>;
  durationMinutes: number;
  stepMinutes?: number;
  now?: Date;
}) {
  const stepMinutes = params.stepMinutes ?? DEFAULT_SLOT_STEP_MINUTES;
  const now = params.now ?? new Date();
  const templatesByDay = new Map<number, Interval[]>();
  params.templates.forEach((template) => {
    templatesByDay.set(template.dayOfWeek, normalizeIntervals(template.intervals));
  });

  const overridesByDate = new Map<string, Array<{ kind: string; intervals: Interval[] }>>();
  params.overrides.forEach((override) => {
    const keyParts = getDateParts(override.date, params.timezone);
    const key = getDateKey(keyParts.year, keyParts.month, keyParts.day);
    const existing = overridesByDate.get(key) ?? [];
    existing.push({ kind: override.kind, intervals: normalizeIntervals(override.intervals) });
    overridesByDate.set(key, existing);
  });

  const startParts = getDateParts(params.rangeStart, params.timezone);
  const endParts = getDateParts(params.rangeEnd, params.timezone);
  const slots: AvailabilitySlot[] = [];
  let current = { ...startParts };
  const endKey = getDateKey(endParts.year, endParts.month, endParts.day);

  while (true) {
    const key = getDateKey(current.year, current.month, current.day);
    const dayOfWeek = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
    const overrides = overridesByDate.get(key) ?? [];
    const intervals = resolveIntervalsForDate({ dayOfWeek, templatesByDay, overrides });
    if (intervals.length) {
      for (const interval of intervals) {
        for (let minute = interval.startMinute; minute + params.durationMinutes <= interval.endMinute; minute += stepMinutes) {
          const hour = Math.floor(minute / 60);
          const minuteOfHour = minute % 60;
          const slotDate = makeUtcDateFromLocal(
            { year: current.year, month: current.month, day: current.day, hour, minute: minuteOfHour },
            params.timezone,
          );
          if (slotDate < params.rangeStart || slotDate > params.rangeEnd) continue;
          if (slotDate <= now) continue;
          slots.push({ startsAt: slotDate, durationMinutes: params.durationMinutes });
        }
      }
    }
    if (key === endKey) break;
    current = addDays(current, 1);
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function findNextSlot(slots: AvailabilitySlot[]) {
  if (!slots.length) return null;
  return slots[0];
}
