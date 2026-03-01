import { Prisma } from "@prisma/client";
import { resolvePadelMatchStats } from "@/domain/padel/score";
import { pickCanonicalField } from "@/lib/location/eventLocation";
import { normalizePadelRankingFormatWeights, type PadelRankingFormatWeights } from "@/lib/platformSettings";

const SCALE = 173.7178;
const Q = Math.log(10) / 400;
const DEFAULT_RATING = 1200;
const DEFAULT_RD = 350;
const DEFAULT_SIGMA = 0.06;
const DEFAULT_TAU = 0.5;

const COUNTED_STATUSES = ["OFFICIAL", "WALKOVER", "RETIRED"] as const;
const PADEL_RANKING_WEIGHTS_KEY = "padel.rankingWeightsByFormat";

const TIER_MULTIPLIERS: Record<string, number> = {
  SOCIAL: 0.5,
  AMIGAVEL: 1,
  FRIENDLY: 1,
  BRONZE: 1.3,
  PRATA: 1.3,
  SILVER: 1.3,
  OURO: 2,
  GOLD: 2,
  MAJOR: 2,
};

type DbClient = Prisma.TransactionClient;

type GlobalState = {
  userId: string;
  rating: number;
  rd: number;
  sigma: number;
  tau: number;
  matchesPlayed: number;
  lastMatchAt: Date | null;
  lastActivityAt: Date | null;
  leaderboardEligible: boolean;
  blockedNewMatches: boolean;
  suspensionEndsAt: Date | null;
  metadata: Prisma.InputJsonObject;
};

type ParticipantRow = {
  side: "A" | "B";
  participant: {
    playerProfileId: number | null;
    playerProfile: {
      userId: string | null;
    } | null;
  } | null;
};

type RebuildGlobalResult = {
  processedMatches: number;
  processedPlayers: number;
  touchedUsers: string[];
};

