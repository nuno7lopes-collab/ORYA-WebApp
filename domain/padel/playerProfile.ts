import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordCrmIngestOutbox } from "@/domain/crm/outbox";
import { reassignWinnerParticipantOnMatchSlots } from "@/domain/padel/matches/commands";

const DEFAULT_RETROACTIVE_CLAIM_MONTHS = 6;

export class PadelClaimWindowExpiredError extends Error {
  constructor() {
    super("CLAIM_WINDOW_EXPIRED");
    this.name = "PadelClaimWindowExpiredError";
  }
}

export function isPadelClaimWindowExpiredError(error: unknown): error is PadelClaimWindowExpiredError {
  return error instanceof PadelClaimWindowExpiredError || (error instanceof Error && error.message === "CLAIM_WINDOW_EXPIRED");
}

async function recordPadelProfileCrmEvent(params: {
  organizationId: number;
  playerProfileId: number;
  userId?: string | null;
  email?: string | null;
  displayName?: string | null;
  tx?: Prisma.TransactionClient | PrismaClient;
}) {
  const { organizationId, playerProfileId, userId, email, displayName, tx } = params;
  const eventId = crypto.randomUUID();
  const client = tx ?? prisma;
  const log = await appendEventLog(
    {
      eventId,
      organizationId,
      eventType: "crm.padel_profile",
      eventVersion: "1.0.0",
      idempotencyKey: `${playerProfileId}:${eventId}`,
      actorUserId: userId ?? null,
      payload: {
        playerProfileId,
        userId: userId ?? null,
        email: email ?? null,
        displayName: displayName ?? null,
      },
    },
    client,
  );
  if (!log) return;
  await recordCrmIngestOutbox(
    {
      eventLogId: log.id,
      organizationId,
      correlationId: String(playerProfileId),
    },
    client,
  );
}

export async function upsertPadelPlayerProfile(params: {
  organizationId: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  level?: string | null;
  userId?: string | null;
}) {
  const { organizationId, fullName, email, phone, gender, level, userId } = params;
  const emailClean = email?.trim().toLowerCase() || null;
  const phoneClean = phone?.trim() || null;

  try {
    let resolvedUserId = userId ?? null;
    if (!resolvedUserId && emailClean) {
      const matchedUser = await prisma.users.findFirst({
        where: { email: emailClean },
        select: { id: true },
      });
      resolvedUserId = matchedUser?.id ?? null;
    }

    if (resolvedUserId) {
      const [profile, authUser] = await Promise.all([
        prisma.profile.findUnique({
          where: { id: resolvedUserId },
          select: { fullName: true, contactPhone: true, gender: true, padelLevel: true },
        }),
        prisma.users.findUnique({ where: { id: resolvedUserId }, select: { email: true } }),
      ]);
      const resolvedName = fullName.trim() || profile?.fullName?.trim() || "Jogador Padel";
      const resolvedEmail = (emailClean || authUser?.email) ?? null;
      const resolvedPhone = (phoneClean || profile?.contactPhone) ?? null;

      const existing = await prisma.padelPlayerProfile.findFirst({
        where: { organizationId, userId: resolvedUserId },
        select: { id: true },
      });

      if (existing?.id) {
        await prisma.padelPlayerProfile.update({
          where: { id: existing.id },
          data: {
            fullName: resolvedName,
            displayName: resolvedName,
            email: resolvedEmail || undefined,
            phone: resolvedPhone ?? undefined,
            gender: gender ?? profile?.gender ?? undefined,
            level: level ?? profile?.padelLevel ?? undefined,
          },
        });
        await recordPadelProfileCrmEvent({
          organizationId,
          playerProfileId: existing.id,
          userId: resolvedUserId,
          email: resolvedEmail ?? null,
          displayName: resolvedName ?? null,
        });
        return;
      }

      const created = await prisma.padelPlayerProfile.create({
        data: {
          organizationId,
          userId: resolvedUserId,
          fullName: resolvedName,
          displayName: resolvedName,
          email: resolvedEmail || undefined,
          phone: resolvedPhone ?? undefined,
          gender: gender ?? profile?.gender ?? undefined,
          level: level ?? profile?.padelLevel ?? undefined,
        },
        select: { id: true },
      });
      await recordPadelProfileCrmEvent({
        organizationId,
        playerProfileId: created.id,
        userId: resolvedUserId,
        email: resolvedEmail ?? null,
        displayName: resolvedName ?? null,
      });
      return;
    }

    if (!fullName.trim()) return;

    const existing = emailClean
      ? await prisma.padelPlayerProfile.findFirst({
          where: { organizationId, email: emailClean },
          select: { id: true },
        })
      : null;

    if (existing?.id) {
      await prisma.padelPlayerProfile.update({
        where: { id: existing.id },
        data: {
          fullName,
          phone: phoneClean ?? undefined,
          gender: gender ?? undefined,
          level: level ?? undefined,
        },
      });
      await recordPadelProfileCrmEvent({
        organizationId,
        playerProfileId: existing.id,
        userId: null,
        email: emailClean ?? null,
        displayName: fullName ?? null,
      });
      return;
    }

    const created = await prisma.padelPlayerProfile.create({
      data: {
        organizationId,
        fullName,
        email: emailClean || undefined,
        phone: phoneClean ?? undefined,
        gender: gender ?? undefined,
        level: level ?? undefined,
      },
      select: { id: true },
    });
    await recordPadelProfileCrmEvent({
      organizationId,
      playerProfileId: created.id,
      userId: null,
      email: emailClean ?? null,
      displayName: fullName ?? null,
    });
  } catch (err) {
    console.warn("[padel] upsertPadelPlayerProfile falhou (ignorado)", err);
  }
}

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || null;

