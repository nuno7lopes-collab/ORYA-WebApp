import { EventPricingMode } from "@prisma/client";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";

export type PublicEventCard = {
  id: number;
  type: "EVENT";
  slug: string;
  title: string;
  description: string | null;
  shortDescription: string | null;
  startsAt: string;
  endsAt: string;
  location: {
    city: string | null;
    addressId: string | null;
    lat: number | null;
    lng: number | null;
    formattedAddress: string | null;
  };
  coverImageUrl: string | null;
  isGratis: boolean;
  priceFrom: number | null;
  categories: string[];
  hostName: string | null;
  hostUsername: string | null;
  status: "ACTIVE" | "CANCELLED" | "PAST" | "DRAFT";
  isHighlighted: boolean;
  ticketTypes?: PublicEventTicketType[];
};

export type PublicEventCardWithPrice = PublicEventCard & { _priceFromCents: number | null };

export type PublicEventTicketType = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  currency: string | null;
  status: "ON_SALE" | "UPCOMING" | "CLOSED" | "SOLD_OUT" | null;
  startsAt: string | null;
  endsAt: string | null;
  totalQuantity: number | null;
  soldQuantity: number | null;
  sortOrder: number | null;
};

type PublicEventCardInput = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  status: string;
  templateType: string | null;
  ownerUserId: string | null;
  organization?: { publicName: string | null } | null;
  addressId: string | null;
  addressRef?: {
    formattedAddress?: string | null;
    canonical?: Record<string, unknown> | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  coverImageUrl: string | null;
  pricingMode: string | null;
  ticketTypes?:
    | Array<{
        id: number;
        name: string;
        description: string | null;
        price: number;
        currency: string | null;
        status: string | null;
        startsAt: Date | string | null;
        endsAt: Date | string | null;
        totalQuantity: number | null;
        soldQuantity: number | null;
        sortOrder: number | null;
      }>
    | null;
};

