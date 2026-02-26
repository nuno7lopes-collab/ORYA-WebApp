import { padel_format } from "@prisma/client";
import { parsePadelFormat } from "@/domain/padel/formatCatalog";
import { getPadelFormatProfile } from "@/domain/padel/formatEngine/registry";
import type {
  PadelAmMxMode,
  PadelAmMxProgressionMode,
  PadelCapacityPolicy,
  PadelNonStopMode,
  PadelPlanAlternative,
  PadelPlanCategoryInput,
  PadelPlanCategoryResult,
  PadelPlanInput,
  PadelPlanResult,
  PadelRoundBlueprint,
  PadelScheduleFeasibilityResult,
} from "@/domain/padel/formatEngine/types";

export const DEFAULT_PADEL_CAPACITY_POLICY: PadelCapacityPolicy = {
  publishWarnOnly: true,
  hardBlockGenerate: true,
  hardBlockAutoSchedule: true,
};

const DEFAULT_NON_STOP_ROUNDS = 6;

const labelForKnockoutRound = (matchesInRound: number) => {
  if (matchesInRound <= 1) return "FINAL";
  if (matchesInRound === 2) return "SEMIFINAL";
  if (matchesInRound === 4) return "QUARTERFINAL";
  return `R${matchesInRound * 2}`;
};

const parseDate = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeTimeWindows = (
  windows: PadelPlanInput["timeWindows"],
  fallbackStart: Date | null,
  fallbackEnd: Date | null,
) => {
  const parsed =
    Array.isArray(windows) && windows.length > 0
      ? windows
          .map((window) => {
            const start = parseDate(window.start);
            const end = parseDate(window.end);
            if (!start || !end || end <= start) return null;
            return { start, end };
          })
          .filter((window): window is { start: Date; end: Date } => Boolean(window))
      : [];

  if (parsed.length > 0) {
    return parsed.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  if (fallbackStart && fallbackEnd && fallbackEnd > fallbackStart) {
    return [{ start: fallbackStart, end: fallbackEnd }];
  }

  return [];
};

const toPositiveInt = (value: unknown, fallback = 0) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
};

const safeTeams = (value: number) => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

const roundRobinMatches = (teams: number) => (teams > 1 ? (teams * (teams - 1)) / 2 : 0);

const nextPowerOfTwo = (value: number) => {
  const n = Math.max(1, Math.floor(value));
  return 2 ** Math.ceil(Math.log2(n));
};

const resolveFormat = (raw: unknown, fallback: padel_format) => parsePadelFormat(raw) ?? fallback;

const resolveAmMxMode = (raw: unknown): PadelAmMxMode =>
  raw === "FIXED_PAIR" ? "FIXED_PAIR" : "INDIVIDUAL_ROTATION";

const resolveAmMxProgressionMode = (_raw: unknown): PadelAmMxProgressionMode => "ROUND_BY_ROUND";

const resolveNonStopMode = (raw: unknown): PadelNonStopMode =>
  raw === "HARD_CAP_WAITLIST" ? "HARD_CAP_WAITLIST" : "ACTIVE_QUEUE";

const splitGroups = (teams: number, groupCount: number) => {
  const safeGroupCount = Math.max(1, Math.min(Math.floor(groupCount), Math.max(1, teams)));
  const base = Math.floor(teams / safeGroupCount);
  const remainder = teams % safeGroupCount;
  return Array.from({ length: safeGroupCount }, (_, idx) => base + (idx < remainder ? 1 : 0));
};

const knockoutBlueprint = (entrants: number, type: "KNOCKOUT" = "KNOCKOUT") => {
  if (entrants < 2) return [] as PadelRoundBlueprint[];
  const bracketSize = nextPowerOfTwo(entrants);
  const rounds: PadelRoundBlueprint[] = [];
  for (let matches = bracketSize / 2; matches >= 1; matches = Math.floor(matches / 2)) {
    rounds.push({ label: labelForKnockoutRound(matches), matches, type });
    if (matches === 1) break;
  }
  return rounds;
};

