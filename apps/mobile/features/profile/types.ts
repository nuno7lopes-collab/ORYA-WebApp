import type { PublicEventCard } from "@orya/shared";

export type ProfileSummary = {
  id: string;
  email: string | null;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  coverUrl?: string | null;
  bio: string | null;
  city: string | null;
  padelLevel: string | null;
  favouriteCategories?: string[];
  visibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS";
  allowEmailNotifications?: boolean;
  allowEventReminders?: boolean;
  allowFollowRequests?: boolean;
  onboardingDone: boolean;
};

export type AgendaItem = {
  id: string;
  type: "EVENTO" | "JOGO" | "INSCRICAO" | "RESERVA";
  title: string;
  startAt: string;
  endAt: string | null;
  status?: string | null;
  label?: string | null;
  ctaHref?: string | null;
  ctaLabel?: string | null;
};

export type ProfileAgendaStats = {
  upcoming: number;
  past: number;
  thisMonth: number;
};

export type PublicProfile = {
  id: string | number;
  username: string | null;
  fullName: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  city?: string | null;
  visibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS";
  padelLevel?: string | null;
  padelPreferredSide?: string | null;
  padelGender?: string | null;
  favouriteCategories?: string[];
};

export type PublicProfilePayload = {
  type: "user" | "organization";
  profile: PublicProfile;
  counts: {
    followers: number;
    following: number;
    events: number;
  };
  viewer?: {
    isFollowing?: boolean;
    isRequested?: boolean;
    isMutual?: boolean;
  } | null;
  isSelf?: boolean;
};

export type PublicProfileEvents = {
  type: "user" | "organization";
  upcoming: PublicEventCard[];
  past: PublicEventCard[];
};
