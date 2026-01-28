import { EventPricingMode } from "@prisma/client";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";

export type PublicEventCard = {
  id: number;
  type: "EVENT";
  slug: string;
  title: string;
  shortDescription: string | null;
  startsAt: string;
  endsAt: string;
  location: {
    name: string | null;
    city: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    formattedAddress: string | null;
    source: string | null;
    components: Record<string, unknown> | null;
    overrides: Record<string, unknown> | null;
  };
  coverImageUrl: string | null;
  isGratis: boolean;
  priceFrom: number | null;
  categories: string[];
  hostName: string | null;
  hostUsername: string | null;
  status: "ACTIVE" | "CANCELLED" | "PAST" | "DRAFT";
  isHighlighted: boolean;
};

export type PublicEventCardWithPrice = PublicEventCard & { _priceFromCents: number | null };

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
  locationName: string | null;
  locationCity: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationFormattedAddress: string | null;
  locationSource: string | null;
  locationComponents: unknown | null;
  locationOverrides: unknown | null;
  coverImageUrl: string | null;
  pricingMode: string | null;
  ticketTypes?: Array<{ price: number | null }> | null;
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
  locationName: string | null;
  locationCity: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  locationFormattedAddress: string | null;
  locationSource: string | null;
};

type PublicEventOwnerProfile = {
  fullName: string | null;
  username: string | null;
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

  return {
    id: event.id,
    type: "EVENT",
    slug: event.slug,
    title: event.title,
    shortDescription: event.description?.slice(0, 200) ?? null,
    startsAt: event.startsAt ? new Date(event.startsAt).toISOString() : "",
    endsAt: event.endsAt ? new Date(event.endsAt).toISOString() : "",
    location: {
      name: event.locationName ?? null,
      city: event.locationCity ?? null,
      address: event.address ?? null,
      lat: event.latitude ?? null,
      lng: event.longitude ?? null,
      formattedAddress: event.locationFormattedAddress ?? null,
      source: event.locationSource ?? null,
      components:
        event.locationComponents && typeof event.locationComponents === "object"
          ? (event.locationComponents as Record<string, unknown>)
          : null,
      overrides:
        event.locationOverrides && typeof event.locationOverrides === "object"
          ? (event.locationOverrides as Record<string, unknown>)
          : null,
    },
    coverImageUrl: event.coverImageUrl ?? null,
    isGratis,
    priceFrom,
    categories,
    hostName,
    hostUsername,
    status: resolvePublicEventStatus({ status: event.status, endsAt: event.endsAt }),
    isHighlighted: false,
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

  return {
    id: Number.isFinite(id) ? id : 0,
    type: "EVENT",
    slug: input.slug,
    title: input.title,
    shortDescription: input.description?.slice(0, 200) ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt).toISOString() : "",
    endsAt: input.endsAt ? new Date(input.endsAt).toISOString() : "",
    location: {
      name: input.locationName ?? null,
      city: input.locationCity ?? null,
      address: input.address ?? null,
      lat: input.latitude ?? null,
      lng: input.longitude ?? null,
      formattedAddress: input.locationFormattedAddress ?? null,
      source: input.locationSource ?? null,
      components: null,
      overrides: null,
    },
    coverImageUrl: input.coverImageUrl ?? null,
    isGratis: input.isGratis,
    priceFrom,
    categories: resolveEventCategories(input.templateType),
    hostName: input.hostName ?? null,
    hostUsername: input.hostUsername ?? null,
    status: resolvePublicEventStatus({ status: input.status, endsAt: input.endsAt }),
    isHighlighted: false,
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
