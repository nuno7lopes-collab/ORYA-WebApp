import type { AutoScheduleMatch } from "@/domain/padel/autoSchedule";
import { PADEL_FORMAT_SET, parsePadelFormat } from "@/domain/padel/formatCatalog";

export const resolveAllowPlaceholderMatches = (params: {
  tournamentFormat?: string | null;
  unscheduledMatches: AutoScheduleMatch[];
}) => {
  if (params.tournamentFormat === "NON_STOP") return true;
  return params.unscheduledMatches.some((match) => match.groupLabel === "NS");
};

export const resolveMinParticipantsPerSide = (params: {
  tournamentFormat?: string | null;
  allowPlaceholderMatches: boolean;
}) => {
  if (params.allowPlaceholderMatches) return 1;
  const format = parsePadelFormat(params.tournamentFormat);
  if (format && PADEL_FORMAT_SET.has(format)) return 2;
  return 1;
};
