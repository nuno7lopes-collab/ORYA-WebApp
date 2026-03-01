import { Prisma, PadelRatingSanctionType } from "@prisma/client";
import { rebuildPadelGlobalRatings, syncPadelRankingEntriesForEventFromGlobal } from "@/domain/padel/globalRating";
import { pickCanonicalField } from "@/lib/location/eventLocation";

type DbClient = Prisma.TransactionClient;

const SCALE = 173.7178;
const Q = Math.log(10) / 400;
const DEFAULT_RATING = 1200;
const DEFAULT_RD = 350;
const DEFAULT_SIGMA = 0.06;
const DEFAULT_TAU = 0.5;
const COUNTED_STATUSES = ["OFFICIAL", "WALKOVER", "RETIRED"] as const;

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

function normalizeTierContext(rawTier: string | null | undefined) {
  if (!rawTier) return null;
  const normalized = rawTier.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCityContext(rawCity: string | null | undefined) {
  if (!rawCity) return null;
  const normalized = rawCity.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

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

export type PadelRatingEventContext = {
  organizationId: number | null;
  tier: string | null;
  clubId: number | null;
  city: string | null;
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

export async function resolvePadelRatingEventContext(params: {
  tx: DbClient;
  eventId: number;
  tier?: string | null;
}): Promise<PadelRatingEventContext | null> {
  const { tx, eventId, tier } = params;
  const eventContext = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizationId: true,
      addressRef: { select: { canonical: true } },
      padelTournamentConfig: { select: { padelClubId: true, advancedSettings: true } },
    },
  });
  if (!eventContext) return null;

  const advancedSettings = (eventContext.padelTournamentConfig?.advancedSettings as Record<string, unknown> | null) ?? null;
  const contextTier =
    normalizeTierContext(tier) ??
    normalizeTierContext(typeof advancedSettings?.tournamentTier === "string" ? advancedSettings.tournamentTier : null);
  const contextClubId =
    typeof eventContext.padelTournamentConfig?.padelClubId === "number"
      ? eventContext.padelTournamentConfig.padelClubId
      : null;
  const contextCity = normalizeCityContext(
    pickCanonicalField(
      eventContext.addressRef?.canonical ?? null,
      "city",
      "locality",
      "addressLine2",
      "region",
      "state",
    ),
  );

  return {
    organizationId: eventContext.organizationId ?? null,
    tier: contextTier,
    clubId: contextClubId,
    city: contextCity,
  };
}

export async function backfillPadelRatingEventContextForEvent(params: {
  tx: DbClient;
  organizationId: number;
  eventId: number;
  tier?: string | null;
}) {
  const { tx, organizationId, eventId, tier } = params;
  const context = await resolvePadelRatingEventContext({ tx, eventId, tier });
  if (!context || context.organizationId !== organizationId) {
    return { ok: false as const, error: "EVENT_NOT_FOUND" };
  }

  const data: Prisma.PadelRatingEventUpdateManyMutationInput = {};
  if (context.tier) data.tier = context.tier;
  if (typeof context.clubId === "number") data.clubId = context.clubId;
  if (context.city) data.city = context.city;
  if (Object.keys(data).length === 0) {
    return {
      ok: true as const,
      updated: 0,
      context: {
        tier: context.tier,
        clubId: context.clubId,
        city: context.city,
      },
    };
  }

  const updated = await tx.padelRatingEvent.updateMany({
    where: { eventId },
    data,
  });

  return {
    ok: true as const,
    updated: updated.count,
    context: {
      tier: context.tier,
      clubId: context.clubId,
      city: context.city,
    },
  };
}

export async function rebuildPadelRatingsForEvent(params: {
  tx: DbClient;
  organizationId: number;
  eventId: number;
  actorUserId?: string | null;
  tier?: string | null;
}) {
  const { tx, organizationId, eventId, tier } = params;
  const context = await resolvePadelRatingEventContext({ tx, eventId, tier });
  if (!context || context.organizationId !== organizationId) {
    return { processedMatches: 0, processedPlayers: 0, rankingRows: 0 } satisfies RebuildResult;
  }

  await rebuildPadelGlobalRatings({ tx });
  const rankingRows = await syncPadelRankingEntriesForEventFromGlobal({
    tx,
    eventId,
    organizationId,
  });
  const processedMatches = await tx.eventMatchSlot.count({
    where: {
      eventId,
      status: { in: [...COUNTED_STATUSES] },
    },
  });

  return {
    processedMatches,
    processedPlayers: rankingRows,
    rankingRows,
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