const estimateQuadroABMatches = (teams: number) => {
  const bracketSize = nextPowerOfTwo(Math.max(2, teams));
  const winnersMatches = bracketSize - 1;
  const lowerBound = bracketSize - teams;
  const upperBound = Math.min(bracketSize / 2 - 1, teams - 1);
  const actualPairs = Math.max(0, upperBound - lowerBound + 1);
  if (actualPairs <= 1) {
    return {
      matches: winnersMatches,
      bracketSize,
      bMatches: 0,
    };
  }

  let bRoundMatches = Math.ceil(actualPairs / 2);
  let bTotal = 0;
  while (bRoundMatches > 0) {
    bTotal += bRoundMatches;
    if (bRoundMatches === 1) break;
    bRoundMatches = Math.ceil(bRoundMatches / 2);
  }

  return {
    matches: winnersMatches + bTotal,
    bracketSize,
    bMatches: bTotal,
  };
};

type EstimateInput = {
  format: padel_format;
  teams: number;
  courtsUsed: number;
  roundsHint?: number | null;
  groupCount?: number | null;
  groupSize?: number | null;
  qualifyPerGroup?: number | null;
  extraQualifiers?: number | null;
  amMxMode?: PadelAmMxMode | null;
  amMxProgressionMode?: PadelAmMxProgressionMode | null;
  nonStopMode?: PadelNonStopMode | null;
};

type EstimateResult = {
  minTeams: number;
  matchesNeeded: number;
  warnings: string[];
  rounds: PadelRoundBlueprint[];
  amMxMode?: PadelAmMxMode;
  amMxProgressionMode?: PadelAmMxProgressionMode;
  nonStopMode?: PadelNonStopMode;
};

