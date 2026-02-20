import type { AutoScheduleMatch } from "@/domain/padel/autoSchedule";

export const hasCompleteParticipants = (match: Pick<AutoScheduleMatch, "sideAProfileIds" | "sideBProfileIds">) => {
  const sideA = Array.isArray(match.sideAProfileIds) ? match.sideAProfileIds.length : 0;
  const sideB = Array.isArray(match.sideBProfileIds) ? match.sideBProfileIds.length : 0;
  return sideA > 0 && sideB > 0;
};

export const resolveCategoryKey = (categoryId: number | null | undefined) =>
  typeof categoryId === "number" && Number.isFinite(categoryId) ? String(categoryId) : "global";
