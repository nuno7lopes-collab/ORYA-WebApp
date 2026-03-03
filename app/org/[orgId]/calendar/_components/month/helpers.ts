import {
  addDays,
  buildMonthCells,
  buildZonedDate,
  getDayKey,
} from "../day/helpers";
import type { AgendaItem } from "../day/types";

export type MonthParts = {
  year: number;
  month: number;
};

export function buildMonthGridWindow(parts: MonthParts, timezone: string) {
  const rows = buildMonthCells(parts);
  const firstDay = buildZonedDate({ year: parts.year, month: parts.month, day: 1 }, timezone, 0, 0);
  const firstWeekdayUtc = new Date(Date.UTC(parts.year, parts.month - 1, 1)).getUTCDay();
  const mondayOffset = (firstWeekdayUtc + 6) % 7;
  const gridStart = addDays(firstDay, -mondayOffset, timezone);
  const totalCells = rows.length * 7;
  const gridEndExclusive = addDays(gridStart, totalCells, timezone);
  return { rows, gridStart, gridEndExclusive };
}

export function getEventsForDay(events: AgendaItem[], day: Date, timezone: string) {
  const parseKey = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return { year, month, day };
  };
  const dayStart = buildZonedDate(parseKey(getDayKey(day, timezone)), timezone, 0, 0);
  const nextDay = addDays(dayStart, 1, timezone);
  const dayEndExclusive = buildZonedDate(parseKey(getDayKey(nextDay, timezone)), timezone, 0, 0);
  return events.filter((item) => {
    const startsAt = new Date(item.startsAt);
    const endsAt = new Date(item.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return false;
    return startsAt.getTime() < dayEndExclusive.getTime() && endsAt.getTime() > dayStart.getTime();
  });
}