type PublicEventCardIndexInput = {
  sourceId: string;
  slug: string;
  title: string;
  description: string | null;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  status: string;
  templateType: string | null;
  pricingMode: string | null;
  isGratis: boolean;
  priceFromCents: number | null;
  coverImageUrl: string | null;
  hostName: string | null;
  hostUsername: string | null;
  addressId: string | null;
  addressRef?: {
    formattedAddress?: string | null;
    canonical?: Record<string, unknown> | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

type PublicEventOwnerProfile = {
  fullName: string | null;
  username: string | null;
};

const pickCanonicalField = (canonical: Record<string, unknown> | null, ...keys: string[]) => {
  if (!canonical) return null;
  for (const key of keys) {
    const value = canonical[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

export function resolvePublicEventStatus(event: {
  status: string;
  endsAt: Date | string | null;
}): PublicEventCard["status"] {
  if (event.status === "CANCELLED") return "CANCELLED";
  if (event.status === "DRAFT") return "DRAFT";

  const now = Date.now();
  const endDate =
    event.endsAt instanceof Date
      ? event.endsAt.getTime()
      : event.endsAt
        ? new Date(event.endsAt).getTime()
        : null;

  if (endDate && endDate < now) return "PAST";
  return "ACTIVE";
}

export function toPublicEventCardWithPrice(params: {
  event: PublicEventCardInput;
  ownerProfile?: PublicEventOwnerProfile | null;
}): PublicEventCardWithPrice {
  const { event, ownerProfile } = params;
  const ticketPrices = Array.isArray(event.ticketTypes)
    ? event.ticketTypes
        .map((t) => (typeof t.price === "number" ? t.price : null))
        .filter((p): p is number => p !== null)
    : [];

  const isGratis = deriveIsFreeEvent({
    pricingMode: (event.pricingMode as EventPricingMode | null | undefined) ?? undefined,
    ticketPrices,
  });
  const priceFromCents =
    isGratis ? 0 : ticketPrices.length > 0 ? Math.min(...ticketPrices) : null;
  const priceFrom = priceFromCents !== null ? priceFromCents / 100 : null;

  const hostName = event.organization?.publicName ?? ownerProfile?.fullName ?? null;
  const hostUsername = ownerProfile?.username ?? null;

  const categories = resolveEventCategories(event.templateType);
  const isHighlighted = resolveIsHighlighted({
    status: event.status,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    coverImageUrl: event.coverImageUrl,
  });
  const canonical = (event.addressRef?.canonical as Record<string, unknown> | null) ?? null;
  const city =
    pickCanonicalField(canonical, "city", "locality", "addressLine2", "region", "state") ?? null;
  const formattedAddress = event.addressRef?.formattedAddress ?? null;
  const lat = event.addressRef?.latitude ?? null;
  const lng = event.addressRef?.longitude ?? null;

  const ticketTypes: PublicEventTicketType[] | undefined = Array.isArray(event.ticketTypes)
    ? event.ticketTypes.map((ticket) => ({
        id: ticket.id,
        name: ticket.name,
        description: ticket.description ?? null,
        price: ticket.price,
        currency: ticket.currency ?? null,
        status: (ticket.status as PublicEventTicketType["status"]) ?? null,
        startsAt: ticket.startsAt ? new Date(ticket.startsAt).toISOString() : null,
        endsAt: ticket.endsAt ? new Date(ticket.endsAt).toISOString() : null,
        totalQuantity: ticket.totalQuantity ?? null,
        soldQuantity: ticket.soldQuantity ?? null,
        sortOrder: ticket.sortOrder ?? null,
      }))
    : undefined;

  return {
    id: event.id,
    type: "EVENT",
    slug: event.slug,
    title: event.title,
    description: event.description ?? null,
    shortDescription: event.description?.slice(0, 200) ?? null,
    startsAt: event.startsAt ? new Date(event.startsAt).toISOString() : "",
    endsAt: event.endsAt ? new Date(event.endsAt).toISOString() : "",
    location: {
      city,
      addressId: event.addressId ?? null,
      lat,
      lng,
      formattedAddress,
    },
    coverImageUrl: event.coverImageUrl ?? null,
    isGratis,
    priceFrom,
    categories,
    hostName,
    hostUsername,
    status: resolvePublicEventStatus({ status: event.status, endsAt: event.endsAt }),
    isHighlighted,
    ticketTypes,
    _priceFromCents: priceFromCents,
  };
}

export function toPublicEventCard(params: {
  event: PublicEventCardInput;
  ownerProfile?: PublicEventOwnerProfile | null;
}): PublicEventCard {
  const { _priceFromCents, ...rest } = toPublicEventCardWithPrice(params);
  return rest;
}

export function toPublicEventCardFromIndex(input: PublicEventCardIndexInput): PublicEventCard {
  const id = Number(input.sourceId);
  const priceFrom =
    input.priceFromCents !== null && Number.isFinite(input.priceFromCents)
      ? input.priceFromCents / 100
      : null;

  const isHighlighted = resolveIsHighlighted({
    status: input.status,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    coverImageUrl: input.coverImageUrl,
  });
  const canonical = (input.addressRef?.canonical as Record<string, unknown> | null) ?? null;
  const city =
    pickCanonicalField(canonical, "city", "locality", "addressLine2", "region", "state") ?? null;
  const formattedAddress = input.addressRef?.formattedAddress ?? null;
  const lat = input.addressRef?.latitude ?? null;
  const lng = input.addressRef?.longitude ?? null;

  return {
    id: Number.isFinite(id) ? id : 0,
    type: "EVENT",
    slug: input.slug,
    title: input.title,
    description: input.description ?? null,
    shortDescription: input.description?.slice(0, 200) ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt).toISOString() : "",
    endsAt: input.endsAt ? new Date(input.endsAt).toISOString() : "",
    location: {
      city,
      addressId: input.addressId ?? null,
      lat,
      lng,
      formattedAddress,
    },
    coverImageUrl: input.coverImageUrl ?? null,
    isGratis: input.isGratis,
    priceFrom,
    categories: resolveEventCategories(input.templateType),
    hostName: input.hostName ?? null,
    hostUsername: input.hostUsername ?? null,
    status: resolvePublicEventStatus({ status: input.status, endsAt: input.endsAt }),
    isHighlighted,
  };
}

export function toPublicEventCardWithPriceFromIndex(
  input: PublicEventCardIndexInput,
): PublicEventCardWithPrice {
  const base = toPublicEventCardFromIndex(input);
  return {
    ...base,
    _priceFromCents: input.priceFromCents ?? null,
  };
}

function resolveEventCategories(templateType: string | null): string[] {
  const templateToCategory: Record<string, string> = {
    PARTY: "FESTA",
    PADEL: "PADEL",
    TALK: "PALESTRA",
    VOLUNTEERING: "VOLUNTARIADO",
    OTHER: "GERAL",
  };
  return templateType != null
    ? [templateToCategory[String(templateType)] ?? "GERAL"]
    : ["GERAL"];
}

function resolveIsHighlighted(params: {
  status: string;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  coverImageUrl?: string | null;
}): boolean {
  const status = resolvePublicEventStatus({ status: params.status, endsAt: params.endsAt });
  if (status !== "ACTIVE") return false;

  const start =
    params.startsAt instanceof Date
      ? params.startsAt.getTime()
      : params.startsAt
        ? new Date(params.startsAt).getTime()
        : null;
  if (!start || Number.isNaN(start)) return false;

  const now = Date.now();
  const upcomingWindowMs = 10 * 24 * 60 * 60 * 1000;
  const graceMs = 24 * 60 * 60 * 1000;
  const withinWindow = start >= now - graceMs && start <= now + upcomingWindowMs;

  if (!withinWindow) return false;
  return Boolean(params.coverImageUrl);
}
