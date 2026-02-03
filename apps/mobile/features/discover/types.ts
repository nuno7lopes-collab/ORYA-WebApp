import { PublicEventCard } from "@orya/shared";

export type DiscoverPriceFilter = "all" | "free" | "paid";
export type DiscoverDateFilter = "all" | "today" | "weekend" | "upcoming";
export type DiscoverKind = "all" | "padel" | "events" | "services";

export type DiscoverServiceCard = {
  id: number;
  title: string;
  description?: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  kind: "GENERAL" | "COURT" | "CLASS";
  categoryTag?: string | null;
  nextAvailability?: string | null;
  organization: {
    id: number;
    publicName?: string | null;
    businessName?: string | null;
    city?: string | null;
    username?: string | null;
    brandingAvatarUrl?: string | null;
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