function normalizeTier(rawTier: string | null | undefined) {
  if (!rawTier) return null;
  const normalized = rawTier.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCity(rawCity: string | null | undefined) {
  if (!rawCity) return null;
  const normalized = rawCity.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function resolveTierMultiplier(rawTier: string | null | undefined) {
  if (!rawTier) return 1.3;
  const key = rawTier.trim().toUpperCase();
  return TIER_MULTIPLIERS[key] ?? 1.3;
}

function resolveCarryMultiplier(playerRating: number, partnerRating: number, actualScore = 0.5) {
  const diff = playerRating - partnerRating;
  if (!Number.isFinite(diff)) return 1;
  const won = actualScore >= 0.5;
  if (diff >= 400) return won ? 0.84 : 1.18;
  if (diff >= 200) return won ? 0.9 : 1.1;
  if (diff <= -400) return won ? 1.18 : 0.84;
  if (diff <= -200) return won ? 1.1 : 0.9;
  return 1;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreFromGames(gamesFor: number, gamesAgainst: number) {
  const total = gamesFor + gamesAgainst;
  if (total <= 0) return 0.5;
  return clamp(gamesFor / total, 0, 1);
}

function g(phi: number) {
  return 1 / Math.sqrt(1 + (3 * Q * Q * phi * phi) / (Math.PI * Math.PI));
}

function expected(mu: number, muJ: number, phiJ: number) {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

function fFactory(delta: number, phi: number, v: number, a: number, tau: number) {
  return (x: number) => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * Math.pow(phi * phi + v + ex, 2);
    return num / den - (x - a) / (tau * tau);
  };
}

function updateSigma(phi: number, sigma: number, delta: number, v: number, tau: number) {
  const a = Math.log(sigma * sigma);
  const f = fFactory(delta, phi, v, a, tau);

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > 1e-6) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB < 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

function glicko2Update(params: {
  rating: number;
  rd: number;
  sigma: number;
  tau: number;
  opponentRating: number;
  opponentRd: number;
  actualScore: number;
  multiplier?: number;
}) {
  const {
    rating,
    rd,
    sigma,
    tau,
    opponentRating,
    opponentRd,
    actualScore,
    multiplier = 1,
  } = params;

  const mu = (rating - 1500) / SCALE;
  const phi = rd / SCALE;
  const muJ = (opponentRating - 1500) / SCALE;
  const phiJ = opponentRd / SCALE;

  const gPhi = g(phiJ);
  const E = expected(mu, muJ, phiJ);

  const v = 1 / (Q * Q * gPhi * gPhi * E * (1 - E));
  const delta = v * Q * gPhi * (actualScore - E);

  const sigmaPrime = updateSigma(phi, sigma, delta, v, tau);
  const phiStar = Math.sqrt(phi * phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muPrime = mu + phiPrime * phiPrime * Q * gPhi * (actualScore - E);

  const ratingPrimeRaw = SCALE * muPrime + 1500;
  const rdPrime = clamp(SCALE * phiPrime, 30, 350);

  const scaledRatingPrime = rating + (ratingPrimeRaw - rating) * clamp(multiplier, 0.4, 2.4);

  return {
    expectedScore: E,
    rating: clamp(scaledRatingPrime, 100, 4000),
    rd: rdPrime,
    sigma: clamp(sigmaPrime, 0.01, 1),
  };
}

function computeVisualLevel(rating: number, leaderRating: number) {
  if (!Number.isFinite(rating) || rating <= 0) return 6;
  if (!Number.isFinite(leaderRating) || leaderRating <= 0) return 5;
  if (rating >= leaderRating) return 1;

  const abs = 5 - (Math.log(rating / DEFAULT_RATING) * 2.2);
  const gap = Math.max(0, leaderRating - rating);
  const pull = Math.log1p(gap / 400) * 0.4;
  return clamp(Number((abs + pull).toFixed(2)), 1, 6);
}

function applyInactivityToVisual(level: number, lastActivityAt: Date | null, now = new Date()) {
  if (!lastActivityAt) return level;
  const elapsedMs = now.getTime() - lastActivityAt.getTime();
  const graceMs = 30 * 24 * 60 * 60 * 1000;
  if (elapsedMs <= graceMs) return level;
  const weeks = (elapsedMs - graceMs) / (7 * 24 * 60 * 60 * 1000);
  const drift = clamp(weeks * 0.02, 0, 1);
  return clamp(Number((level + drift).toFixed(2)), 1, 6);
}

function parseRankingWeight(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.min(2, Math.max(0, parsed));
}

function toSocialFormatKey(format: string | null | undefined): keyof PadelRankingFormatWeights | null {
  if (format === "NON_STOP" || format === "AMERICANO" || format === "MEXICANO") return format;
  return null;
}

async function getGlobalPadelRankingFormatWeightsTx(tx: DbClient): Promise<PadelRankingFormatWeights> {
  const stored = await tx.platformSetting.findUnique({
    where: { key: PADEL_RANKING_WEIGHTS_KEY },
    select: { value: true },
  });
  if (!stored?.value) return normalizePadelRankingFormatWeights({});
  try {
    const parsed = JSON.parse(stored.value);
    return normalizePadelRankingFormatWeights(parsed);
  } catch {
    return normalizePadelRankingFormatWeights({});
  }
}

function uniqueUsersBySide(rows: ParticipantRow[], side: "A" | "B") {
  const users = rows
    .filter((row) => row.side === side)
    .map((row) => row.participant?.playerProfile?.userId)
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  return Array.from(new Set(users));
}

function withDefaultState(
  userId: string,
  preserved?: {
    leaderboardEligible: boolean;
    blockedNewMatches: boolean;
    suspensionEndsAt: Date | null;
    metadata: Prisma.JsonValue | null;
  },
): GlobalState {
  return {
    userId,
    rating: DEFAULT_RATING,
    rd: DEFAULT_RD,
    sigma: DEFAULT_SIGMA,
    tau: DEFAULT_TAU,
    matchesPlayed: 0,
    lastMatchAt: null,
    lastActivityAt: null,
    leaderboardEligible: preserved?.leaderboardEligible ?? true,
    blockedNewMatches: preserved?.blockedNewMatches ?? false,
    suspensionEndsAt: preserved?.suspensionEndsAt ?? null,
    metadata:
      preserved?.metadata && typeof preserved.metadata === "object" && !Array.isArray(preserved.metadata)
        ? (preserved.metadata as Prisma.InputJsonObject)
        : {},
  };
}

function sortByRatingDesc<T extends { rating: number }>(rows: T[], keyOf: (row: T) => string) {
  return [...rows].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return keyOf(a).localeCompare(keyOf(b));
  });
}

function buildPositionMap(rows: Array<{ key: string; points: number }>) {
  const positions = new Map<string, number>();
  let lastPoints: number | null = null;
  let lastPosition = 0;

  rows.forEach((row, idx) => {
    if (lastPoints === null || row.points !== lastPoints) {
      lastPoints = row.points;
      lastPosition = idx + 1;
    }
    positions.set(row.key, lastPosition);
  });

  return positions;
}

export async function rebuildPadelGlobalRatings(params: { tx: DbClient }): Promise<RebuildGlobalResult> {
  const { tx } = params;

  const [globalWeights, preservedProfiles, matches] = await Promise.all([
    getGlobalPadelRankingFormatWeightsTx(tx),
    tx.padelGlobalRatingProfile.findMany({
      select: {
        userId: true,
        leaderboardEligible: true,
        blockedNewMatches: true,
        suspensionEndsAt: true,
        metadata: true,
      },
    }),
    tx.eventMatchSlot.findMany({
      where: {
        status: { in: [...COUNTED_STATUSES] },
        event: {
          templateType: "PADEL",
          isDeleted: false,
        },
      },
      select: {
        id: true,
        eventId: true,
        categoryId: true,
        score: true,
        scoreSets: true,
        plannedEndAt: true,
        actualEndAt: true,
        updatedAt: true,
        event: {
          select: {
            id: true,
            organizationId: true,
            startsAt: true,
            addressRef: { select: { canonical: true } },
            padelTournamentConfig: { select: { padelClubId: true, advancedSettings: true, format: true } },
          },
        },
        participants: {
          orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
          select: {
            side: true,
            participant: {
              select: {
                playerProfileId: true,
                playerProfile: {
                  select: {
                    userId: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ actualEndAt: "asc" }, { plannedEndAt: "asc" }, { updatedAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const preservedByUser = new Map(
    preservedProfiles.map((profile) => [
      profile.userId,
      {
        leaderboardEligible: profile.leaderboardEligible,
        blockedNewMatches: profile.blockedNewMatches,
        suspensionEndsAt: profile.suspensionEndsAt,
        metadata: profile.metadata,
      },
    ]),
  );

  const states = new Map<string, GlobalState>();
  for (const [userId, preserved] of preservedByUser.entries()) {
    states.set(userId, withDefaultState(userId, preserved));
  }
  const eventsToCreate: Prisma.PadelGlobalRatingEventCreateManyInput[] = [];
  let processedMatches = 0;

  for (const match of matches) {
    const stats = resolvePadelMatchStats(match.scoreSets, match.score ?? null);
    if (!stats) continue;

    const sideAUsers = uniqueUsersBySide(match.participants as ParticipantRow[], "A");
    const sideBUsers = uniqueUsersBySide(match.participants as ParticipantRow[], "B");

    if (sideAUsers.length === 0 || sideBUsers.length === 0) continue;

    for (const userId of [...sideAUsers, ...sideBUsers]) {
      if (!states.has(userId)) {
        states.set(userId, withDefaultState(userId, preservedByUser.get(userId)));
      }
    }

    const advancedSettings =
      (match.event?.padelTournamentConfig?.advancedSettings as Record<string, unknown> | null) ?? null;
    const contextTier = normalizeTier(
      typeof advancedSettings?.tournamentTier === "string" ? advancedSettings.tournamentTier : null,
    );
    const contextClubId =
      typeof match.event?.padelTournamentConfig?.padelClubId === "number"
        ? match.event.padelTournamentConfig.padelClubId
        : null;
    const contextCity = normalizeCity(
      pickCanonicalField(
        match.event?.addressRef?.canonical ?? null,
        "city",
        "locality",
        "addressLine2",
        "region",
        "state",
      ),
    );

    const rankingWeightsRaw =
      advancedSettings?.rankingWeights && typeof advancedSettings.rankingWeights === "object"
        ? (advancedSettings.rankingWeights as Record<string, unknown>)
        : null;
    const rankingWeightsByCategoryRaw =
      rankingWeightsRaw?.byCategory &&
      typeof rankingWeightsRaw.byCategory === "object" &&
      !Array.isArray(rankingWeightsRaw.byCategory)
        ? (rankingWeightsRaw.byCategory as Record<string, unknown>)
        : null;

    const eventFormat = match.event?.padelTournamentConfig?.format ?? null;
    const eventFormatWeightOverride = (() => {
      const formatKey = toSocialFormatKey(eventFormat);
      if (!formatKey || !rankingWeightsRaw) return null;
      return parseRankingWeight(rankingWeightsRaw[formatKey]);
    })();

    const resolveFormatWeight = (categoryId: number | null) => {
      const formatKey = toSocialFormatKey(eventFormat);
      if (!formatKey) return 1;
      if (categoryId != null && rankingWeightsByCategoryRaw) {
        const categoryConfig = rankingWeightsByCategoryRaw[String(categoryId)];
        if (categoryConfig && typeof categoryConfig === "object" && !Array.isArray(categoryConfig)) {
          const perCategory = parseRankingWeight((categoryConfig as Record<string, unknown>)[formatKey]);
          if (perCategory !== null) return perCategory;
        }
      }
      if (eventFormatWeightOverride !== null) return eventFormatWeightOverride;
      return globalWeights[formatKey] ?? 1;
    };

    const tierMultiplier = resolveTierMultiplier(contextTier);
    const formatWeight = resolveFormatWeight(match.categoryId ?? null);

    const sideARatingAvg =
      sideAUsers.reduce((acc, id) => acc + (states.get(id)?.rating ?? DEFAULT_RATING), 0) / sideAUsers.length;
    const sideBRatingAvg =
      sideBUsers.reduce((acc, id) => acc + (states.get(id)?.rating ?? DEFAULT_RATING), 0) / sideBUsers.length;
    const sideARdAvg = sideAUsers.reduce((acc, id) => acc + (states.get(id)?.rd ?? DEFAULT_RD), 0) / sideAUsers.length;
    const sideBRdAvg = sideBUsers.reduce((acc, id) => acc + (states.get(id)?.rd ?? DEFAULT_RD), 0) / sideBUsers.length;

    const scoreA = scoreFromGames(stats.aGames, stats.bGames);
    const scoreB = scoreFromGames(stats.bGames, stats.aGames);
    const occurredAt = match.actualEndAt ?? match.plannedEndAt ?? match.updatedAt ?? match.event?.startsAt ?? new Date();

    const applySide = (
      sideUsers: string[],
      opponentAvgRating: number,
      opponentAvgRd: number,
      sideScore: number,
      ownAvgRating: number,
      gamesFor: number,
      gamesAgainst: number,
    ) => {
      for (const userId of sideUsers) {
        const current = states.get(userId);
        if (!current) continue;

        const partnerAvg =
          sideUsers.length > 1
            ? sideUsers
                .filter((id) => id !== userId)
                .reduce((acc, id) => acc + (states.get(id)?.rating ?? ownAvgRating), 0) /
              (sideUsers.length - 1)
            : ownAvgRating;

        const carryMultiplier = resolveCarryMultiplier(current.rating, partnerAvg, sideScore);
        const multiplierFinal = tierMultiplier * carryMultiplier * formatWeight;

        const updated = glicko2Update({
          rating: current.rating,
          rd: current.rd,
          sigma: current.sigma,
          tau: current.tau,
          opponentRating: opponentAvgRating,
          opponentRd: opponentAvgRd,
          actualScore: sideScore,
          multiplier: multiplierFinal,
        });

        eventsToCreate.push({
          userId,
          organizationId: match.event?.organizationId ?? null,
          eventId: match.eventId,
          matchId: match.id,
          tier: contextTier,
          clubId: contextClubId,
          city: contextCity,
          opponentAvgRating,
          preRating: current.rating,
          preRd: current.rd,
          preSigma: current.sigma,
          postRating: updated.rating,
          postRd: updated.rd,
          postSigma: updated.sigma,
          expectedScore: updated.expectedScore,
          actualScore: sideScore,
          gamesFor,
          gamesAgainst,
          tierMultiplier,
          carryMultiplier,
          metadata: {
            contextTier,
            contextClubId,
            contextCity,
            format: eventFormat,
            formatWeight,
            multiplierFinal,
          },
          occurredAt,
        });

        current.rating = updated.rating;
        current.rd = updated.rd;
        current.sigma = updated.sigma;
        current.matchesPlayed += 1;
        current.lastMatchAt = occurredAt;
        current.lastActivityAt = occurredAt;
      }
    };

    applySide(sideAUsers, sideBRatingAvg, sideBRdAvg, scoreA, sideARatingAvg, stats.aGames, stats.bGames);
    applySide(sideBUsers, sideARatingAvg, sideARdAvg, scoreB, sideBRatingAvg, stats.bGames, stats.aGames);
    processedMatches += 1;
  }

  await tx.padelGlobalRatingEvent.deleteMany({});
  if (eventsToCreate.length > 0) {
    await tx.padelGlobalRatingEvent.createMany({ data: eventsToCreate });
  }

  const sortedStates = sortByRatingDesc(Array.from(states.values()), (row) => row.userId);
  const leaderRating = sortedStates[0]?.rating ?? DEFAULT_RATING;
  const now = new Date();
  const touchedUserIds = sortedStates.map((state) => state.userId);

  for (const state of sortedStates) {
    await tx.padelGlobalRatingProfile.upsert({
      where: { userId: state.userId },
      create: {
        userId: state.userId,
        rating: state.rating,
        rd: state.rd,
        sigma: state.sigma,
        tau: state.tau,
        matchesPlayed: state.matchesPlayed,
        leaderboardEligible: state.leaderboardEligible,
        blockedNewMatches: state.blockedNewMatches,
        suspensionEndsAt: state.suspensionEndsAt,
        lastMatchAt: state.lastMatchAt,
        lastActivityAt: state.lastActivityAt,
        lastRebuildAt: now,
        metadata: state.metadata,
      },
      update: {
        rating: state.rating,
        rd: state.rd,
        sigma: state.sigma,
        tau: state.tau,
        matchesPlayed: state.matchesPlayed,
        leaderboardEligible: state.leaderboardEligible,
        blockedNewMatches: state.blockedNewMatches,
        suspensionEndsAt: state.suspensionEndsAt,
        lastMatchAt: state.lastMatchAt,
        lastActivityAt: state.lastActivityAt,
        lastRebuildAt: now,
        metadata: state.metadata,
      },
    });
  }

  if (sortedStates.length > 0) {
    const users = sortedStates.map((state) => state.userId);
    const playerProfiles = await tx.padelPlayerProfile.findMany({
      where: { userId: { in: users } },
      select: { id: true, organizationId: true, userId: true },
    });

    for (const player of playerProfiles) {
      if (!player.userId) continue;
      const state = states.get(player.userId);
      if (!state) continue;
      const visual = applyInactivityToVisual(computeVisualLevel(state.rating, leaderRating), state.lastActivityAt);
      await tx.padelRatingProfile.upsert({
        where: { playerId: player.id },
        create: {
          organizationId: player.organizationId,
          playerId: player.id,
          rating: state.rating,
          rd: state.rd,
          sigma: state.sigma,
          tau: state.tau,
          matchesPlayed: state.matchesPlayed,
          levelVisual: new Prisma.Decimal(visual.toFixed(2)),
          leaderboardEligible: state.leaderboardEligible,
          blockedNewMatches: state.blockedNewMatches,
          suspensionEndsAt: state.suspensionEndsAt,
          lastMatchAt: state.lastMatchAt,
          lastActivityAt: state.lastActivityAt,
          lastRebuildAt: now,
          metadata: state.metadata,
        },
        update: {
          rating: state.rating,
          rd: state.rd,
          sigma: state.sigma,
          tau: state.tau,
          matchesPlayed: state.matchesPlayed,
          levelVisual: new Prisma.Decimal(visual.toFixed(2)),
          leaderboardEligible: state.leaderboardEligible,
          blockedNewMatches: state.blockedNewMatches,
          suspensionEndsAt: state.suspensionEndsAt,
          lastMatchAt: state.lastMatchAt,
          lastActivityAt: state.lastActivityAt,
          lastRebuildAt: now,
          metadata: state.metadata,
        },
      });
    }
  }

  return {
    processedMatches,
    processedPlayers: sortedStates.length,
    touchedUsers: touchedUserIds,
  };
}

async function listEventParticipantUsers(tx: DbClient, eventId: number) {
  const participants = await tx.padelTournamentParticipant.findMany({
    where: { eventId },
    select: {
      playerProfileId: true,
      playerProfile: {
        select: {
          userId: true,
          fullName: true,
          displayName: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  const resolved = participants
    .map((row) => {
      const resolvedName = row.playerProfile?.displayName ?? row.playerProfile?.fullName ?? null;
      return {
        userId: row.playerProfile?.userId ?? null,
        playerId: row.playerProfileId,
        name: typeof resolvedName === "string" ? resolvedName : null,
      };
    })
    .filter((row): row is { userId: string; playerId: number; name: string | null } => {
      return typeof row.userId === "string" && row.userId.length > 0;
    });

  if (resolved.length > 0) {
    const byUser = new Map<string, { userId: string; playerId: number; name: string | null }>();
    resolved.forEach((row) => {
      if (!byUser.has(row.userId)) byUser.set(row.userId, row);
    });
    return Array.from(byUser.values());
  }

  const fallback = await tx.eventMatchSlot.findMany({
    where: { eventId },
    select: {
      participants: {
        select: {
          participant: {
            select: {
              playerProfileId: true,
              playerProfile: {
                select: {
                  userId: true,
                  fullName: true,
                  displayName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const byUser = new Map<string, { userId: string; playerId: number; name: string | null }>();
  for (const row of fallback) {
    for (const participant of row.participants) {
      const userId = participant.participant?.playerProfile?.userId;
      const playerId = participant.participant?.playerProfileId;
      if (!userId || !playerId) continue;
      if (byUser.has(userId)) continue;
      byUser.set(userId, {
        userId,
        playerId,
        name:
          participant.participant?.playerProfile?.displayName || participant.participant?.playerProfile?.fullName || null,
      });
    }
  }

  return Array.from(byUser.values());
}

function mapPointsAndPositions(rows: Array<{ key: string; rating: number }>) {
  const sorted = [...rows].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.key.localeCompare(b.key);
  });
  const withPoints = sorted.map((row) => ({ key: row.key, rating: row.rating, points: Math.round(row.rating) }));
  const positions = buildPositionMap(withPoints.map((row) => ({ key: row.key, points: row.points })));
  return { sorted: withPoints, positions };
}

export async function syncPadelRankingEntriesForEventFromGlobal(params: {
  tx: DbClient;
  eventId: number;
  organizationId: number;
}) {
  const { tx, eventId, organizationId } = params;
  const participants = await listEventParticipantUsers(tx, eventId);
  if (participants.length === 0) {
    await tx.padelRankingEntry.deleteMany({ where: { eventId } });
    return 0;
  }

  const userIds = participants.map((row) => row.userId);
  const profiles = await tx.padelGlobalRatingProfile.findMany({
    where: { userId: { in: userIds } },
    select: {
      userId: true,
      rating: true,
      lastActivityAt: true,
    },
  });
  const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));

  const participantRatings = participants.map((row) => ({
    key: row.userId,
    playerId: row.playerId,
    rating: profileMap.get(row.userId)?.rating ?? DEFAULT_RATING,
    lastActivityAt: profileMap.get(row.userId)?.lastActivityAt ?? null,
  }));

  const leader = participantRatings.reduce((acc, row) => Math.max(acc, row.rating), DEFAULT_RATING);
  const { sorted, positions } = mapPointsAndPositions(participantRatings.map((row) => ({ key: row.key, rating: row.rating })));
  const ratingByUser = new Map(participantRatings.map((row) => [row.key, row]));
  const nowYear = new Date().getUTCFullYear();

  const rows: Prisma.PadelRankingEntryCreateManyInput[] = [];
  for (const row of sorted) {
    const info = ratingByUser.get(row.key);
    if (!info) continue;
    const visual = applyInactivityToVisual(computeVisualLevel(info.rating, leader), info.lastActivityAt);
    rows.push({
      organizationId,
      eventId,
      playerId: info.playerId,
      points: row.points,
      position: positions.get(row.key) ?? null,
      level: visual.toFixed(2),
      season: String(nowYear),
      year: nowYear,
    });
  }

  await tx.padelRankingEntry.deleteMany({ where: { eventId } });
  if (rows.length > 0) {
    await tx.padelRankingEntry.createMany({ data: rows });
  }

  return rows.length;
}

export async function getOrganizationGlobalPositionMap(params: { tx: DbClient; organizationId: number }) {
  const { tx, organizationId } = params;

  const orgPlayers = await tx.padelPlayerProfile.findMany({
    where: { organizationId, userId: { not: null } },
    select: { userId: true },
  });
  const userIds = Array.from(new Set(orgPlayers.map((row) => row.userId).filter((row): row is string => !!row)));
  if (userIds.length === 0) return new Map<string, number>();

  const profiles = await tx.padelGlobalRatingProfile.findMany({
    where: {
      userId: { in: userIds },
      matchesPlayed: { gt: 0 },
    },
    select: { userId: true, rating: true },
  });

  const sorted = profiles
    .map((profile) => ({ key: profile.userId, points: Math.round(profile.rating), rating: profile.rating }))
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.key.localeCompare(b.key);
    });

  return buildPositionMap(sorted.map((row) => ({ key: row.key, points: row.points })));
}

export async function getGlobalLeaderboardPosition(params: { tx: DbClient; userId: string }) {
  const { tx, userId } = params;
  const profile = await tx.padelGlobalRatingProfile.findUnique({
    where: { userId },
    select: { rating: true, leaderboardEligible: true, matchesPlayed: true },
  });
  if (!profile || !profile.leaderboardEligible || profile.matchesPlayed <= 0) return null;

  const ahead = await tx.padelGlobalRatingProfile.count({
    where: {
      leaderboardEligible: true,
      matchesPlayed: { gt: 0 },
      OR: [
        { rating: { gt: profile.rating } },
        { rating: profile.rating, userId: { lt: userId } },
      ],
    },
  });

  return ahead + 1;
}

async function resolveRatingsAtInstant(tx: DbClient, at: Date) {
  const rows = await tx.$queryRaw<Array<{ user_id: string; post_rating: number }>>(Prisma.sql`
    SELECT DISTINCT ON (e.user_id)
      e.user_id,
      e.post_rating
    FROM app_v3.padel_global_rating_events e
    WHERE e.occurred_at <= ${at}
    ORDER BY e.user_id, e.occurred_at DESC, e.id DESC
  `);

  return new Map(rows.map((row) => [row.user_id, Number(row.post_rating)]));
}

export async function ensurePadelEventRankingSnapshot(params: {
  tx: DbClient;
  eventId: number;
  snapshotMode?: "START" | "CURRENT";
}) {
  const { tx, eventId, snapshotMode = "START" } = params;

  const existing = await tx.padelEventRankingSnapshot.count({
    where: { eventId, snapshotMode },
  });
  if (existing > 0) return existing;

  const event = await tx.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      id: true,
      organizationId: true,
      startsAt: true,
      templateType: true,
    },
  });

  if (!event || event.organizationId == null || event.templateType !== "PADEL") return 0;

  const participants = await listEventParticipantUsers(tx, eventId);
  if (participants.length === 0) return 0;

  const participantByUser = new Map(participants.map((row) => [row.userId, row]));
  const participantUserIds = Array.from(participantByUser.keys());

  const ratingByUser =
    snapshotMode === "START"
      ? await resolveRatingsAtInstant(tx, event.startsAt ?? new Date())
      : new Map(
          (
            await tx.padelGlobalRatingProfile.findMany({
              where: { userId: { in: participantUserIds } },
              select: { userId: true, rating: true },
            })
          ).map((row) => [row.userId, row.rating]),
        );

  const globalSourceRatings =
    snapshotMode === "START"
      ? await resolveRatingsAtInstant(tx, event.startsAt ?? new Date())
      : new Map(
          (
            await tx.padelGlobalRatingProfile.findMany({
              where: {
                leaderboardEligible: true,
                matchesPlayed: { gt: 0 },
              },
              select: { userId: true, rating: true },
            })
          ).map((row) => [row.userId, row.rating]),
        );

  for (const userId of participantUserIds) {
    if (!globalSourceRatings.has(userId)) {
      globalSourceRatings.set(userId, ratingByUser.get(userId) ?? DEFAULT_RATING);
    }
  }

  const globalRows = Array.from(globalSourceRatings.entries()).map(([key, rating]) => ({ key, rating }));
  const globalPositionMap = mapPointsAndPositions(globalRows).positions;

  const orgUsers = Array.from(
    new Set(
      (
        await tx.padelPlayerProfile.findMany({
          where: { organizationId: event.organizationId, userId: { not: null } },
          select: { userId: true },
        })
      )
        .map((row) => row.userId)
        .filter((row): row is string => !!row),
    ),
  );

  const orgRows = orgUsers.map((userId) => ({
    key: userId,
    rating: globalSourceRatings.get(userId) ?? ratingByUser.get(userId) ?? DEFAULT_RATING,
  }));
  const orgPositionMap = mapPointsAndPositions(orgRows).positions;

  const rows: Prisma.PadelEventRankingSnapshotCreateManyInput[] = participantUserIds.map((userId) => {
    const participant = participantByUser.get(userId)!;
    const rating = ratingByUser.get(userId) ?? DEFAULT_RATING;
    return {
      organizationId: event.organizationId!,
      eventId,
      userId,
      playerId: participant.playerId,
      snapshotMode,
      rating,
      points: Math.round(rating),
      globalPosition: globalPositionMap.get(userId) ?? null,
      organizationPosition: orgPositionMap.get(userId) ?? null,
      occurredAt: snapshotMode === "START" ? event.startsAt ?? new Date() : new Date(),
    };
  });

  if (rows.length > 0) {
    await tx.padelEventRankingSnapshot.createMany({ data: rows });
  }

  return rows.length;
}
