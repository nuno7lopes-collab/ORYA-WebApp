import type { ComponentType } from "react";

export type ExploreItem = {
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
    source: "APPLE_MAPS" | "MANUAL" | null;
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

export type ServiceItem = {
  id: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  addressRef?: {
    formattedAddress?: string | null;
    canonical?: Record<string, unknown> | null;
  } | null;
  organization: {
    id: number;
    publicName: string | null;
    businessName: string | null;
    username: string | null;
    brandingAvatarUrl: string | null;
    addressRef?: {
      formattedAddress?: string | null;
      canonical?: Record<string, unknown> | null;
    } | null;
  };
  nextAvailability: string | null;
};

export type ApiResponse = {
  items: ExploreItem[];
  pagination: {
    nextCursor: number | null;
    hasMore: boolean;
  };
};

export type ServiceApiResponse = {
  ok: boolean;
  items: ServiceItem[];
  pagination: {
    nextCursor: number | null;
    hasMore: boolean;
  };
  error?: string;
  debug?: string;
};

export type PadelTournamentItem = {
  id: number;
  slug: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  coverImageUrl: string | null;
  locationFormattedAddress: string | null;
  priceFrom: number | null;
  organizationName: string | null;
  format: string | null;
  eligibility: string | null;
  levels: Array<{ id: number; label: string }>;
};

export type PadelClubItem = {
  id: number;
  name: string;
  shortName: string;
  city: string | null;
  address: string | null;
  courtsCount: number;
  slug: string | null;
  organizationName: string | null;
  organizationUsername: string | null;
  courts: Array<{ id: number; name: string; indoor: boolean; surface: string | null }>;
};

export type PadelOpenPairingItem = {
  id: number;
  paymentMode: string;
  deadlineAt: string | null;
  isExpired: boolean;
  category: { id: number; label: string } | null;
  openSlots: number;
  event: {
    id: number;
    slug: string;
    title: string;
    startsAt: string | null;
    locationFormattedAddress: string | null;
    coverImageUrl: string | null;
  };
};

export type PadelDiscoverResponse = {
  ok: boolean;
  items: PadelTournamentItem[];
  levels?: Array<{ id: number; label: string }>;
  error?: string;
};

export type PadelClubResponse = { ok: boolean; items: PadelClubItem[]; error?: string };
export type PadelOpenPairingsResponse = { ok: boolean; items: PadelOpenPairingItem[]; error?: string };

export type DateFilter = "all" | "today" | "weekend" | "upcoming" | "custom";
export type TypeFilter = "all" | "event";
export type ExploreWorld = "EVENTOS" | "PADEL" | "RESERVAS";

export type WorldMeta = {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
};
