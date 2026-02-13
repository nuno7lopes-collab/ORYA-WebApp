import { Prisma, PadelRatingSanctionType } from "@prisma/client";
import { resolvePadelMatchStats } from "@/domain/padel/score";

type DbClient = Prisma.TransactionClient;

const SCALE = 173.7178;
const Q = Math.log(10) / 400;
const DEFAULT_RATING = 1200;
const DEFAULT_RD = 350;
const DEFAULT_SIGMA = 0.06;
const DEFAULT_TAU = 0.5;

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

export type RatingProfileState = {
  id: number;
  organizationId: number;
  playerId: number;
  rating: number;
  rd: number;
  sigma: number;
  tau: number;
  matchesPlayed: number;
  lastMatchAt: Date | null;
  lastActivityAt: Date | null;
};

export type RebuildResult = {
  processedMatches: number;
  processedPlayers: number;
  rankingRows: number;
};

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function resolveTierMultiplier(rawTier: string | null | undefined) {
  if (!rawTier) return 1.3;
  const key = rawTier.trim().toUpperCase();
  return TIER_MULTIPLIERS[key] ?? 1.3;
}

export function resolveCarryMultiplier(playerRating: number, partnerRating: number, actualScore = 0.5) {
  const diff = playerRating - partnerRating;
  if (!Number.isFinite(diff)) return 1;
  const won = actualScore >= 0.5;
  if (diff >= 400) return won ? 0.84 : 1.18;
  if (diff >= 200) return won ? 0.9 : 1.1;
  if (diff <= -400) return won ? 1.18 : 0.84;
  if (diff <= -200) return won ? 1.1 : 0.9;
  return 1;
}

export function scoreFromGames(gamesFor: number, gamesAgainst: number) {
  const total = gamesFor + gamesAgainst;
  if (total <= 0) return 0.5;
  return clamp(gamesFor / total, 0, 1);
}

export function computeVisualLevel(rating: number, leaderRating: number) {
  if (!Number.isFinite(rating) || rating <= 0) return 6;
  if (!Number.isFinite(leaderRating) || leaderRating <= 0) return 5;
  if (rating >= leaderRating) return 1;

  const abs = 5 - (Math.log(rating / DEFAULT_RATING) * 2.2);
  const gap = Math.max(0, leaderRating - rating);
  const pull = Math.log1p(gap / 400) * 0.4;
  return clamp(Number((abs + pull).toFixed(2)), 1, 6);
}

export function applyInactivityToVisual(level: number, lastActivityAt: Date | null, now = new Date()) {
  if (!lastActivityAt) return level;
  const elapsedMs = now.getTime() - lastActivityAt.getTime();
  const graceMs = 30 * 24 * 60 * 60 * 1000;
  if (elapsedMs <= graceMs) return level;
  const weeks = (elapsedMs - graceMs) / (7 * 24 * 60 * 60 * 1000);
  const drift = clamp(weeks * 0.02, 0, 1);
  return clamp(Number((level + drift).toFixed(2)), 1, 6);
}