const resolveRetroactiveCutoff = (months: number) => {
  const safeMonths = Number.isFinite(months) && months > 0 ? Math.floor(months) : DEFAULT_RETROACTIVE_CLAIM_MONTHS;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - safeMonths);
  return cutoff;
};

const maxDate = (a: Date | null | undefined, b: Date | null | undefined) => {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
};

async function resolveLatestCompetitiveActivityDate(
  tx: Prisma.TransactionClient | PrismaClient,
  organizationId: number,
  playerProfileId: number,
) {
  const [ratingEventMax, participantMax, rankingMax] = await Promise.all([
    tx.padelRatingEvent.aggregate({
      where: { organizationId, playerId: playerProfileId },
      _max: { createdAt: true },
    }),
    tx.padelTournamentParticipant.aggregate({
      where: { organizationId, playerProfileId },
      _max: { createdAt: true },
    }),
    tx.padelRankingEntry.aggregate({
      where: { organizationId, playerId: playerProfileId },
      _max: { createdAt: true },
    }),
  ]);

  return maxDate(maxDate(ratingEventMax._max.createdAt, participantMax._max.createdAt), rankingMax._max.createdAt);
}

async function mergeTournamentParticipants(params: {
  tx: Prisma.TransactionClient | PrismaClient;
  organizationId: number;
  sourceProfileId: number;
  targetProfileId: number;
}) {
  const { tx, organizationId, sourceProfileId, targetProfileId } = params;
  const sourceParticipants = await tx.padelTournamentParticipant.findMany({
    where: { organizationId, playerProfileId: sourceProfileId },
    select: { id: true, eventId: true, categoryId: true },
  });

  for (const sourceParticipant of sourceParticipants) {
    const duplicate = await tx.padelTournamentParticipant.findFirst({
      where: {
        eventId: sourceParticipant.eventId,
        categoryId: sourceParticipant.categoryId,
        playerProfileId: targetProfileId,
      },
      select: { id: true },
    });

    if (duplicate?.id) {
      await tx.padelMatchParticipant.updateMany({
        where: { participantId: sourceParticipant.id },
        data: { participantId: duplicate.id },
      });
      await reassignWinnerParticipantOnMatchSlots({
        tx,
        sourceParticipantId: sourceParticipant.id,
        targetParticipantId: duplicate.id,
      });
      await tx.padelTournamentParticipant.delete({ where: { id: sourceParticipant.id } });
      continue;
    }

    await tx.padelTournamentParticipant.update({
      where: { id: sourceParticipant.id },
      data: { playerProfileId: targetProfileId },
    });
  }
}

