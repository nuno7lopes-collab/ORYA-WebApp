import { TournamentMatchStatus } from "@prisma/client";

export function canReschedule(status: TournamentMatchStatus, newStart: Date | null) {
  if (status === "IN_PROGRESS" || status === "DONE" || status === "DISPUTED") return false;
  if (!newStart) return true;
  const now = Date.now();
  if (newStart.getTime() < now) return false;
  return true;
}

export function canNotify(status: TournamentMatchStatus) {
  return status !== "DONE" && status !== "IN_PROGRESS" && status !== "DISPUTED";
}
