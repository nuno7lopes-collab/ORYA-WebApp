import type { AutoScheduleMatch } from "@/domain/padel/autoSchedule";

export const resolveAllowPlaceholderMatches = (params: {
  tournamentFormat?: string | null;
  unscheduledMatches: AutoScheduleMatch[];
}) => {
  if (params.tournamentFormat === "NON_STOP") return true;
  return params.unscheduledMatches.some((match) => match.groupLabel === "NS");
};