function estimateMatchesForCategory(input: EstimateInput): EstimateResult {
  const format = input.format;
  const teams = safeTeams(input.teams);
  const profile = getPadelFormatProfile(format);
  const warnings: string[] = [];

  if (teams < profile.minTeams) {
    warnings.push(`Formato ${profile.label} requer pelo menos ${profile.minTeams} duplas.`);
  }

  if (teams < 2) {
    return {
      minTeams: profile.minTeams,
      matchesNeeded: 0,
      warnings,
      rounds: [],
      amMxMode: profile.defaultAmMxMode,
      amMxProgressionMode: profile.defaultAmMxProgressionMode,
      nonStopMode: profile.defaultNonStopMode,
    };
  }

  if (format === padel_format.TODOS_CONTRA_TODOS || format === padel_format.CAMPEONATO_LIGA) {
    return {
      minTeams: profile.minTeams,
      matchesNeeded: roundRobinMatches(teams),
      warnings,
      rounds: [{ label: "Fase regular", matches: roundRobinMatches(teams), type: "ROUND_ROBIN" }],
    };
  }

  if (format === padel_format.QUADRO_ELIMINATORIO) {
    const bracket = nextPowerOfTwo(teams);
    return {
      minTeams: profile.minTeams,
      matchesNeeded: bracket - 1,
      warnings,
      rounds: knockoutBlueprint(teams),
    };
  }

  if (format === padel_format.QUADRO_AB) {
    const estimated = estimateQuadroABMatches(teams);
    const rounds: PadelRoundBlueprint[] = [
      ...knockoutBlueprint(teams).map((round) => ({ ...round, label: `A ${round.label}` })),
    ];
    if (estimated.bMatches > 0) {
      rounds.push({ label: "B bracket", matches: estimated.bMatches, type: "KNOCKOUT" });
    }
    return {
      minTeams: profile.minTeams,
      matchesNeeded: estimated.matches,
      warnings,
      rounds,
    };
  }

  if (format === padel_format.DUPLA_ELIMINACAO) {
    const bracket = nextPowerOfTwo(teams);
    const winnersMatches = bracket - 1;
    const losersAndGrandFinal = bracket;
    return {
      minTeams: profile.minTeams,
      matchesNeeded: winnersMatches + losersAndGrandFinal,
      warnings,
      rounds: [
        { label: "A bracket", matches: winnersMatches, type: "KNOCKOUT" },
        { label: "B bracket + finais", matches: losersAndGrandFinal, type: "KNOCKOUT" },
      ],
    };
  }

  if (format === padel_format.GRUPOS_ELIMINATORIAS) {
    let groupCount = toPositiveInt(input.groupCount, 0);
    if (groupCount <= 0) {
      const configuredGroupSize = toPositiveInt(input.groupSize, 0);
      if (configuredGroupSize > 1) {
        groupCount = Math.max(1, Math.ceil(teams / configuredGroupSize));
      } else {
        groupCount = Math.max(1, Math.min(teams, Math.round(Math.sqrt(teams))));
      }
    }

    const groups = splitGroups(teams, groupCount);
    const groupMatches = groups.reduce((acc, size) => acc + roundRobinMatches(size), 0);
    const maxGroupSize = Math.max(0, ...groups);
    const defaultQualifyPerGroup = maxGroupSize >= 4 ? 2 : 1;
    const qualifyPerGroupRaw = toPositiveInt(input.qualifyPerGroup, defaultQualifyPerGroup);
    const qualifyPerGroup = Math.max(1, Math.min(maxGroupSize, qualifyPerGroupRaw));
    if (qualifyPerGroupRaw > maxGroupSize && maxGroupSize > 0) {
      warnings.push(`Qualificação por grupo ajustada para ${maxGroupSize}.`);
    }

    const extraQualifiers = Math.max(0, toPositiveInt(input.extraQualifiers, 0));
    const qualifiersBase = groups.reduce((acc, size) => acc + Math.min(size, qualifyPerGroup), 0);
    const qualifiers = Math.max(2, Math.min(teams, qualifiersBase + extraQualifiers));
    const knockoutMatches = nextPowerOfTwo(qualifiers) - 1;

    return {
      minTeams: profile.minTeams,
      matchesNeeded: groupMatches + knockoutMatches,
      warnings,
      rounds: [
        { label: `Grupos (${groups.length})`, matches: groupMatches, type: "GROUPS" },
        { label: `Eliminatórias (${qualifiers})`, matches: knockoutMatches, type: "KNOCKOUT" },
      ],
    };
  }

  if (format === padel_format.NON_STOP) {
    const nonStopMode = resolveNonStopMode(input.nonStopMode ?? profile.defaultNonStopMode ?? "ACTIVE_QUEUE");
    const rounds = Math.max(1, toPositiveInt(input.roundsHint, DEFAULT_NON_STOP_ROUNDS));
    const courtsUsed = Math.max(1, input.courtsUsed);
    const recommendedMaxTeams = courtsUsed * 2;
    if (teams > recommendedMaxTeams) {
      if (nonStopMode === "HARD_CAP_WAITLIST") {
        warnings.push(`Modo hard-cap: máximo competitivo recomendado ${recommendedMaxTeams} duplas.`);
      } else {
        warnings.push(`Modo fila ativa: acima de ${recommendedMaxTeams} duplas entram em rotação por espera.`);
      }
    }

    return {
      minTeams: profile.minTeams,
      matchesNeeded: rounds * courtsUsed,
      warnings,
      rounds: Array.from({ length: rounds }, (_, idx) => ({
        label: `R${idx + 1}`,
        matches: courtsUsed,
        type: "NON_STOP" as const,
      })),
      nonStopMode,
    };
  }

  if (format === padel_format.AMERICANO || format === padel_format.MEXICANO) {
    const amMxMode = resolveAmMxMode(input.amMxMode ?? profile.defaultAmMxMode ?? "INDIVIDUAL_ROTATION");
    const amMxProgressionMode = resolveAmMxProgressionMode(
      input.amMxProgressionMode ?? profile.defaultAmMxProgressionMode ?? "ROUND_BY_ROUND",
    );
    if (amMxMode === "FIXED_PAIR") {
      return {
        minTeams: profile.minTeams,
        matchesNeeded: roundRobinMatches(teams),
        warnings,
        rounds: [{ label: "Fase fixa", matches: roundRobinMatches(teams), type: "ROUND_ROBIN" }],
        amMxMode,
        amMxProgressionMode,
      };
    }

    const players = teams * 2;
    if (players < 4) {
      warnings.push("Modo rotação individual requer 4 jogadores ou mais.");
      return {
        minTeams: Math.max(profile.minTeams, 2),
        matchesNeeded: 0,
        warnings,
        rounds: [],
        amMxMode,
        amMxProgressionMode,
      };
    }

    const defaultRounds =
      format === padel_format.MEXICANO
        ? Math.max(1, Math.min(players - 1, 6))
        : Math.max(1, players - 1);
    const rounds = Math.max(1, toPositiveInt(input.roundsHint, defaultRounds));
    const matchesPerRound = Math.max(1, Math.ceil(players / 4));

    return {
      minTeams: profile.minTeams,
      matchesNeeded: rounds * matchesPerRound,
      warnings,
      rounds: Array.from({ length: rounds }, (_, idx) => ({
        label: `R${idx + 1}`,
        matches: matchesPerRound,
        type: "AM_MX_ROTATION" as const,
      })),
      amMxMode,
      amMxProgressionMode,
    };
  }

  return {
    minTeams: profile.minTeams,
    matchesNeeded: roundRobinMatches(teams),
    warnings,
    rounds: [{ label: "Fase regular", matches: roundRobinMatches(teams), type: "ROUND_ROBIN" }],
  };
}