async function mergeRatingProfiles(params: {
  tx: Prisma.TransactionClient | PrismaClient;
  sourceProfileId: number;
  targetProfileId: number;
  claimKey: string | null;
}) {
  const { tx, sourceProfileId, targetProfileId, claimKey } = params;
  const [targetRating, sourceRating] = await Promise.all([
    tx.padelRatingProfile.findUnique({ where: { playerId: targetProfileId } }),
    tx.padelRatingProfile.findUnique({ where: { playerId: sourceProfileId } }),
  ]);

  if (!sourceRating) return;

  if (!targetRating) {
    await tx.padelRatingProfile.update({
      where: { id: sourceRating.id },
      data: {
        playerId: targetProfileId,
        metadata: {
          ...((sourceRating.metadata as Record<string, unknown> | null) ?? {}),
          ...(claimKey ? { claimKey } : {}),
          mergedFromPlayerProfileId: sourceProfileId,
        },
      },
    });
    return;
  }

  const totalMatches = targetRating.matchesPlayed + sourceRating.matchesPlayed;
  const weightedRating =
    totalMatches > 0
      ? (targetRating.rating * targetRating.matchesPlayed + sourceRating.rating * sourceRating.matchesPlayed) / totalMatches
      : Math.max(targetRating.rating, sourceRating.rating);
  const metadata = {
    ...((sourceRating.metadata as Record<string, unknown> | null) ?? {}),
    ...((targetRating.metadata as Record<string, unknown> | null) ?? {}),
    ...(claimKey ? { claimKey } : {}),
    mergedFromPlayerProfileId: sourceProfileId,
  };

  await tx.padelRatingProfile.update({
    where: { id: targetRating.id },
    data: {
      rating: weightedRating,
      rd: Math.max(targetRating.rd, sourceRating.rd),
      sigma: Math.max(targetRating.sigma, sourceRating.sigma),
      tau: Math.max(targetRating.tau, sourceRating.tau),
      matchesPlayed: totalMatches,
      leaderboardEligible: targetRating.leaderboardEligible || sourceRating.leaderboardEligible,
      blockedNewMatches: targetRating.blockedNewMatches || sourceRating.blockedNewMatches,
      suspensionEndsAt: maxDate(targetRating.suspensionEndsAt, sourceRating.suspensionEndsAt),
      lastMatchAt: maxDate(targetRating.lastMatchAt, sourceRating.lastMatchAt),
      lastActivityAt: maxDate(targetRating.lastActivityAt, sourceRating.lastActivityAt),
      lastRebuildAt: maxDate(targetRating.lastRebuildAt, sourceRating.lastRebuildAt),
      metadata,
    },
  });

  await tx.padelRatingProfile.delete({ where: { id: sourceRating.id } });
}

async function mergePlayerProfileData(params: {
  tx: Prisma.TransactionClient | PrismaClient;
  organizationId: number;
  sourceProfileId: number;
  targetProfileId: number;
  userId: string;
  claimKey: string | null;
}) {
  const { tx, organizationId, sourceProfileId, targetProfileId, userId, claimKey } = params;
  if (sourceProfileId === targetProfileId) return;

  await tx.padelPairingSlot.updateMany({
    where: { playerProfileId: sourceProfileId },
    data: { playerProfileId: targetProfileId, profileId: userId },
  });
  await tx.calendarAvailability.updateMany({
    where: { organizationId, playerProfileId: sourceProfileId },
    data: { playerProfileId: targetProfileId },
  });
  await tx.crmContactPadel.updateMany({
    where: { organizationId, playerProfileId: sourceProfileId },
    data: { playerProfileId: targetProfileId },
  });
  await tx.padelRankingEntry.updateMany({
    where: { organizationId, playerId: sourceProfileId },
    data: { playerId: targetProfileId },
  });
  await tx.padelRatingEvent.updateMany({
    where: { organizationId, playerId: sourceProfileId },
    data: { playerId: targetProfileId },
  });
  await tx.padelRatingSanction.updateMany({
    where: { organizationId, playerId: sourceProfileId },
    data: { playerId: targetProfileId },
  });

  await mergeTournamentParticipants({
    tx,
    organizationId,
    sourceProfileId,
    targetProfileId,
  });
  await mergeRatingProfiles({
    tx,
    sourceProfileId,
    targetProfileId,
    claimKey,
  });

  try {
    await tx.padelPlayerProfile.delete({ where: { id: sourceProfileId } });
  } catch {
    await tx.padelPlayerProfile.update({
      where: { id: sourceProfileId },
      data: {
        userId: null,
        email: null,
        isActive: false,
        notes: `MERGED_INTO:${targetProfileId}`,
      },
    });
  }
}

