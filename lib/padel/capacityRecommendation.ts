type PadelFormat =
  | "TODOS_CONTRA_TODOS"
  | "GRUPOS_ELIMINATORIAS"
  | "QUADRO_ELIMINATORIO"
  | "QUADRO_AB"
  | "DUPLA_ELIMINACAO"
  | "CAMPEONATO_LIGA"
  | "NON_STOP";

const normalizeFormat = (value?: string | null) => (value ?? "").trim().toUpperCase() as PadelFormat | "";

const roundRobinMatches = (teams: number) => (teams > 1 ? (teams * (teams - 1)) / 2 : 0);
const singleElimMatches = (teams: number) => (teams > 1 ? teams - 1 : 0);
const doubleElimMatches = (teams: number) => (teams > 1 ? Math.max(1, 2 * teams - 2) : 0);

export function estimatePadelMatchesForTeams(teams: number, format?: string | null) {
  const safeTeams = Number.isFinite(teams) ? Math.max(0, Math.floor(teams)) : 0;
  if (safeTeams < 2) return 0;
  const normalized = normalizeFormat(format);

  if (normalized === "QUADRO_ELIMINATORIO") return singleElimMatches(safeTeams);
  if (normalized === "QUADRO_AB" || normalized === "DUPLA_ELIMINACAO") return doubleElimMatches(safeTeams);
  if (normalized === "GRUPOS_ELIMINATORIAS") {
    const groupSize = safeTeams <= 4 ? safeTeams : safeTeams <= 6 ? 3 : 4;
    const groups = Math.ceil(safeTeams / groupSize);
    let groupMatches = 0;
    for (let i = 0; i < groups; i += 1) {
      const groupTeams = i === groups - 1 ? safeTeams - groupSize * (groups - 1) : groupSize;
      groupMatches += roundRobinMatches(groupTeams);
    }
    const qualifyPerGroup = groupSize >= 4 ? 2 : 1;
    const knockoutTeams = Math.max(2, Math.min(safeTeams, groups * qualifyPerGroup));
    const knockoutMatches = singleElimMatches(knockoutTeams);
    return groupMatches + knockoutMatches;
  }

  if (normalized === "TODOS_CONTRA_TODOS" || normalized === "NON_STOP" || normalized === "CAMPEONATO_LIGA") {
    return roundRobinMatches(safeTeams);
  }

  return roundRobinMatches(safeTeams);
}

export function estimateMaxTeamsForSlots(params: {
  format?: string | null;
  totalSlots: number;
  maxTeams?: number;
}) {
  const { format, totalSlots, maxTeams = 64 } = params;
  if (!Number.isFinite(totalSlots) || totalSlots <= 0) return 0;
  let best = 0;
  for (let teams = 2; teams <= maxTeams; teams += 1) {
    const required = estimatePadelMatchesForTeams(teams, format);
    if (required <= totalSlots) {
      best = teams;
    } else {
      break;
    }
  }
  return best;
}

export function computeMatchSlots(params: {
  start: Date | null;
  end: Date | null;
  courts: number;
  durationMinutes: number;
  bufferMinutes: number;
}) {
  const { start, end, courts, durationMinutes, bufferMinutes } = params;
  if (!start || !end || !Number.isFinite(courts) || courts <= 0) return 0;
  const windowMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  if (windowMinutes <= 0) return 0;
  const matchMinutes = Math.max(1, Math.round(durationMinutes)) + Math.max(0, Math.round(bufferMinutes));
  if (matchMinutes <= 0) return 0;
  const perCourt = Math.floor(windowMinutes / matchMinutes);
  return Math.max(0, perCourt) * Math.floor(courts);
}
