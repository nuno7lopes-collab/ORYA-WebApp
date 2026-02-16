import type { AgendaItem } from "./types";

const TERMINAL_BOOKING_STATUSES = new Set([
  "CANCELLED",
  "CANCELLED_BY_CLIENT",
  "CANCELLED_BY_ORG",
  "COMPLETED",
  "NO_SHOW",
]);

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const isBookingHistory = (item: AgendaItem) =>
  item.type === "RESERVA" &&
  typeof item.status === "string" &&
  TERMINAL_BOOKING_STATUSES.has(item.status.toUpperCase());

export const splitAgendaTimeline = (items: AgendaItem[], nowDate: Date = new Date()) => {
  const now = nowDate.getTime();
  const active: AgendaItem[] = [];
  const history: AgendaItem[] = [];

  items.forEach((item) => {
    const timestamp = toTimestamp(item.startAt);
    const inHistory = isBookingHistory(item) || !Number.isFinite(timestamp) || timestamp < now;
    if (inHistory) {
      history.push(item);
      return;
    }
    active.push(item);
  });

  active.sort((a, b) => toTimestamp(a.startAt) - toTimestamp(b.startAt));
  history.sort((a, b) => toTimestamp(b.startAt) - toTimestamp(a.startAt));

  return { active, history };
};
