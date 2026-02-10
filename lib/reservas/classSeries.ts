import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";

type DateParts = { year: number; month: number; day: number };

type BuildSeriesParams = {
  timezone: string;
  dayOfWeek: number;
  startMinute: number;
  durationMinutes: number;
  validFrom: Date;
  validUntil?: Date | null;
  limitYears?: number;
  startFromToday?: boolean;
};

type ClassSessionDraft = {
  startsAt: Date;
  endsAt: Date;
};

function addDays(parts: DateParts, days: number): DateParts {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + days);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

function compareParts(a: DateParts, b: DateParts) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function maxParts(a: DateParts, b: DateParts) {
  return compareParts(a, b) >= 0 ? a : b;
}

function minParts(a: DateParts, b: DateParts) {
  return compareParts(a, b) <= 0 ? a : b;
}

function endOfYearPlus(params: { timezone: string; yearsAhead: number }) {
  const nowParts = getDateParts(new Date(), params.timezone);
  return { year: nowParts.year + params.yearsAhead, month: 12, day: 31 } as DateParts;
}

export function buildClassSessionsForSeries(params: BuildSeriesParams): ClassSessionDraft[] {
  const limitYears = Number.isFinite(params.limitYears) ? Math.max(0, Math.round(params.limitYears ?? 0)) : 2;
  const startParts = getDateParts(params.validFrom, params.timezone);
  const endPartsCandidate = params.validUntil ? getDateParts(params.validUntil, params.timezone) : null;
  const limitParts = endOfYearPlus({ timezone: params.timezone, yearsAhead: limitYears });
  const endParts = endPartsCandidate ? minParts(endPartsCandidate, limitParts) : limitParts;
  const todayParts = getDateParts(new Date(), params.timezone);
  const rangeStart = params.startFromToday ? maxParts(startParts, todayParts) : startParts;

  if (compareParts(rangeStart, endParts) > 0) return [];

  const sessions: ClassSessionDraft[] = [];
  let current = { ...rangeStart };

  while (true) {
    const weekday = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
    if (weekday === params.dayOfWeek) {
      const hour = Math.floor(params.startMinute / 60);
      const minute = params.startMinute % 60;
      const startsAt = makeUtcDateFromLocal(
        { year: current.year, month: current.month, day: current.day, hour, minute },
        params.timezone,
      );
      const endsAt = new Date(startsAt.getTime() + params.durationMinutes * 60 * 1000);
      sessions.push({ startsAt, endsAt });
    }

    if (compareParts(current, endParts) >= 0) break;
    current = addDays(current, 1);
  }

  return sessions;
}
