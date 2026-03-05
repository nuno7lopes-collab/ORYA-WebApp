import type { BookingItem } from "../bookings/types";

export type GreetingPeriod = "morning" | "afternoon" | "evening";

export const resolveFirstName = (value?: string | null) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const [first] = normalized.split(/\s+/);
  return first || null;
};

export const resolveGreetingPeriod = (date: Date): GreetingPeriod => {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 19) return "afternoon";
  return "evening";
};

export const resolveBookingTitle = (booking: BookingItem | null) =>
  booking?.service?.title?.trim() || null;

export const resolveBookingOrganization = (booking: BookingItem | null) =>
  booking?.organization?.publicName?.trim() ||
  booking?.organization?.businessName?.trim() ||
  booking?.organization?.username?.trim() ||
  null;

export const formatBookingDateTime = (value?: string | null, locale = "pt-PT") => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export type RelativeDayMeta =
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "inDays"; count: number };

export const resolveRelativeDayMeta = (
  value?: string | null,
  nowDate: Date = new Date(),
): RelativeDayMeta | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const startOfToday = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime();
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  const diffDays = Math.round((startOfDate - startOfToday) / 86_400_000);
  if (diffDays === 0) return { kind: "today" };
  if (diffDays === 1) return { kind: "tomorrow" };
  if (diffDays > 1 && diffDays < 7) return { kind: "inDays", count: diffDays };
  return null;
};
