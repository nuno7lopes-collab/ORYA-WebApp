export const runtime = "nodejs";

import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import {
  INACTIVE_REGISTRATION_STATUSES,
  mapRegistrationToPairingLifecycle,
} from "@/domain/padelRegistration";
import { computeUserPadelStats } from "@/domain/padel/userStats";
import { PadelPairingSlotStatus, Prisma } from "@prisma/client";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
import { withPadelGlobalRatingFallback } from "@/lib/padel/globalRatingSchema";
const MAX_PAIRINGS = 20;
const MAX_WAITLIST = 10;
const MAX_MATCHES = 120;

async function _GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const [profile, fallbackPadel, playerProfiles, globalRatingProfile] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        fullName: true,
        username: true,
        avatarUrl: true,
        contactPhone: true,
        gender: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
      },
    }),
    prisma.padelPlayerProfile.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { level: true, preferredSide: true, clubName: true },
    }),
    prisma.padelPlayerProfile.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        id: true,
        organizationId: true,
        updatedAt: true,
        ratingProfile: {
          select: {
            matchesPlayed: true,
          },
        },
      },
    }),
    withPadelGlobalRatingFallback(
      () =>
        prisma.padelGlobalRatingProfile.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            rating: true,
            rd: true,
            sigma: true,
            matchesPlayed: true,
            leaderboardEligible: true,
            blockedNewMatches: true,
            lastMatchAt: true,
            lastActivityAt: true,
            lastRebuildAt: true,
          },
        }),
      null,
      "app/api/padel/me/summary#globalProfile",
    ),
  ]);

  const sourcePlayerProfile =
    [...playerProfiles].sort((a, b) => {
      const aMatches = a.ratingProfile?.matchesPlayed ?? -1;
      const bMatches = b.ratingProfile?.matchesPlayed ?? -1;
      if (aMatches !== bMatches) return bMatches - aMatches;
      return b.updatedAt.getTime() - a.updatedAt.getTime() || a.id - b.id;
    })[0] ?? null;

  let orgPosition: number | null = null;
  let globalPosition: number | null = null;

  if (sourcePlayerProfile && globalRatingProfile) {
    const orgPlayers = await prisma.padelPlayerProfile.findMany({
      where: {
        organizationId: sourcePlayerProfile.organizationId,
        userId: { not: null },
      },
      select: { userId: true },
    });
    const orgUserIds = Array.from(
      new Set(orgPlayers.map((row) => row.userId).filter((value): value is string => typeof value === "string")),
    );

    if (orgUserIds.length > 0) {
      const orgGlobalProfiles = await withPadelGlobalRatingFallback(
        () =>
          prisma.padelGlobalRatingProfile.findMany({
            where: {
              userId: { in: orgUserIds },
              matchesPlayed: { gt: 0 },
            },
            select: { userId: true, rating: true },
          }),
        [],
        "app/api/padel/me/summary#orgRanking",
      );

      const sorted = orgGlobalProfiles.sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return a.userId.localeCompare(b.userId);
      });
      const positions = new Map<string, number>();
      let lastPoints: number | null = null;
      let lastPosition = 0;
      sorted.forEach((entry, index) => {
        const points = Math.round(entry.rating);
        if (lastPoints === null || points !== lastPoints) {
          lastPoints = points;
          lastPosition = index + 1;
        }
        positions.set(entry.userId, lastPosition);
      });
      orgPosition = positions.get(user.id) ?? null;
    }
  }

  if (globalRatingProfile?.leaderboardEligible && globalRatingProfile.matchesPlayed > 0) {
    const globalAhead = await withPadelGlobalRatingFallback(
      () =>
        prisma.padelGlobalRatingProfile.count({
          where: {
            leaderboardEligible: true,
            matchesPlayed: { gt: 0 },
            OR: [
              { rating: { gt: globalRatingProfile.rating } },
              { rating: globalRatingProfile.rating, userId: { lt: user.id } },
            ],
          },
        }),
      null,
      "app/api/padel/me/summary#globalPosition",
    );
    if (typeof globalAhead === "number") {
      globalPosition = globalAhead + 1;
    }
  }

  const padelProfile = {
    level: profile?.padelLevel ?? fallbackPadel?.level ?? null,
    preferredSide: profile?.padelPreferredSide ?? fallbackPadel?.preferredSide ?? null,
    clubName: profile?.padelClubName ?? fallbackPadel?.clubName ?? null,
  };

  const missing = getPadelOnboardingMissing({
    profile: profile
      ? {
          fullName: profile.fullName,
          username: profile.username,
          contactPhone: profile.contactPhone,
          gender: profile.gender,
          padelLevel: profile.padelLevel,
          padelPreferredSide: profile.padelPreferredSide,
        }
      : null,
    email: user.email ?? null,
  });

  type PairingWithEvent = Prisma.PadelPairingGetPayload<{
    include: {
      event: { select: { id: true; title: true; slug: true; startsAt: true; endsAt: true; coverImageUrl: true } };
      category: { select: { id: true; label: true } };
      registration: { select: { status: true } };
      slots: { select: { id: true; slot_role: true; slotStatus: true; paymentStatus: true; profileId: true; invitedUserId: true } };
    };
  }>;

  const pairings: PairingWithEvent[] = await prisma.padelPairing.findMany({
    where: {
      OR: [
        { createdByUserId: user.id },
        { player1UserId: user.id },
        { player2UserId: user.id },
        { slots: { some: { profileId: user.id } } },
        {
          slots: {
            some: {
              invitedUserId: user.id,
              slotStatus: PadelPairingSlotStatus.PENDING,
              profileId: null,
            },
          },
        },
      ],
    },
    include: {
      event: {
        select: { id: true, title: true, slug: true, startsAt: true, endsAt: true, coverImageUrl: true },
      },
      category: { select: { id: true, label: true } },
      registration: { select: { status: true } },
      slots: {
        select: { id: true, slot_role: true, slotStatus: true, paymentStatus: true, profileId: true, invitedUserId: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_PAIRINGS,
  });

  const pairingItems = pairings.map((pairing) => ({
    id: pairing.id,
    event: pairing.event
      ? {
          id: pairing.event.id,
          title: pairing.event.title,
          slug: pairing.event.slug,
          startsAt: pairing.event.startsAt,
          endsAt: pairing.event.endsAt,
          coverImageUrl: pairing.event.coverImageUrl ?? null,
        }
      : null,
    category: pairing.category ? { id: pairing.category.id, label: pairing.category.label ?? null } : null,
    paymentMode: pairing.payment_mode,
    pairingStatus: pairing.pairingStatus,
    joinMode: pairing.pairingJoinMode,
    registrationStatus: pairing.registration?.status ?? null,
    lifecycleStatus: pairing.registration
      ? mapRegistrationToPairingLifecycle(pairing.registration.status, pairing.payment_mode)
      : null,
    deadlineAt: pairing.deadlineAt ?? null,
    graceUntilAt: pairing.graceUntilAt ?? null,
    slots: pairing.slots.map((slot) => ({
      id: slot.id,
      slotRole: slot.slot_role,
      slotStatus: slot.slotStatus,
      paymentStatus: slot.paymentStatus,
      profileId: slot.profileId ?? null,
      invitedUserId: slot.invitedUserId ?? null,
    })),
  }));

  const waitlist = await prisma.padelWaitlistEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: MAX_WAITLIST,
    include: {
      event: { select: { id: true, title: true, slug: true, startsAt: true } },
      category: { select: { id: true, label: true } },
    },
  });

  const waitlistItems = waitlist.map((entry) => ({
    id: entry.id,
    status: entry.status,
    createdAt: entry.createdAt,
    event: entry.event
      ? {
          id: entry.event.id,
          title: entry.event.title,
          slug: entry.event.slug,
          startsAt: entry.event.startsAt,
        }
      : null,
    category: entry.category ? { id: entry.category.id, label: entry.category.label ?? null } : null,
  }));

  const pairingIds = Array.from(new Set(pairings.map((pairing) => pairing.id)));
  const matchRows = pairingIds.length
    ? await prisma.eventMatchSlot.findMany({
        where: {
          participants: {
            some: {
              participant: {
                sourcePairingId: { in: pairingIds },
              },
            },
          },
        },
        select: {
          id: true,
          status: true,
          score: true,
          scoreSets: true,
          participants: {
            select: {
              side: true,
              participant: {
                select: {
                  sourcePairingId: true,
                },
              },
            },
          },
        },
        orderBy: { id: "desc" },
        take: MAX_MATCHES,
      })
    : [];

  const matchesForStats = matchRows.map((match) => ({
    pairingSide: (() => {
      const hasA = match.participants.some(
        (row) => row.side === "A" && typeof row.participant?.sourcePairingId === "number" && pairingIds.includes(row.participant.sourcePairingId),
      );
      if (hasA) return "A" as const;
      const hasB = match.participants.some(
        (row) => row.side === "B" && typeof row.participant?.sourcePairingId === "number" && pairingIds.includes(row.participant.sourcePairingId),
      );
      if (hasB) return "B" as const;
      return null;
    })(),
    status: match.status ?? null,
    scoreSets: match.scoreSets ?? null,
    score: match.score ?? null,
  }));

  const stats = computeUserPadelStats(matchesForStats);
  const activePairings = pairingItems.filter(
    (pairing) =>
      !pairing.registrationStatus ||
      !INACTIVE_REGISTRATION_STATUSES.includes(pairing.registrationStatus as any),
  );

  const uniqueTournaments = new Set(pairingItems.map((p) => p.event?.id).filter(Boolean)).size;

  return jsonWrap(
    {
      ok: true,
      profile: profile
        ? {
            id: profile.id,
            fullName: profile.fullName ?? null,
            username: profile.username ?? null,
            avatarUrl: profile.avatarUrl ?? null,
            gender: profile.gender ?? null,
            padelLevel: padelProfile.level ?? null,
            padelPreferredSide: padelProfile.preferredSide ?? null,
            padelClubName: padelProfile.clubName ?? null,
          }
        : null,
      onboarding: {
        missing,
        completed: isPadelOnboardingComplete(missing),
      },
      stats: {
        matchesPlayed: stats.matchesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        winRate: stats.winRate,
        tournaments: uniqueTournaments,
        pairingsActive: activePairings.length,
        waitlistCount: waitlistItems.length,
      },
      ranking: {
        rating: globalRatingProfile ? Number(globalRatingProfile.rating) : null,
        globalPosition,
        orgPosition,
        matchesPlayed: globalRatingProfile?.matchesPlayed ?? 0,
        leaderboardEligible: globalRatingProfile?.leaderboardEligible ?? false,
        blockedNewMatches: globalRatingProfile?.blockedNewMatches ?? false,
        lastMatchAt: globalRatingProfile?.lastMatchAt ?? null,
        lastRebuildAt: globalRatingProfile?.lastRebuildAt ?? null,
        sourceGlobalProfileId: globalRatingProfile?.id ?? null,
      },
      pairings: pairingItems,
      waitlist: waitlistItems,
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