function allocateSlotsByWeight(args: {
  totalSlots: number;
  keys: string[];
  weights?: Record<string, number> | null;
}) {
  const { totalSlots, keys, weights } = args;
  if (keys.length === 0 || totalSlots <= 0) return new Map<string, number>();

  const parsed = keys.map((key) => {
    const raw = weights?.[key];
    const numeric = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 1;
    return { key, weight: numeric };
  });

  const totalWeight = parsed.reduce((acc, item) => acc + item.weight, 0) || parsed.length;
  const rawAlloc = parsed.map((item) => {
    const value = (item.weight / totalWeight) * totalSlots;
    return {
      key: item.key,
      base: Math.floor(value),
      remainder: value - Math.floor(value),
    };
  });

  let assigned = rawAlloc.reduce((acc, item) => acc + item.base, 0);
  const result = new Map(rawAlloc.map((item) => [item.key, item.base]));

  if (assigned < totalSlots) {
    const byRemainder = [...rawAlloc].sort((a, b) => b.remainder - a.remainder || a.key.localeCompare(b.key));
    let cursor = 0;
    while (assigned < totalSlots) {
      const target = byRemainder[cursor % byRemainder.length];
      result.set(target.key, (result.get(target.key) ?? 0) + 1);
      cursor += 1;
      assigned += 1;
    }
  }

  return result;
}

