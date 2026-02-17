import {
  computeMatchSlots as computePadelMatchSlots,
  estimateMaxTeamsForSlotsByFormat,
  estimatePadelMatchesForTeams as estimatePadelMatchesForTeamsByFormat,
} from "@/domain/padel/formatEngine/capacity";

export function estimatePadelMatchesForTeams(teams: number, format?: string | null) {
  return estimatePadelMatchesForTeamsByFormat(teams, format);
}

export function estimateMaxTeamsForSlots(params: {
  format?: string | null;
  totalSlots: number;
  maxTeams?: number;
  courts?: number;
}) {
  return estimateMaxTeamsForSlotsByFormat(params);
}

export function computeMatchSlots(params: {
  start: Date | null;
  end: Date | null;
  courts: number;
  durationMinutes: number;
  bufferMinutes: number;
}) {
  return computePadelMatchSlots(params);
}
