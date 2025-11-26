// lib/events.ts
import type { Event, TicketType } from "@prisma/client";

type EventLike = {
  startsAt: Date | string;
  endsAt?: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

export function isPast(event: EventLike | Event): boolean {
  const end = "endsAt" in event && event.endsAt ? toDate(event.endsAt) : toDate(event.startsAt);
  if (!end) return false;

  return end.getTime() < Date.now();
}

export function isToday(event: EventLike | Event): boolean {
  const start = toDate(event.startsAt);
  if (!start) return false;

  const now = new Date();
  return (
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  );
}

export function formatEventDateTime(
  event: EventLike | Event,
  locale: string = "pt-PT"
): string {
  const start = toDate(event.startsAt);
  const end =
    "endsAt" in event && event.endsAt ? toDate(event.endsAt) : null;

  if (!start) return "";

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const datePart = dateFormatter.format(start);
  const startTime = timeFormatter.format(start);

  if (end && start.toDateString() === end.toDateString()) {
    const endTime = timeFormatter.format(end);
    return `${datePart}, ${startTime}–${endTime}`;
  }

  return `${datePart}, ${startTime}`;
}

export type EventCardDTO = {
  id: number;
  slug: string;
  title: string;
  description: string;
  type: Event["type"];
  startsAt: Date | null;
  endsAt: Date | null;
  locationName: string | null;
  locationCity: string | null;
  isFree: boolean;
  priceFrom: number | null;
};

/**
 * Mapeia um Event (com ticketTypes) para o formato usado nos cards da home.
 */
export function mapEventToCardDTO(
  event: (Event & { ticketTypes?: TicketType[] | null }) | null
): EventCardDTO | null {
  if (!event) return null;

  let priceFrom: number | null = null;

  if (event.ticketTypes && event.ticketTypes.length > 0) {
    const prices = event.ticketTypes
      .filter((tt) => typeof tt.price === "number")
      .map((tt) => tt.price as number);

    if (prices.length > 0) {
      priceFrom = Math.min(...prices);
    }
  }

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    locationName: event.locationName,
    locationCity: event.locationCity,
    isFree: event.isFree,
    priceFrom,
    type: event.type,
  };
}
