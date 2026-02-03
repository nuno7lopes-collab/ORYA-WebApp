// lib/events.ts
import type { Event, TicketType } from "@prisma/client";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";

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
  startsAt: Date | null;
  endsAt: Date | null;
  locationCity: string | null;
  isGratis: boolean;
  priceFrom: number | null;
  coverImageUrl: string | null;
};

/**
 * Mapeia um Event (com ticketTypes) para o formato usado nos cards da home.
 */
export function mapEventToCardDTO(
  event:
    | (Partial<Event> & { ticketTypes?: (Partial<TicketType> | null)[] | null })
    | null
): EventCardDTO | null {
  if (!event) return null;

  if (
    typeof event.id !== "number" ||
    typeof event.slug !== "string" ||
    typeof event.title !== "string"
  ) {
    return null;
  }

  let priceFrom: number | null = null;
  const ticketPrices = event.ticketTypes
    ? event.ticketTypes
        .filter((tt): tt is { price: number } => Boolean(tt) && typeof tt?.price === "number")
        .map((tt) => tt.price)
    : [];

  if (ticketPrices.length > 0) {
    priceFrom = Math.min(...ticketPrices);
  }

  const isGratis =
    Boolean(event.isFree) ||
    deriveIsFreeEvent({
      pricingMode: event.pricingMode ?? undefined,
      ticketPrices,
    });

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt ?? null,
    endsAt: event.endsAt ?? null,
    locationCity: event.locationCity ?? null,
    isGratis,
    priceFrom: priceFrom !== null ? priceFrom / 100 : null,
    coverImageUrl: event.coverImageUrl ?? null,
  };
}