function estimateMaxTeamsForSlots(params: {
  format: padel_format;
  slots: number;
  courtsUsed: number;
  roundsHint?: number | null;
  amMxMode?: PadelAmMxMode | null;
  amMxProgressionMode?: PadelAmMxProgressionMode | null;
  nonStopMode?: PadelNonStopMode | null;
  groupCount?: number | null;
  groupSize?: number | null;
  qualifyPerGroup?: number | null;
  extraQualifiers?: number | null;
  maxSearch?: number;
}) {
  const {
    format,
    slots,
    courtsUsed,
    roundsHint,
    amMxMode,
    amMxProgressionMode,
    nonStopMode,
    groupCount,
    groupSize,
    qualifyPerGroup,
    extraQualifiers,
    maxSearch = 128,
  } = params;

  if (slots <= 0) return 0;
  if (format === padel_format.NON_STOP) {
    return Math.max(0, courtsUsed * 2);
  }

  const minTeams = getPadelFormatProfile(format).minTeams;
  let best = 0;
  for (let teams = minTeams; teams <= maxSearch; teams += 1) {
    const estimated = estimateMatchesForCategory({
      format,
      teams,
      courtsUsed,
      roundsHint,
      amMxMode,
      amMxProgressionMode,
      nonStopMode,
      groupCount,
      groupSize,
      qualifyPerGroup,
      extraQualifiers,
    });
    if (estimated.matchesNeeded <= slots) {
      best = teams;
    } else {
      break;
    }
  }
  return best;
}