export async function ensurePadelPlayerProfileId(
  tx: Prisma.TransactionClient | PrismaClient,
  params: {
    organizationId: number;
    userId: string;
    claimKey?: string | null;
    retroactiveClaimMonths?: number | null;
  },
) {
  const { organizationId, userId } = params;
  const claimKey = typeof params.claimKey === "string" && params.claimKey.trim() ? params.claimKey.trim() : null;
  const retroactiveClaimMonths =
    typeof params.retroactiveClaimMonths === "number" && Number.isFinite(params.retroactiveClaimMonths)
      ? Math.max(1, Math.floor(params.retroactiveClaimMonths))
      : DEFAULT_RETROACTIVE_CLAIM_MONTHS;
  const existing = await tx.padelPlayerProfile.findFirst({
    where: { organizationId, userId },
    select: { id: true, fullName: true, displayName: true, email: true, phone: true, gender: true, level: true, preferredSide: true, clubName: true },
  });
  const [profile, authUser] = await Promise.all([
    tx.profile.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        contactPhone: true,
        gender: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
      },
    }),
    tx.users.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const email = normalizeEmail(authUser?.email ?? null);
  const provisional = email
    ? await tx.padelPlayerProfile.findFirst({
        where: {
          organizationId,
          userId: null,
          email,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          fullName: true,
          displayName: true,
          email: true,
          phone: true,
          gender: true,
          level: true,
          preferredSide: true,
          clubName: true,
        },
      })
    : null;

  if (claimKey && provisional) {
    const latestActivity = await resolveLatestCompetitiveActivityDate(tx, organizationId, provisional.id);
    const cutoff = resolveRetroactiveCutoff(retroactiveClaimMonths);
    if (latestActivity && latestActivity < cutoff) {
      throw new PadelClaimWindowExpiredError();
    }
  }

  const resolvedName =
    profile?.fullName?.trim() ||
    existing?.fullName?.trim() ||
    provisional?.fullName?.trim() ||
    existing?.displayName?.trim() ||
    provisional?.displayName?.trim() ||
    "Jogador Padel";
  const resolvedEmail = normalizeEmail(email ?? existing?.email ?? provisional?.email ?? null);
  const resolvedPhone = profile?.contactPhone ?? existing?.phone ?? provisional?.phone ?? null;
  const resolvedGender = profile?.gender ?? existing?.gender ?? provisional?.gender ?? undefined;
  const resolvedLevel = profile?.padelLevel ?? existing?.level ?? provisional?.level ?? undefined;
  const resolvedPreferredSide = profile?.padelPreferredSide ?? existing?.preferredSide ?? provisional?.preferredSide ?? undefined;
  const resolvedClubName = profile?.padelClubName ?? existing?.clubName ?? provisional?.clubName ?? undefined;

  if (existing) {
    if (provisional && provisional.id !== existing.id) {
      await mergePlayerProfileData({
        tx,
        organizationId,
        sourceProfileId: provisional.id,
        targetProfileId: existing.id,
        userId,
        claimKey,
      });
    }
    await tx.padelPlayerProfile.update({
      where: { id: existing.id },
      data: {
        userId,
        fullName: resolvedName,
        displayName: resolvedName,
        email: resolvedEmail ?? undefined,
        phone: resolvedPhone ?? undefined,
        gender: resolvedGender,
        level: resolvedLevel,
        preferredSide: resolvedPreferredSide,
        clubName: resolvedClubName,
        isActive: true,
      },
    });
    await recordPadelProfileCrmEvent({
      organizationId,
      playerProfileId: existing.id,
      userId,
      email: resolvedEmail ?? null,
      displayName: resolvedName,
      tx,
    });
    return existing.id;
  }

  if (provisional) {
    await tx.padelPlayerProfile.update({
      where: { id: provisional.id },
      data: {
        userId,
        fullName: resolvedName,
        displayName: resolvedName,
        email: resolvedEmail ?? undefined,
        phone: resolvedPhone ?? undefined,
        gender: resolvedGender,
        level: resolvedLevel,
        preferredSide: resolvedPreferredSide,
        clubName: resolvedClubName,
        isActive: true,
      },
    });
    await recordPadelProfileCrmEvent({
      organizationId,
      playerProfileId: provisional.id,
      userId,
      email: resolvedEmail ?? null,
      displayName: resolvedName,
      tx,
    });
    return provisional.id;
  }

  const created = await tx.padelPlayerProfile.create({
    data: {
      organizationId,
      userId,
      fullName: resolvedName,
      displayName: resolvedName,
      email: resolvedEmail ?? undefined,
      phone: resolvedPhone ?? undefined,
      gender: resolvedGender,
      level: resolvedLevel,
      preferredSide: resolvedPreferredSide,
      clubName: resolvedClubName,
      isActive: true,
    },
    select: { id: true },
  });
  await recordPadelProfileCrmEvent({
    organizationId,
    playerProfileId: created.id,
    userId,
    email: resolvedEmail ?? null,
    displayName: resolvedName,
    tx,
  });
  return created.id;
}
