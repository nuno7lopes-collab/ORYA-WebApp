type Interval = { startMinute: number; endMinute: number };

export type AvailabilitySlot = {
  startsAt: Date;
  durationMinutes: number;
};

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_OPEN_WEEKDAY_INTERVAL: Interval = { startMinute: 8 * 60, endMinute: 17 * 60 };

function clampMinute(value: number) {
  return Math.max(0, Math.min(MINUTES_PER_DAY, value));
}

function getDefaultTemplateIntervals(dayOfWeek: number): Interval[] {
  if (dayOfWeek === 0 || dayOfWeek === 6) return [];
  return [{ ...DEFAULT_OPEN_WEEKDAY_INTERVAL }];
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
  // In some ICU/locale combinations midnight is emitted as 24:xx.
  // Treat it as 00:xx on the same day to avoid date drift.
  const rawHour = Number(map.get("hour"));
  const hour = rawHour === 24 ? 0 : rawHour;
  const minute = Number(map.get("minute"));
  const second = Number(map.get("second"));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return 0;
  }
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

function getDateKeyFromDate(date: Date) {
  return getDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
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

export type AvailabilitySchedule = {
  id: number;
  scopeType?: string;
  scopeId?: number;
  startDate: Date;
  endDate?: Date | null;
  createdAt?: Date;
};

export type ScheduleTemplate = {
  availabilityId: number;
  dayOfWeek: number;
  intervals: unknown;
};

export type ScheduleOverride = {
  date: Date;
  kind: string;
  intervals: unknown;
};

function scheduleStartKey(schedule: AvailabilitySchedule) {
  return getDateKeyFromDate(schedule.startDate);
}

function scheduleEndKey(schedule: AvailabilitySchedule) {
  if (!schedule.endDate) return null;
  return getDateKeyFromDate(schedule.endDate);
}

export function resolveScheduleForDate(
  schedules: AvailabilitySchedule[],
  date: Date,
  timeZone: string,
) {
  if (!schedules.length) return null;
  const dateParts = getDateParts(date, timeZone);
  const targetKey = getDateKey(dateParts.year, dateParts.month, dateParts.day);
  let selected: AvailabilitySchedule | null = null;
  let selectedKey: string | null = null;
  let selectedCreatedAt = 0;
  for (const schedule of schedules) {
    const startKey = scheduleStartKey(schedule);
    if (targetKey < startKey) continue;
    const endKey = scheduleEndKey(schedule);
    if (endKey && targetKey > endKey) continue;
    const createdAt = schedule.createdAt ? schedule.createdAt.getTime() : 0;
    if (!selected || startKey > (selectedKey ?? "") || (startKey === selectedKey && createdAt > selectedCreatedAt)) {
      selected = schedule;
      selectedKey = startKey;
      selectedCreatedAt = createdAt;
    }
  }
  return selected;
}

export function resolveIntervalsForDate(params: {
  dayOfWeek: number;
  templatesByDay: Map<number, Interval[]>;
  overrides: Array<{ kind: string; intervals: Interval[] }>;
  fallbackToDefault?: boolean;
}) {
  const fallbackToDefault = params.fallbackToDefault !== false;
  let intervals = params.templatesByDay.has(params.dayOfWeek)
    ? params.templatesByDay.get(params.dayOfWeek) ?? []
    : fallbackToDefault
      ? getDefaultTemplateIntervals(params.dayOfWeek)
      : [];
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

const DEFAULT_SLOT_STEP_MINUTES = 5;

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
    const key = getDateKeyFromDate(override.date);
    const existing = overridesByDate.get(key) ?? [];
    existing.push({ kind: override.kind, intervals: normalizeIntervals(override.intervals) });
    overridesByDate.set(key, existing);
  });

  const startParts = getDateParts(params.rangeStart, params.timezone);
  const endParts = getDateParts(params.rangeEnd, params.timezone);
  const startDayUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endDayUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  if (
    !Number.isFinite(startDayUtc) ||
    !Number.isFinite(endDayUtc) ||
    endDayUtc < startDayUtc
  ) {
    return [];
  }
  const slots: AvailabilitySlot[] = [];
  for (
    let currentDayUtc = startDayUtc;
    currentDayUtc <= endDayUtc;
    currentDayUtc += 24 * 60 * 60 * 1000
  ) {
    const cursor = new Date(currentDayUtc);
    const current = {
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate(),
    };
    const key = getDateKey(current.year, current.month, current.day);
    const dayOfWeek = cursor.getUTCDay();
    const overrides = overridesByDate.get(key) ?? [];
    const intervals = resolveIntervalsForDate({ dayOfWeek, templatesByDay, overrides, fallbackToDefault: true });
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
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function buildSlotsForRangeWithSchedules(params: {
  rangeStart: Date;
  rangeEnd: Date;
  timezone: string;
  primarySchedules: AvailabilitySchedule[];
  fallbackSchedules?: AvailabilitySchedule[];
  templates: ScheduleTemplate[];
  overrides: ScheduleOverride[];
  durationMinutes: number;
  stepMinutes?: number;
  now?: Date;
}) {
  const stepMinutes = params.stepMinutes ?? DEFAULT_SLOT_STEP_MINUTES;
  const now = params.now ?? new Date();
  const templatesBySchedule = new Map<number, Map<number, Interval[]>>();
  params.templates.forEach((template) => {
    if (!Number.isFinite(template.availabilityId)) return;
    const byDay = templatesBySchedule.get(template.availabilityId) ?? new Map<number, Interval[]>();
    byDay.set(template.dayOfWeek, normalizeIntervals(template.intervals));
    templatesBySchedule.set(template.availabilityId, byDay);
  });

  const overridesByDate = new Map<string, Array<{ kind: string; intervals: Interval[] }>>();
  params.overrides.forEach((override) => {
    const key = getDateKeyFromDate(override.date);
    const existing = overridesByDate.get(key) ?? [];
    existing.push({ kind: override.kind, intervals: normalizeIntervals(override.intervals) });
    overridesByDate.set(key, existing);
  });

  const startParts = getDateParts(params.rangeStart, params.timezone);
  const endParts = getDateParts(params.rangeEnd, params.timezone);
  const startDayUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endDayUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  if (!Number.isFinite(startDayUtc) || !Number.isFinite(endDayUtc) || endDayUtc < startDayUtc) {
    return [];
  }

  const slots: AvailabilitySlot[] = [];
  const fallbackSchedules = params.fallbackSchedules ?? [];
  for (let currentDayUtc = startDayUtc; currentDayUtc <= endDayUtc; currentDayUtc += 24 * 60 * 60 * 1000) {
    const cursor = new Date(currentDayUtc);
    const current = {
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate(),
    };
    const key = getDateKey(current.year, current.month, current.day);
    const dayOfWeek = cursor.getUTCDay();

    const schedule =
      resolveScheduleForDate(params.primarySchedules, cursor, params.timezone) ??
      resolveScheduleForDate(fallbackSchedules, cursor, params.timezone);
    const templatesByDay = schedule ? templatesBySchedule.get(schedule.id) ?? new Map() : new Map();
    const overrides = overridesByDate.get(key) ?? [];
    const intervals = resolveIntervalsForDate({
      dayOfWeek,
      templatesByDay,
      overrides,
      fallbackToDefault: !schedule,
    });

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
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function findNextSlot(slots: AvailabilitySlot[]) {
  if (!slots.length) return null;
  return slots[0];
}