export function computePadelPlan(input: PadelPlanInput): PadelPlanResult {
  const baseFormat = resolveFormat(input.format, padel_format.TODOS_CONTRA_TODOS);
  const windowStart = parseDate(input.windowStart);
  const windowEnd = parseDate(input.windowEnd);
  const timeWindows = normalizeTimeWindows(input.timeWindows, windowStart, windowEnd);
  const durationMinutes = Math.max(1, toPositiveInt(input.durationMinutes, 60));
  const bufferMinutes = Math.max(0, toPositiveInt(input.bufferMinutes ?? 0, 0));
  const slotMinutes = Math.max(1, durationMinutes + bufferMinutes);

  const courtIdsCount = Array.isArray(input.courtIds)
    ? input.courtIds.filter((id) => typeof id === "number" && Number.isFinite(id)).length
    : 0;
  const courtsUsed = Math.max(1, courtIdsCount || toPositiveInt(input.courtsCount, 1));

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (timeWindows.length === 0) {
    blockingReasons.push("INVALID_WINDOW");
  }

  const windowMinutes = timeWindows.reduce((acc, window) => {
    const minutes = Math.floor((window.end.getTime() - window.start.getTime()) / 60000);
    return acc + Math.max(0, minutes);
  }, 0);
  const slotsPerCourt = windowMinutes > 0 ? Math.floor(windowMinutes / slotMinutes) : 0;
  const totalSlots = Math.max(0, slotsPerCourt * courtsUsed);

  if (totalSlots <= 0) {
    blockingReasons.push("NO_SLOTS_AVAILABLE");
  }

  const categoriesInput: PadelPlanCategoryInput[] =
    Array.isArray(input.categories) && input.categories.length > 0
      ? input.categories
      : [
          {
            categoryId: null,
            label: "Geral",
            teams: Math.max(0, toPositiveInt(input.teams, 0)),
            format: baseFormat,
            amMxMode: input.amMxMode ?? null,
            amMxProgressionMode: input.amMxProgressionMode ?? null,
            nonStopMode: input.nonStopMode ?? null,
            nonStopRounds: input.nonStopRounds ?? null,
            nonStopQueueRules: input.nonStopQueueRules ?? null,
            roundsHint: input.roundsHint ?? null,
            groupCount: input.groupCount ?? null,
            groupSize: input.groupSize ?? null,
            qualifyPerGroup: input.qualifyPerGroup ?? null,
            extraQualifiers: input.extraQualifiers ?? null,
          },
        ];

  const categoryKeys = categoriesInput.map((item, idx) => {
    const candidate =
      item.categoryId != null && String(item.categoryId).trim().length > 0
        ? String(item.categoryId)
        : `category:${idx + 1}`;
    return candidate;
  });

  const allocatedSlots = allocateSlotsByWeight({
    totalSlots,
    keys: categoryKeys,
    weights: input.categoryWeights ?? null,
  });

  const categoryResults: PadelPlanCategoryResult[] = categoriesInput.map((category, idx) => {
    const key = categoryKeys[idx];
    const categoryFormat = resolveFormat(category.format, baseFormat);
    const teams = Math.max(0, toPositiveInt(category.teams, 0));
    const estimated = estimateMatchesForCategory({
      format: categoryFormat,
      teams,
      courtsUsed,
      roundsHint: category.nonStopRounds ?? category.roundsHint ?? input.nonStopRounds ?? input.roundsHint ?? null,
      amMxMode: category.amMxMode ?? input.amMxMode ?? null,
      amMxProgressionMode: category.amMxProgressionMode ?? input.amMxProgressionMode ?? null,
      nonStopMode: category.nonStopMode ?? input.nonStopMode ?? null,
      groupCount: category.groupCount ?? input.groupCount ?? null,
      groupSize: category.groupSize ?? input.groupSize ?? null,
      qualifyPerGroup: category.qualifyPerGroup ?? input.qualifyPerGroup ?? null,
      extraQualifiers: category.extraQualifiers ?? input.extraQualifiers ?? null,
    });
    const slotsForCategory = allocatedSlots.get(key) ?? 0;
    const recommendedMaxTeams = estimateMaxTeamsForSlots({
      format: categoryFormat,
      slots: slotsForCategory,
      courtsUsed,
      roundsHint: category.nonStopRounds ?? category.roundsHint ?? input.nonStopRounds ?? input.roundsHint ?? null,
      amMxMode: category.amMxMode ?? input.amMxMode ?? null,
      amMxProgressionMode: category.amMxProgressionMode ?? input.amMxProgressionMode ?? null,
      nonStopMode: category.nonStopMode ?? input.nonStopMode ?? null,
      groupCount: category.groupCount ?? input.groupCount ?? null,
      groupSize: category.groupSize ?? input.groupSize ?? null,
      qualifyPerGroup: category.qualifyPerGroup ?? input.qualifyPerGroup ?? null,
      extraQualifiers: category.extraQualifiers ?? input.extraQualifiers ?? null,
    });
    const hardCapMax =
      categoryFormat === padel_format.NON_STOP &&
      resolveNonStopMode(category.nonStopMode ?? estimated.nonStopMode ?? "ACTIVE_QUEUE") === "HARD_CAP_WAITLIST"
        ? courtsUsed * 2
        : null;
    const queueEstimatedRounds =
      categoryFormat === padel_format.NON_STOP && teams > courtsUsed * 2
        ? Math.max(1, teams - courtsUsed * 2)
        : null;

    return {
      key,
      categoryId:
        typeof category.categoryId === "number" && Number.isInteger(category.categoryId) && category.categoryId > 0
          ? category.categoryId
          : null,
      label: category.label?.trim() || `Categoria ${idx + 1}`,
      format: categoryFormat,
      teams,
      minTeams: estimated.minTeams,
      matchesNeeded: estimated.matchesNeeded,
      allocatedSlots: slotsForCategory,
      recommendedMax: recommendedMaxTeams,
      hardCapMax,
      queueEstimatedRounds,
      recommendedMaxTeams,
      feasible: estimated.matchesNeeded <= slotsForCategory && teams >= estimated.minTeams,
      warnings: estimated.warnings,
      rounds: estimated.rounds,
      amMxMode: estimated.amMxMode,
      amMxProgressionMode: estimated.amMxProgressionMode,
      nonStopMode: estimated.nonStopMode,
    };
  });

  const matchesNeeded = categoryResults.reduce((acc, item) => acc + item.matchesNeeded, 0);
  const unscheduledMatches = Math.max(0, matchesNeeded - totalSlots);

  categoryResults.forEach((item) => {
    if (item.teams > 0 && item.teams < item.minTeams) {
      blockingReasons.push(`MIN_TEAMS_NOT_MET:${item.key}`);
    }
    item.warnings.forEach((warning) => warnings.push(`${item.label}: ${warning}`));
  });

  if (unscheduledMatches > 0) {
    blockingReasons.push("INSUFFICIENT_CAPACITY");
  }

  const alternatives: PadelPlanAlternative[] = [];
  if (unscheduledMatches > 0) {
    const addHours = Math.ceil((unscheduledMatches * slotMinutes) / (Math.max(1, courtsUsed) * 60));
    if (addHours > 0) {
      alternatives.push({
        type: "ADD_HOURS",
        hoursDelta: addHours,
        summary: `Adicionar ~${addHours}h à janela atual.`,
      });
    }

    if (slotsPerCourt > 0) {
      const addCourts = Math.ceil(unscheduledMatches / slotsPerCourt);
      if (addCourts > 0) {
        alternatives.push({
          type: "ADD_COURTS",
          courtsDelta: addCourts,
          summary: `Ativar +${addCourts} campo(s) nesta janela.`,
        });
      }
    }

    const reductionTargets = categoryResults
      .filter((category) => category.teams > category.recommendedMaxTeams)
      .map((category) => ({
        key: category.key,
        label: category.label,
        currentTeams: category.teams,
        recommendedMaxTeams: category.recommendedMaxTeams,
      }));
    if (reductionTargets.length > 0) {
      alternatives.push({
        type: "REDUCE_TEAMS",
        byCategory: reductionTargets,
        summary: "Reduzir inscrições para caber na capacidade atual.",
      });
    }
  }

  return {
    feasible: blockingReasons.length === 0,
    windowMinutes,
    courtsUsed,
    slotMinutes,
    totalSlots,
    matchesNeeded,
    unscheduledMatches,
    categories: categoryResults,
    warnings,
    blockingReasons: Array.from(new Set(blockingReasons)),
    alternatives,
  };
}

