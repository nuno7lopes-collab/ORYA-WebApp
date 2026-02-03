import { PublicEventCard } from "@orya/shared";

export type AgoraEventStatus = "LIVE" | "SOON" | "UPCOMING";

export type AgoraEvent = PublicEventCard & {
  agoraStatus: AgoraEventStatus;
  startsInMinutes: number | null;
  liveWindowLabel: string;
};

export type AgoraTimeline = {
  liveNow: AgoraEvent[];
  comingSoon: AgoraEvent[];
  upcoming: AgoraEvent[];
};
