import { EventStatus, PadelTournamentLifecycleStatus } from "@prisma/client";

export const TOURNAMENT_LIFECYCLE_ORDER: PadelTournamentLifecycleStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "LOCKED",
  "LIVE",
  "COMPLETED",
  "CANCELLED",
];

const LIFECYCLE_TRANSITIONS: Record<
  PadelTournamentLifecycleStatus,
  PadelTournamentLifecycleStatus[]
> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["LOCKED", "CANCELLED"],
  LOCKED: ["LIVE", "CANCELLED"],
  LIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export const TOURNAMENT_LIFECYCLE_LABELS: Record<PadelTournamentLifecycleStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  LOCKED: "Bloqueado",
  LIVE: "Live",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export function getAllowedLifecycleTransitions(
  current: PadelTournamentLifecycleStatus,
): PadelTournamentLifecycleStatus[] {
  return LIFECYCLE_TRANSITIONS[current] ?? [];
}

export function canTransitionLifecycle(
  current: PadelTournamentLifecycleStatus,
  next: PadelTournamentLifecycleStatus,
) {
  if (current === next) return false;
  return getAllowedLifecycleTransitions(current).includes(next);
}

export function isTerminalLifecycle(status: PadelTournamentLifecycleStatus) {
  return status === "COMPLETED" || status === "CANCELLED";
}

export function resolveEventStatusForLifecycle(status: PadelTournamentLifecycleStatus): EventStatus {
  switch (status) {
    case "DRAFT":
      return "DRAFT";
    case "COMPLETED":
      return "FINISHED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PUBLISHED";
  }
}
