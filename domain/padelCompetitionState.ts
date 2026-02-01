import { EventStatus, PadelTournamentLifecycleStatus } from "@prisma/client";

export const PADEL_COMPETITION_STATES = ["HIDDEN", "DEVELOPMENT", "PUBLIC", "CANCELLED"] as const;
export type PadelCompetitionState = (typeof PADEL_COMPETITION_STATES)[number];

export function isPadelCompetitionState(value: unknown): value is PadelCompetitionState {
  return typeof value === "string" && (PADEL_COMPETITION_STATES as readonly string[]).includes(value);
}

export function resolvePadelCompetitionState(params: {
  eventStatus: EventStatus;
  competitionState?: string | null;
  lifecycleStatus?: PadelTournamentLifecycleStatus | string | null;
}): PadelCompetitionState {
  const lifecycle =
    params.lifecycleStatus && typeof params.lifecycleStatus === "string"
      ? (params.lifecycleStatus.toUpperCase() as PadelTournamentLifecycleStatus)
      : null;

  if (lifecycle && Object.values(PadelTournamentLifecycleStatus).includes(lifecycle)) {
    if (lifecycle === "CANCELLED") return "CANCELLED";
    if (lifecycle === "DRAFT") return "HIDDEN";
    if (lifecycle === "LIVE" || lifecycle === "COMPLETED") return "PUBLIC";
    return "DEVELOPMENT";
  }

  if (isPadelCompetitionState(params.competitionState)) {
    return params.competitionState;
  }
  if (params.eventStatus === "CANCELLED") return "CANCELLED";
  if (params.eventStatus === "DRAFT") return "HIDDEN";
  if (params.eventStatus === "FINISHED") return "PUBLIC";
  return "DEVELOPMENT";
}