export function glicko2Update(params: {
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

async function ensureProfile(tx: DbClient, organizationId: number, playerId: number) {
  return tx.padelRatingProfile.upsert({
    where: { playerId },
    create: {
      organizationId,
      playerId,
      rating: DEFAULT_RATING,
      rd: DEFAULT_RD,
      sigma: DEFAULT_SIGMA,
      tau: DEFAULT_TAU,
      matchesPlayed: 0,
      leaderboardEligible: true,
      blockedNewMatches: false,
      metadata: {},
    },
    update: {},
  });
}

export async function rebuildPadelRatingsForEvent(params: {
  tx: DbClient;
  organizationId: number;
  eventId: number;
  actorUserId?: string | null;
  tier?: string | null;
}) {
  const { tx, organizationId, eventId, tier } = params;

  const matches = await tx.eventMatchSlot.findMany({
    where: {
      eventId,
      status: "DONE",
      pairingAId: { not: null },
      pairingBId: { not: null },
    },
    select: {
      id: true,
      score: true,
      scoreSets: true,
      plannedEndAt: true,
      actualEndAt: true,
      updatedAt: true,
      pairingA: {
        select: {
          id: true,
          slots: { select: { playerProfileId: true } },
        },
      },
      pairingB: {
        select: {
          id: true,
          slots: { select: { playerProfileId: true } },
        },
      },
    },
    orderBy: [{ actualEndAt: "asc" }, { plannedEndAt: "asc" }, { updatedAt: "asc" }, { id: "asc" }],
  });

  const tierMultiplier = resolveTierMultiplier(tier);
  const playerProfiles = new Map<number, RatingProfileState>();
  const processedPlayers = new Set<number>();
  let processedMatches = 0;

  for (const match of matches) {
    const stats = resolvePadelMatchStats(match.scoreSets, match.score ?? null);
    if (!stats) continue;

    const sideAPlayers = (match.pairingA?.slots ?? [])
      .map((slot) => slot.playerProfileId)
      .filter((id): id is number => typeof id === "number");
    const sideBPlayers = (match.pairingB?.slots ?? [])
      .map((slot) => slot.playerProfileId)
      .filter((id): id is number => typeof id === "number");

    if (sideAPlayers.length === 0 || sideBPlayers.length === 0) continue;

    for (const playerId of [...sideAPlayers, ...sideBPlayers]) {
      if (!playerProfiles.has(playerId)) {
        const profile = await ensureProfile(tx, organizationId, playerId);
        playerProfiles.set(playerId, {
          id: profile.id,
          organizationId: profile.organizationId,
          playerId: profile.playerId,
          rating: profile.rating,
          rd: profile.rd,
          sigma: profile.sigma,
          tau: profile.tau,
          matchesPlayed: profile.matchesPlayed,
          lastMatchAt: profile.lastMatchAt,
          lastActivityAt: profile.lastActivityAt,
        });
      }
    }

    const sideARatingAvg = sideAPlayers.reduce((acc, id) => acc + (playerProfiles.get(id)?.rating ?? DEFAULT_RATING), 0) / sideAPlayers.length;
    const sideBRatingAvg = sideBPlayers.reduce((acc, id) => acc + (playerProfiles.get(id)?.rating ?? DEFAULT_RATING), 0) / sideBPlayers.length;
    const sideARdAvg = sideAPlayers.reduce((acc, id) => acc + (playerProfiles.get(id)?.rd ?? DEFAULT_RD), 0) / sideAPlayers.length;
    const sideBRdAvg = sideBPlayers.reduce((acc, id) => acc + (playerProfiles.get(id)?.rd ?? DEFAULT_RD), 0) / sideBPlayers.length;

    const scoreA = scoreFromGames(stats.aGames, stats.bGames);
    const scoreB = scoreFromGames(stats.bGames, stats.aGames);

    const now = match.actualEndAt ?? match.plannedEndAt ?? match.updatedAt;

    const applySide = async (
      sidePlayers: number[],
      opponentAvgRating: number,
      opponentAvgRd: number,
      sideScore: number,
      ownAvgRating: number,
      gamesFor: number,
      gamesAgainst: number,
    ) => {
      for (const playerId of sidePlayers) {
        const current = playerProfiles.get(playerId)!;
        const partnerAvg =
          sidePlayers.length > 1
            ? sidePlayers
                .filter((id) => id !== playerId)
                .reduce((acc, id) => acc + (playerProfiles.get(id)?.rating ?? ownAvgRating), 0) /
              (sidePlayers.length - 1)
            : ownAvgRating;
        const carryMultiplier = resolveCarryMultiplier(current.rating, partnerAvg, sideScore);
        const multiplier = tierMultiplier * carryMultiplier;

        const updated = glicko2Update({
          rating: current.rating,
          rd: current.rd,
          sigma: current.sigma,
          tau: current.tau,
          opponentRating: opponentAvgRating,
          opponentRd: opponentAvgRd,
          actualScore: sideScore,
          multiplier,
        });

        await tx.padelRatingEvent.create({
          data: {
            organizationId,
            eventId,
            matchId: match.id,
            playerId,
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
            metadata: {},
          },
        });

        current.rating = updated.rating;
        current.rd = updated.rd;
        current.sigma = updated.sigma;
        current.matchesPlayed += 1;
        current.lastMatchAt = now;
        current.lastActivityAt = now;
        processedPlayers.add(playerId);
      }
    };

    await applySide(sideAPlayers, sideBRatingAvg, sideBRdAvg, scoreA, sideARatingAvg, stats.aGames, stats.bGames);
    await applySide(sideBPlayers, sideARatingAvg, sideARdAvg, scoreB, sideBRatingAvg, stats.bGames, stats.aGames);

    processedMatches += 1;
  }

  if (playerProfiles.size === 0) {
    return { processedMatches: 0, processedPlayers: 0, rankingRows: 0 } satisfies RebuildResult;
  }

  const sortedProfiles = Array.from(playerProfiles.values()).sort(
    (a, b) => b.rating - a.rating || a.playerId - b.playerId,
  );
  const leaderRating = sortedProfiles[0]?.rating ?? DEFAULT_RATING;

  for (let idx = 0; idx < sortedProfiles.length; idx += 1) {
    const profile = sortedProfiles[idx];
    let levelVisual = computeVisualLevel(profile.rating, leaderRating);
    if (idx > 0 && levelVisual <= 1) {
      levelVisual = 1.01;
    }
    await tx.padelRatingProfile.update({
      where: { id: profile.id },
      data: {
        rating: profile.rating,
        rd: profile.rd,
        sigma: profile.sigma,
        tau: profile.tau,
        matchesPlayed: profile.matchesPlayed,
        levelVisual,
        lastMatchAt: profile.lastMatchAt,
        lastActivityAt: profile.lastActivityAt,
        lastRebuildAt: new Date(),
      },
    });
  }

  const sorted = [...sortedProfiles];
  let lastPoints: number | null = null;
  let lastPosition = 0;
  const rows = sorted.map((profile, idx) => {
    const points = Math.round(profile.rating);
    if (lastPoints === null || points !== lastPoints) {
      lastPoints = points;
      lastPosition = idx + 1;
    }
    const leader = sorted[0]?.rating ?? profile.rating;
    let levelVisual = applyInactivityToVisual(computeVisualLevel(profile.rating, leader), profile.lastActivityAt ?? null);
    if (idx > 0 && levelVisual <= 1) {
      levelVisual = 1.01;
    }
    return {
      organizationId,
      eventId,
      playerId: profile.playerId,
      points,
      position: lastPosition,
      level: levelVisual.toFixed(2),
      season: String(new Date().getUTCFullYear()),
      year: new Date().getUTCFullYear(),
    };
  });

  await tx.padelRankingEntry.deleteMany({ where: { eventId } });
  if (rows.length > 0) {
    await tx.padelRankingEntry.createMany({ data: rows });
  }

  return {
    processedMatches,
    processedPlayers: processedPlayers.size,
    rankingRows: rows.length,
  } satisfies RebuildResult;
}

export async function applyPadelRatingSanction(params: {
  tx: DbClient;
  organizationId: number;
  playerId: number;
  type: PadelRatingSanctionType;
  reasonCode?: string | null;
  reason?: string | null;
  actorUserId?: string | null;
  durationDays?: number | null;
}) {
  const {
    tx,
    organizationId,
    playerId,
    type,
    reasonCode,
    reason,
    actorUserId,
    durationDays,
  } = params;

  const now = new Date();
  const endsAt =
    typeof durationDays === "number" && Number.isFinite(durationDays) && durationDays > 0
      ? new Date(now.getTime() + Math.floor(durationDays) * 24 * 60 * 60 * 1000)
      : null;

  const sanction = await tx.padelRatingSanction.create({
    data: {
      organizationId,
      playerId,
      type,
      status: "ACTIVE",
      reasonCode: reasonCode ?? null,
      reason: reason ?? null,
      startsAt: now,
      endsAt,
      createdByUserId: actorUserId ?? null,
      metadata: {},
    },
  });

  const profile = await ensureProfile(tx, organizationId, playerId);
  if (type === "SUSPENSION") {
    await tx.padelRatingProfile.update({
      where: { id: profile.id },
      data: {
        suspensionEndsAt: endsAt,
      },
    });
  } else if (type === "BLOCK_NEW_MATCHES") {
    await tx.padelRatingProfile.update({
      where: { id: profile.id },
      data: {
        blockedNewMatches: true,
      },
    });
  } else if (type === "RESET_PARTIAL") {
    await tx.padelRatingProfile.update({
      where: { id: profile.id },
      data: {
        rating: Math.max(100, profile.rating - 250),
        rd: clamp(profile.rd + 25, 30, 350),
        lastActivityAt: now,
      },
    });
  }

  return sanction;
}
