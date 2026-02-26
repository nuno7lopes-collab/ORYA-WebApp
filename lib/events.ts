// lib/events.ts
import type { Event, TicketType } from "@prisma/client";
import { resolveTicketPricingSummary } from "@/domain/events/ticketPricing";
import type { Prisma } from "@prisma/client";

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
  locationFormattedAddress: string | null;
  isGratis: boolean;
  priceFrom: number | null;
  coverImageUrl: string | null;
};

/**
 * Mapeia um Event (com ticketTypes) para o formato usado nos cards da home.
 */
export function mapEventToCardDTO(
  event:
    | (Partial<Event> & {
        ticketTypes?: (Partial<TicketType> | null)[] | null;
        addressRef?: { formattedAddress?: string | null; canonical?: Prisma.JsonValue | null } | null;
      })
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

  const pricing = resolveTicketPricingSummary({
    pricingMode: event.pricingMode ?? undefined,
    ticketTypes: (event.ticketTypes ?? []).reduce<
      Array<{
        price: number | null;
        currency: string | null;
        status: string | null;
        totalQuantity: number | null;
        soldQuantity: number | null;
      }>
    >((acc, ticket) => {
      if (!ticket) return acc;
      acc.push({
        price: typeof ticket.price === "number" ? ticket.price : null,
        currency: typeof ticket.currency === "string" ? ticket.currency : null,
        status: typeof ticket.status === "string" ? ticket.status : null,
        totalQuantity:
          typeof ticket.totalQuantity === "number" ? ticket.totalQuantity : null,
        soldQuantity:
          typeof ticket.soldQuantity === "number" ? ticket.soldQuantity : null,
      });
      return acc;
    }, []),
  });

  const canonicalRaw = event.addressRef?.canonical ?? null;
  const canonical =
    canonicalRaw && typeof canonicalRaw === "object" && !Array.isArray(canonicalRaw)
      ? (canonicalRaw as Record<string, unknown>)
      : null;
  const locationFormattedAddress =
    event.addressRef?.formattedAddress ??
    (canonical && typeof canonical.formattedAddress === "string" && canonical.formattedAddress.trim()
      ? canonical.formattedAddress.trim()
      : null) ??
    null;

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt ?? null,
    endsAt: event.endsAt ?? null,
    locationFormattedAddress,
    isGratis: pricing.isGratis,
    priceFrom: pricing.priceFrom,
    coverImageUrl: event.coverImageUrl ?? null,
  };
}