export function summarizeScheduleFeasibility(skipped: Array<{ reason: string }>): PadelScheduleFeasibilityResult {
  const unscheduledByReason = skipped.reduce<Record<string, number>>((acc, item) => {
    const reason = typeof item.reason === "string" && item.reason.trim() ? item.reason.trim() : "UNKNOWN";
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});

  const blockingReasons = Object.keys(unscheduledByReason).sort();
  return {
    feasible: skipped.length === 0,
    skipped: skipped.length,
    unscheduledByReason,
    blockingReasons,
  };
}

export function computeMatchSlots(params: {
  start: Date | null;
  end: Date | null;
  courts: number;
  durationMinutes: number;
  bufferMinutes: number;
}) {
  const { start, end, courts, durationMinutes, bufferMinutes } = params;
  if (!start || !end || end <= start) return 0;
  const windowMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  if (windowMinutes <= 0) return 0;
  const slotMinutes = Math.max(1, Math.round(durationMinutes) + Math.max(0, Math.round(bufferMinutes)));
  const perCourt = Math.floor(windowMinutes / slotMinutes);
  return Math.max(0, perCourt) * Math.max(0, Math.floor(courts));
}

export function estimatePadelMatchesForTeams(teams: number, format?: string | null) {
  const resolved = resolveFormat(format, padel_format.TODOS_CONTRA_TODOS);
  return estimateMatchesForCategory({
    format: resolved,
    teams: safeTeams(teams),
    courtsUsed: 1,
  }).matchesNeeded;
}

export function estimateMaxTeamsForSlotsByFormat(params: {
  format?: string | null;
  totalSlots: number;
  maxTeams?: number;
  courts?: number;
}) {
  const { format, totalSlots, maxTeams = 128, courts = 1 } = params;
  const resolved = resolveFormat(format, padel_format.TODOS_CONTRA_TODOS);
  return estimateMaxTeamsForSlots({
    format: resolved,
    slots: Math.max(0, Math.floor(totalSlots)),
    courtsUsed: Math.max(1, Math.floor(courts)),
    maxSearch: Math.max(2, Math.floor(maxTeams)),
  });
}
