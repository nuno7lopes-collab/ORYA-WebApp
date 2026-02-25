import { PublicEventCard } from "@orya/shared";

export type DiscoverPriceFilter = "all" | "free" | "paid";
export type DiscoverDateFilter = "all" | "today" | "weekend" | "upcoming";
export type DiscoverKind = "all" | "padel" | "events" | "services" | "classes";
export type DiscoverWorld = "padel" | "events" | "services";

export type DiscoverServiceCard = {
  id: number;
  coverImageUrl?: string | null;
  courtId?: number | null;
  backingServiceId?: number | null;
  title: string;
  description?: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  kind: "GENERAL" | "COURT" | "CLASS";
  bookingVertical?: "COURT" | "CLASS" | "SERVICE" | null;
  assignmentMode?: "PROFESSIONAL_ONLY" | "RESOURCE_ONLY" | "PROFESSIONAL_AND_RESOURCE" | null;
  category?: {
    id: number;
    slug: string;
    label: string;
    domain: "COURT" | "CLASS" | "SERVICE";
  } | null;
  categoryTag?: string | null;
  nextAvailability?: string | null;
  addressId?: string | null;
  addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
  organization: {
    id: number;
    publicName?: string | null;
    businessName?: string | null;
    username?: string | null;
    brandingAvatarUrl?: string | null;
    brandingCoverUrl?: string | null;
    addressId?: string | null;
    addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
  };
  instructor?: {
    id: number;
    fullName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type DiscoverOfferCard =
  | {
      type: "event";
      key: string;
      event: PublicEventCard;
    }
  | {
      type: "service";
      key: string;
      service: DiscoverServiceCard;
    };
