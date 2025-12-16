import { TournamentMatchStatus } from "@prisma/client";

export function canReschedule(status: TournamentMatchStatus, startAt: Date | null, newStart: Date | null) {
  if (status === "IN_PROGRESS" || status === "DONE") return false;
  if (!newStart) return true;
  const now = Date.now();
  if (newStart.getTime() < now) return false;
  return true;
}

export function canNotify(status: TournamentMatchStatus) {
  return status !== "DONE" && status !== "IN_PROGRESS";
}
