import { CrmInteractionType, PadelPreferredSide, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PADEL_MATCH_INTERACTION_TYPES = [
  CrmInteractionType.PADEL_MATCH_PAYMENT,
  CrmInteractionType.PADEL_MATCH_PLAYED,
  CrmInteractionType.PADEL_MATCH_WIN,
  CrmInteractionType.PADEL_MATCH_LOSS,
] as const;

export const PADEL_MATCH_COUNT_INTERACTION_TYPES = [
  CrmInteractionType.PADEL_MATCH_PLAYED,
] as const;

export const PADEL_NO_SHOW_INTERACTION_TYPES = [
  CrmInteractionType.PADEL_BOOKING_NO_SHOW,
  CrmInteractionType.PADEL_CLASS_MISSED,
] as const;

export const PADEL_TOURNAMENT_INTERACTION_TYPES = [
  CrmInteractionType.PADEL_TOURNAMENT_ENTRY,
  CrmInteractionType.PADEL_TOURNAMENT_REGISTERED,
  CrmInteractionType.PADEL_TOURNAMENT_PLAYED,
  CrmInteractionType.PADEL_TOURNAMENT_PODIUM,
] as const;

export const PADEL_ACTIVITY_INTERACTION_TYPES = [
  ...PADEL_MATCH_INTERACTION_TYPES,
  ...PADEL_NO_SHOW_INTERACTION_TYPES,
  CrmInteractionType.PADEL_BOOKING_CONFIRMED,
  CrmInteractionType.PADEL_BOOKING_CANCELLED,
  CrmInteractionType.PADEL_CLASS_ATTENDED,
  ...PADEL_TOURNAMENT_INTERACTION_TYPES,
] as const;

const PADEL_MATCH_TYPE_SET = new Set<CrmInteractionType>(PADEL_MATCH_COUNT_INTERACTION_TYPES);
const PADEL_NO_SHOW_TYPE_SET = new Set<CrmInteractionType>(PADEL_NO_SHOW_INTERACTION_TYPES);
const PADEL_TOURNAMENT_TYPE_SET = new Set<CrmInteractionType>(PADEL_TOURNAMENT_INTERACTION_TYPES);

export type PadelActivityStatus = "ACTIVE" | "WARM" | "COLD" | "DORMANT";
export type PadelCompetitiveTier = "RECREATIONAL" | "INTERMEDIATE" | "ADVANCED" | "COMPETITIVE";

type PadelScoreInput = {
  now: Date;
  lastMatchAt: Date | null;
  matches30d: number;
  wins90d: number;
  losses90d: number;
  noShows90d: number;
  tournamentsCount: number;
  level: string | null;
};

type PadelProjection = {
  lastMatchAt: Date | null;
  lastNoShowAt: Date | null;
  matches30d: number;
  winRate90d: number;
  noShowRate90d: number;
  preferredTimeBucket: string | null;
  offPeakRatio30d: number;
  reservationCount90d: number;
  lessonCount90d: number;
  tournamentCount90d: number;
  avgSpendPerSessionCents90d: number;
  activityStatus: PadelActivityStatus;
  competitiveTier: PadelCompetitiveTier;
  rfmScore: number;
  churnRiskScore: number;
  reactivationPropensityScore: number;
  tournamentsCount: number;
  noShowCount: number;
};

type RecomputeParams = {
  organizationId: number;
  contactId: string;
  seed?: {
    playerProfileId?: number | null;
    level?: string | null;
    preferredSide?: PadelPreferredSide | null;
    clubName?: string | null;
    tournamentsCount?: number | null;
    noShowCount?: number | null;
  };
  tx?: Prisma.TransactionClient;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function parseNumericLevel(level: string | null) {
  if (!level) return null;
  const normalized = level.replace(",", ".").trim();
  if (!normalized) return null;
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function daysSince(now: Date, date: Date | null) {
  if (!date) return null;
  const diff = now.getTime() - date.getTime();
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function resolveTimeBucket(hour: number) {
  if (hour >= 6 && hour <= 11) return "MORNING";
  if (hour >= 12 && hour <= 16) return "AFTERNOON";
  if (hour >= 17 && hour <= 21) return "EVENING";
  return "NIGHT";
}

export function resolvePadelActivityStatus(daysSinceLastMatch: number | null): PadelActivityStatus {
  if (daysSinceLastMatch === null) return "DORMANT";
  if (daysSinceLastMatch <= 7) return "ACTIVE";
  if (daysSinceLastMatch <= 21) return "WARM";
  if (daysSinceLastMatch <= 45) return "COLD";
  return "DORMANT";
}

export function resolvePadelCompetitiveTier(params: {
  level: string | null;
  tournamentsCount: number;
  matches30d: number;
  winRate90d: number;
}): PadelCompetitiveTier {
  const numericLevel = parseNumericLevel(params.level);
  if (
    params.tournamentsCount >= 15 ||
    params.matches30d >= 10 ||
    params.winRate90d >= 0.68 ||
    (numericLevel !== null && numericLevel >= 4.5)
  ) {
    return "COMPETITIVE";
  }
  if (
    params.tournamentsCount >= 8 ||
    params.matches30d >= 6 ||
    params.winRate90d >= 0.58 ||
    (numericLevel !== null && numericLevel >= 3.5)
  ) {
    return "ADVANCED";
  }
  if (
    params.tournamentsCount >= 3 ||
    params.matches30d >= 3 ||
    (numericLevel !== null && numericLevel >= 2.5)
  ) {
    return "INTERMEDIATE";
  }
  return "RECREATIONAL";
}

function deriveRfmScore(params: { daysSinceLastMatch: number | null; matches30d: number; tournamentsCount: number }) {
  const recencyBand =
    params.daysSinceLastMatch === null
      ? 1
      : params.daysSinceLastMatch <= 3
        ? 5
        : params.daysSinceLastMatch <= 7
          ? 4
          : params.daysSinceLastMatch <= 14
            ? 3
            : params.daysSinceLastMatch <= 30
              ? 2
              : 1;
  const frequencyBand =
    params.matches30d >= 12 ? 5 : params.matches30d >= 8 ? 4 : params.matches30d >= 4 ? 3 : params.matches30d >= 2 ? 2 : 1;
  const monetaryBand =
    params.tournamentsCount >= 20
      ? 5
      : params.tournamentsCount >= 10
        ? 4
        : params.tournamentsCount >= 5
          ? 3
          : params.tournamentsCount >= 2
            ? 2
            : 1;
  return recencyBand * 100 + frequencyBand * 10 + monetaryBand;
}

function deriveChurnRiskScore(params: {
  daysSinceLastMatch: number | null;
  matches30d: number;
  winRate90d: number;
  noShowRate90d: number;
}) {
  let score =
    params.daysSinceLastMatch === null
      ? 90
      : params.daysSinceLastMatch > 90
        ? 85
        : params.daysSinceLastMatch > 60
          ? 70
          : params.daysSinceLastMatch > 30
            ? 55
            : params.daysSinceLastMatch > 14
              ? 35
              : 20;

  score += Math.round(params.noShowRate90d * 35);
  if (params.matches30d >= 8) score -= 15;
  else if (params.matches30d >= 4) score -= 8;
  else if (params.matches30d === 0) score += 10;
  if (params.winRate90d >= 0.6) score -= 5;

  return clamp(Math.round(score), 0, 100);
}

function deriveReactivationPropensityScore(params: {
  daysSinceLastMatch: number | null;
  matches30d: number;
  tournamentsCount: number;
  winRate90d: number;
  noShowRate90d: number;
  activityStatus: PadelActivityStatus;
}) {
  let score = 20;
  if (params.daysSinceLastMatch !== null && params.daysSinceLastMatch >= 14 && params.daysSinceLastMatch <= 120) {
    score += 25;
  } else if (params.daysSinceLastMatch !== null && params.daysSinceLastMatch > 120) {
    score -= 10;
  }
  if (params.activityStatus === "DORMANT") {
    score += 10;
  }

  score += Math.min(params.matches30d * 3, 18);
  score += Math.min(params.tournamentsCount, 20);
  score += Math.round(params.winRate90d * 20);
  score -= Math.round(params.noShowRate90d * 25);

  return clamp(Math.round(score), 0, 100);
}

export function derivePadelProjection(input: PadelScoreInput): PadelProjection {
  const daysSinceLastMatch = daysSince(input.now, input.lastMatchAt);
  const matches90d = input.wins90d + input.losses90d;
  const winRate90d = matches90d > 0 ? input.wins90d / matches90d : 0;
  const noShowRate90d =
    matches90d + input.noShows90d > 0 ? input.noShows90d / (matches90d + input.noShows90d) : 0;
  const activityStatus = resolvePadelActivityStatus(daysSinceLastMatch);
  const competitiveTier = resolvePadelCompetitiveTier({
    level: input.level,
    tournamentsCount: input.tournamentsCount,
    matches30d: input.matches30d,
    winRate90d,
  });
  const rfmScore = deriveRfmScore({
    daysSinceLastMatch,
    matches30d: input.matches30d,
    tournamentsCount: input.tournamentsCount,
  });
  const churnRiskScore = deriveChurnRiskScore({
    daysSinceLastMatch,
    matches30d: input.matches30d,
    winRate90d,
    noShowRate90d,
  });
  const reactivationPropensityScore = deriveReactivationPropensityScore({
    daysSinceLastMatch,
    matches30d: input.matches30d,
    tournamentsCount: input.tournamentsCount,
    winRate90d,
    noShowRate90d,
    activityStatus,
  });

  return {
    lastMatchAt: input.lastMatchAt,
    lastNoShowAt: null,
    matches30d: input.matches30d,
    winRate90d: roundRate(winRate90d),
    noShowRate90d: roundRate(noShowRate90d),
    preferredTimeBucket: null,
    offPeakRatio30d: 0,
    reservationCount90d: 0,
    lessonCount90d: 0,
    tournamentCount90d: 0,
    avgSpendPerSessionCents90d: 0,
    activityStatus,
    competitiveTier,
    rfmScore,
    churnRiskScore,
    reactivationPropensityScore,
    tournamentsCount: input.tournamentsCount,
    noShowCount: Math.max(0, input.noShows90d),
  };
}

export async function recomputePadelProjectionForContact(params: RecomputeParams): Promise<PadelProjection> {
  const client = params.tx ?? prisma;
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [interactions90, lastMatchInteraction, noShowCountAll, lastNoShowInteraction, tournamentCountAll] = await Promise.all([
    client.crmInteraction.findMany({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
        type: { in: [...PADEL_ACTIVITY_INTERACTION_TYPES] },
        occurredAt: { gte: since90 },
      },
      select: { type: true, occurredAt: true, amountCents: true },
    }),
    client.crmInteraction.findFirst({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
        type: { in: [...PADEL_MATCH_COUNT_INTERACTION_TYPES] },
      },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    }),
    client.crmInteraction.count({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
        type: { in: [...PADEL_NO_SHOW_INTERACTION_TYPES] },
      },
    }),
    client.crmInteraction.findFirst({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
        type: { in: [...PADEL_NO_SHOW_INTERACTION_TYPES] },
      },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    }),
    client.crmInteraction.count({
      where: {
        organizationId: params.organizationId,
        contactId: params.contactId,
        type: { in: [...PADEL_TOURNAMENT_INTERACTION_TYPES] },
      },
    }),
  ]);

  let matches30d = 0;
  let wins90d = 0;
  let losses90d = 0;
  let noShows90d = 0;
  let reservationCount90d = 0;
  let lessonCount90d = 0;
  let tournamentCount90d = 0;
  let sessionCount90d = 0;
  let spend90d = 0;
  let sessionCount30d = 0;
  let offPeakSessions30d = 0;
  const timeBucketCounter: Record<string, number> = {
    MORNING: 0,
    AFTERNOON: 0,
    EVENING: 0,
    NIGHT: 0,
  };

  for (const interaction of interactions90) {
    if (PADEL_MATCH_TYPE_SET.has(interaction.type) && interaction.occurredAt >= since30) {
      matches30d += 1;
    }
    if (interaction.type === CrmInteractionType.PADEL_MATCH_PLAYED) {
      sessionCount90d += 1;
    } else if (interaction.type === CrmInteractionType.PADEL_BOOKING_CONFIRMED) {
      reservationCount90d += 1;
      sessionCount90d += 1;
    } else if (interaction.type === CrmInteractionType.PADEL_CLASS_ATTENDED) {
      lessonCount90d += 1;
      sessionCount90d += 1;
    } else if (PADEL_TOURNAMENT_TYPE_SET.has(interaction.type)) {
      tournamentCount90d += 1;
    }
    if (
      interaction.type === CrmInteractionType.PADEL_MATCH_PAYMENT ||
      interaction.type === CrmInteractionType.PADEL_BOOKING_CONFIRMED
    ) {
      spend90d += interaction.amountCents ?? 0;
    }
    if (interaction.type === CrmInteractionType.PADEL_MATCH_WIN) {
      wins90d += 1;
    } else if (interaction.type === CrmInteractionType.PADEL_MATCH_LOSS) {
      losses90d += 1;
    } else if (PADEL_NO_SHOW_TYPE_SET.has(interaction.type)) {
      noShows90d += 1;
    }

    const countsForTime =
      interaction.type === CrmInteractionType.PADEL_BOOKING_CONFIRMED ||
      interaction.type === CrmInteractionType.PADEL_CLASS_ATTENDED ||
      interaction.type === CrmInteractionType.PADEL_MATCH_PLAYED;
    if (countsForTime && interaction.occurredAt >= since30) {
      sessionCount30d += 1;
      const hour = interaction.occurredAt.getHours();
      const bucket = resolveTimeBucket(hour);
      timeBucketCounter[bucket] += 1;
      if (hour < 17 || hour >= 22) {
        offPeakSessions30d += 1;
      }
    }
  }

  const tournamentsCount = Math.max(params.seed?.tournamentsCount ?? 0, tournamentCountAll);
  const noShowCount = Math.max(params.seed?.noShowCount ?? 0, noShowCountAll);
  const preferredTimeBucket = (() => {
    const ranking = Object.entries(timeBucketCounter).sort((a, b) => b[1] - a[1]);
    if (!ranking.length || ranking[0][1] <= 0) return null;
    return ranking[0][0];
  })();
  const offPeakRatio30d = sessionCount30d > 0 ? offPeakSessions30d / sessionCount30d : 0;
  const avgSpendPerSessionCents90d =
    sessionCount90d > 0 ? Math.round(spend90d / sessionCount90d) : 0;
  const lastNoShowAt = lastNoShowInteraction?.occurredAt ?? null;
  const projection = derivePadelProjection({
    now,
    lastMatchAt: lastMatchInteraction?.occurredAt ?? null,
    matches30d,
    wins90d,
    losses90d,
    noShows90d,
    tournamentsCount,
    level: params.seed?.level ?? null,
  });

  await client.crmContactPadel.upsert({
    where: { contactId: params.contactId },
    update: {
      organizationId: params.organizationId,
      ...(params.seed?.playerProfileId !== undefined ? { playerProfileId: params.seed.playerProfileId } : {}),
      ...(params.seed?.level !== undefined ? { level: params.seed.level } : {}),
      ...(params.seed?.preferredSide !== undefined ? { preferredSide: params.seed.preferredSide } : {}),
      ...(params.seed?.clubName !== undefined ? { clubName: params.seed.clubName } : {}),
      tournamentsCount: projection.tournamentsCount,
      tournamentCount90d,
      noShowCount,
      lastNoShowAt,
      lastMatchAt: projection.lastMatchAt,
      matches30d: projection.matches30d,
      winRate90d: projection.winRate90d,
      noShowRate90d: projection.noShowRate90d,
      preferredTimeBucket,
      offPeakRatio30d: roundRate(offPeakRatio30d),
      reservationCount90d,
      lessonCount90d,
      avgSpendPerSessionCents90d,
      activityStatus: projection.activityStatus,
      competitiveTier: projection.competitiveTier,
      rfmScore: projection.rfmScore,
      churnRiskScore: projection.churnRiskScore,
      reactivationPropensityScore: projection.reactivationPropensityScore,
    },
    create: {
      organizationId: params.organizationId,
      contactId: params.contactId,
      playerProfileId: params.seed?.playerProfileId ?? null,
      level: params.seed?.level ?? null,
      preferredSide: params.seed?.preferredSide ?? null,
      clubName: params.seed?.clubName ?? null,
      tournamentsCount: projection.tournamentsCount,
      tournamentCount90d,
      noShowCount,
      lastNoShowAt,
      lastMatchAt: projection.lastMatchAt,
      matches30d: projection.matches30d,
      winRate90d: projection.winRate90d,
      noShowRate90d: projection.noShowRate90d,
      preferredTimeBucket,
      offPeakRatio30d: roundRate(offPeakRatio30d),
      reservationCount90d,
      lessonCount90d,
      avgSpendPerSessionCents90d,
      activityStatus: projection.activityStatus,
      competitiveTier: projection.competitiveTier,
      rfmScore: projection.rfmScore,
      churnRiskScore: projection.churnRiskScore,
      reactivationPropensityScore: projection.reactivationPropensityScore,
    },
  });

  return {
    ...projection,
    lastNoShowAt,
    preferredTimeBucket,
    offPeakRatio30d: roundRate(offPeakRatio30d),
    reservationCount90d,
    lessonCount90d,
    tournamentCount90d,
    avgSpendPerSessionCents90d,
    noShowCount,
  };
}
