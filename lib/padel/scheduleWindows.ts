export type PadelDailyWindow = {
  date: string;
  startTime: string;
  endTime: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function isValidDateToken(value: string) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTimeToken(value: string) {
  if (!TIME_RE.test(value)) return false;
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  return Number.isFinite(hours) && Number.isFinite(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function parseDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizePadelDailyWindows(input: unknown): PadelDailyWindow[] {
  if (!Array.isArray(input)) return [];

  const normalized: PadelDailyWindow[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const date = typeof row.date === "string" ? row.date.trim() : "";
    const startTime = typeof row.startTime === "string" ? row.startTime.trim() : "";
    const endTime = typeof row.endTime === "string" ? row.endTime.trim() : "";
    if (!isValidDateToken(date) || !isValidTimeToken(startTime) || !isValidTimeToken(endTime)) continue;

    const start = parseDateTime(date, startTime);
    const end = parseDateTime(date, endTime);
    if (!start || !end || end <= start) continue;

    normalized.push({ date, startTime, endTime });
  }

  normalized.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    return a.endTime.localeCompare(b.endTime);
  });

  return normalized;
}

export function deriveEnvelopeFromDailyWindows(dailyWindows: PadelDailyWindow[]) {
  const intervals = dailyWindows
    .map((window) => {
      const start = parseDateTime(window.date, window.startTime);
      const end = parseDateTime(window.date, window.endTime);
      if (!start || !end || end <= start) return null;
      return { start, end };
    })
    .filter((entry): entry is { start: Date; end: Date } => Boolean(entry));

  if (intervals.length === 0) {
    return { windowStart: null as string | null, windowEnd: null as string | null };
  }

  let minStart = intervals[0].start;
  let maxEnd = intervals[0].end;
  for (const interval of intervals) {
    if (interval.start < minStart) minStart = interval.start;
    if (interval.end > maxEnd) maxEnd = interval.end;
  }

  return { windowStart: minStart.toISOString(), windowEnd: maxEnd.toISOString() };
}

export function dailyWindowsToIntervals(dailyWindows: PadelDailyWindow[]) {
  return dailyWindows
    .map((window) => {
      const start = parseDateTime(window.date, window.startTime);
      const end = parseDateTime(window.date, window.endTime);
      if (!start || !end || end <= start) return null;
      return { start, end };
    })
    .filter((entry): entry is { start: Date; end: Date } => Boolean(entry))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
