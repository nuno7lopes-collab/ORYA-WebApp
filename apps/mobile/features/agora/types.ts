import { PublicEventCard } from "@orya/shared";

export type AgoraEventStatus = "LIVE" | "SOON" | "UPCOMING";

export type AgoraEvent = PublicEventCard & {
  agoraStatus: AgoraEventStatus;
  startsInMinutes: number | null;
  liveWindowLabel: string;
};

export type AgoraFeedMode = "agora" | "all";

export type AgoraPage = {
  items: AgoraEvent[];
  nextCursor: string | null;
  hasMore: boolean;
  mode: AgoraFeedMode;
};

export type AgoraPageParam = {
  cursor: string | null;
  mode: AgoraFeedMode;
};
