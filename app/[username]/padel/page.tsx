import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import { getProfileCoverUrl } from "@/lib/profileCover";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import { resolvePadelMatchStats } from "@/domain/padel/score";
import { getUserFollowCounts, isUserFriend } from "@/domain/social/follows";
import { normalizeUsernameInput } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";
import { withPadelGlobalRatingFallback } from "@/lib/padel/globalRatingSchema";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

type TopClubRow = {
  organizationId: number;
  name: string;
  matches: number;
  rating: number | null;
};

type TopPartnershipRow = {
  partnerId: string;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  lastPlayedAt: Date | null;
};

type TournamentSummaryRow = {
  eventId: number;
  title: string;
  slug: string;
  startsAt: Date | null;
  endsAt: Date | null;
  matchCount: number;
  nextMatchAt: Date | null;
  finalPosition: number | null;
  wonTitle: boolean;
  categoryLabel: string | null;
  partnerName: string | null;
};

type PadelStats = {
  matches: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
};

async function getViewerId() {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

function formatDate(date?: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date?: Date | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function resolveMatchDate(match: {
  startTime?: Date | null;
  plannedStartAt?: Date | null;
  actualStartAt?: Date | null;
  createdAt?: Date | null;
}) {
  return match.startTime ?? match.plannedStartAt ?? match.actualStartAt ?? match.createdAt ?? null;
}

function resolveSideLabel(side: string | null | undefined) {
  if (side === "ESQUERDA") return "Esquerda";
  if (side === "DIREITA") return "Direita";
  if (side === "QUALQUER") return "Qualquer";
  return "—";
}

type StatTone = "default" | "emerald" | "cyan" | "purple";

function toneClasses(tone: StatTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-300/30 bg-emerald-400/12 text-emerald-50";
    case "cyan":
      return "border-cyan-300/30 bg-cyan-400/12 text-cyan-50";
    case "purple":
      return "border-purple-300/30 bg-purple-400/12 text-purple-50";
    default:
      return "border-white/12 bg-white/5 text-white";
  }
}

function StatCard({
  title,
  value,
  subtitle,
  tone = "default",
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone?: StatTone;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl ${toneClasses(
        tone,
      )}`}
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">{title}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-white/60">{subtitle}</p>
    </div>
  );
}

export default async function PadelProfilePage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawUsernameParam = resolvedParams?.username ?? "";
  const usernameParam = normalizeUsernameInput(rawUsernameParam);

  if (!usernameParam) notFound();
  if (usernameParam === "me") redirect("/me");
  if (isReservedUsername(usernameParam)) notFound();
  if (rawUsernameParam !== usernameParam) redirect(`/${usernameParam}/padel`);

  const [viewerId, profile, organizationProfile] = await Promise.all([
    getViewerId(),
    prisma.profile.findUnique({
      where: { username: usernameParam },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        gender: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
        visibility: true,
        is_verified: true,
        updatedAt: true,
      },
    }),
    prisma.organization.findFirst({
      where: { username: usernameParam, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  if (!profile && organizationProfile) redirect(`/${usernameParam}`);
  if (!profile) notFound();

  const resolvedProfile = profile;
  const isOwner = viewerId === resolvedProfile.id;
  const isPrivate = resolvedProfile.visibility !== "PUBLIC";

  let isFollowing = false;
  let initialIsFollowing = false;
  let followersCount = 0;
  let followingCount = 0;

  if (prisma.follows) {
    const counts = await getUserFollowCounts(resolvedProfile.id);
    followersCount = counts.followersCount;
    followingCount = counts.followingOrganizationsCount ?? counts.followingTotal;

    if (viewerId && !isOwner) {
      isFollowing = await isUserFriend(viewerId, resolvedProfile.id);
      initialIsFollowing = isFollowing;
    }
  }

  const canSeeProfile = isOwner || !isPrivate || isFollowing;
  const profileHandle = resolvedProfile.username ?? usernameParam;

  const coverCandidate = resolvedProfile.coverUrl?.trim() || resolvedProfile.avatarUrl || null;
  const headerCoverUrl = coverCandidate
    ? getProfileCoverUrl(coverCandidate, {
        width: 1500,
        height: 500,
        quality: 72,
        format: "webp",
      })
    : null;

  const padelUser = await prisma.users.findUnique({
    where: { id: resolvedProfile.id },
    select: { email: true },
  });
  const canonicalPadelProfile = await prisma.padelPlayerProfile.findFirst({
    where: { userId: resolvedProfile.id, isActive: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      fullName: true,
      displayName: true,
      gender: true,
      level: true,
      preferredSide: true,
      clubName: true,
    },
  });
  const padelMissing = getPadelOnboardingMissing({
    profile: {
      fullName:
        canonicalPadelProfile?.displayName?.trim() ||
        canonicalPadelProfile?.fullName?.trim() ||
        resolvedProfile.fullName,
      username: resolvedProfile.username,
      gender: canonicalPadelProfile?.gender?.trim() || resolvedProfile.gender,
      padelLevel: canonicalPadelProfile?.level?.trim() || resolvedProfile.padelLevel,
      padelPreferredSide: canonicalPadelProfile?.preferredSide || resolvedProfile.padelPreferredSide,
    },
    email: padelUser?.email ?? null,
  });
  const padelComplete = isPadelOnboardingComplete(padelMissing);

  if (isOwner && !padelComplete) {
    redirect(`/onboarding/padel?redirectTo=${encodeURIComponent(`/${profileHandle}/padel`)}`);
  }

  if (!canSeeProfile) {
    return (
      <main className="relative min-h-screen w-full overflow-hidden text-white">
        <section className="relative flex flex-col gap-6 py-10">
          <ProfileHeader
            isOwner={isOwner}
            name={resolvedProfile.fullName ?? resolvedProfile.username}
            username={resolvedProfile.username}
            avatarUrl={resolvedProfile.avatarUrl}
            avatarUpdatedAt={resolvedProfile.updatedAt ? resolvedProfile.updatedAt.getTime() : null}
            coverUrl={headerCoverUrl}
            city={null}
            visibility={resolvedProfile.visibility as "PUBLIC" | "PRIVATE" | "FOLLOWERS" | null}
            followers={followersCount}
            following={followingCount}
            targetUserId={resolvedProfile.id}
            initialIsFollowing={initialIsFollowing}
            isVerified={resolvedProfile.is_verified}
            padelAction={{
              href: "/padel/rankings",
              label: "Ranking Padel",
              tone: "ghost",
            }}
          />
          <div className="px-5 sm:px-8">
            <div className="orya-page-width rounded-3xl border border-white/15 bg-white/5 p-6 text-center shadow-[0_26px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <h2 className="text-lg font-semibold text-white">Esta conta é privada</h2>
              <p className="mt-2 text-sm text-white/70">Adiciona como amigo para veres o perfil competitivo de padel.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const now = new Date();

  const [timelineRows, officialRows, rankingProfiles, historyRows, globalRatingProfile] = await Promise.all([
    prisma.eventMatchSlot.findMany({
      where: {
        OR: [
          { pairingA: { slots: { some: { profileId: resolvedProfile.id } } } },
          { pairingB: { slots: { some: { profileId: resolvedProfile.id } } } },
        ],
      },
      select: {
        startTime: true,
        plannedStartAt: true,
        actualStartAt: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
      orderBy: [{ startTime: "desc" }, { plannedStartAt: "desc" }, { id: "desc" }],
      take: 200,
    }),
    prisma.eventMatchSlot.findMany({
      where: {
        status: { in: ["OFFICIAL", "WALKOVER", "RETIRED"] },
        OR: [
          {
            participants: {
              some: {
                participant: {
                  playerProfile: { userId: resolvedProfile.id },
                },
              },
            },
          },
          { pairingA: { slots: { some: { profileId: resolvedProfile.id } } } },
          { pairingB: { slots: { some: { profileId: resolvedProfile.id } } } },
        ],
      },
      select: {
        eventId: true,
        pairingAId: true,
        pairingBId: true,
        winnerPairingId: true,
        winnerParticipantId: true,
        scoreSets: true,
        score: true,
        startTime: true,
        plannedStartAt: true,
        actualStartAt: true,
        createdAt: true,
        event: {
          select: {
            organizationId: true,
            organization: {
              select: {
                publicName: true,
                businessName: true,
                username: true,
              },
            },
          },
        },
        pairingA: {
          select: {
            slots: { select: { profileId: true, playerProfile: { select: { displayName: true, fullName: true } } } },
          },
        },
        pairingB: {
          select: {
            slots: { select: { profileId: true, playerProfile: { select: { displayName: true, fullName: true } } } },
          },
        },
        participants: {
          orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
          select: {
            participantId: true,
            side: true,
            participant: {
              select: {
                playerProfile: {
                  select: {
                    userId: true,
                    displayName: true,
                    fullName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ startTime: "desc" }, { plannedStartAt: "desc" }, { id: "desc" }],
      take: 300,
    }),
    prisma.padelPlayerProfile.findMany({
      where: { userId: resolvedProfile.id, isActive: true },
      select: {
        id: true,
        organizationId: true,
        updatedAt: true,
        fullName: true,
        displayName: true,
        gender: true,
        level: true,
        preferredSide: true,
        clubName: true,
        organization: {
          select: {
            publicName: true,
            businessName: true,
            username: true,
          },
        },
        ratingProfile: {
          select: {
            matchesPlayed: true,
            rating: true,
          },
        },
      },
    }),
    prisma.padelPlayerHistoryProjection.findMany({
      where: {
        playerProfile: {
          userId: resolvedProfile.id,
        },
      },
      select: {
        event: { select: { id: true, title: true, slug: true, startsAt: true, endsAt: true } },
        finalPosition: true,
        wonTitle: true,
        category: { select: { label: true } },
        partnerPlayerProfile: { select: { displayName: true, fullName: true } },
      },
      orderBy: [{ event: { endsAt: "desc" } }, { event: { startsAt: "desc" } }, { id: "desc" }],
      take: 120,
    }),
    withPadelGlobalRatingFallback(
      () =>
        prisma.padelGlobalRatingProfile.findUnique({
          where: { userId: resolvedProfile.id },
          select: {
            id: true,
            rating: true,
            matchesPlayed: true,
            leaderboardEligible: true,
            blockedNewMatches: true,
            lastMatchAt: true,
            lastActivityAt: true,
            lastRebuildAt: true,
          },
        }),
      null,
      "app/[username]/padel/page#globalProfile",
    ),
  ]);

  const rankingSource =
    [...rankingProfiles].sort((a, b) => {
      const matchesA = a.ratingProfile?.matchesPlayed ?? 0;
      const matchesB = b.ratingProfile?.matchesPlayed ?? 0;
      if (matchesB !== matchesA) return matchesB - matchesA;
      return b.updatedAt.getTime() - a.updatedAt.getTime() || a.id - b.id;
    })[0] ?? null;
  const displayPadelLevel =
    rankingSource?.level?.trim() || canonicalPadelProfile?.level?.trim() || resolvedProfile.padelLevel || null;
  const displayPadelPreferredSide =
    rankingSource?.preferredSide || canonicalPadelProfile?.preferredSide || resolvedProfile.padelPreferredSide || null;
  const displayPadelClubName =
    rankingSource?.clubName?.trim() || canonicalPadelProfile?.clubName?.trim() || resolvedProfile.padelClubName || null;
  const rankingOrgName =
    rankingSource?.organization.publicName ||
    rankingSource?.organization.businessName ||
    (rankingSource?.organization.username ? `@${rankingSource.organization.username}` : null) ||
    null;
  let rankingOrgPosition: number | null = null;
  let rankingGlobalPosition: number | null = null;

  if (rankingSource && globalRatingProfile && globalRatingProfile.matchesPlayed > 0) {
    const orgPlayers = await prisma.padelPlayerProfile.findMany({
      where: {
        organizationId: rankingSource.organizationId,
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
        "app/[username]/padel/page#orgRanking",
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
      rankingOrgPosition = positions.get(resolvedProfile.id) ?? null;
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
              { rating: globalRatingProfile.rating, userId: { lt: resolvedProfile.id } },
            ],
          },
        }),
      null,
      "app/[username]/padel/page#globalPosition",
    );
    if (typeof globalAhead === "number") {
      rankingGlobalPosition = globalAhead + 1;
    }
  }

  const upcomingTournaments = Array.from(
    timelineRows.reduce((acc, row) => {
      const matchAt = resolveMatchDate(row);
      if (!matchAt || matchAt < now) return acc;
      const event = row.event;
      const existing = acc.get(event.id) ?? {
        eventId: event.id,
        title: event.title,
        slug: event.slug,
        startsAt: event.startsAt ?? null,
        endsAt: event.endsAt ?? null,
        matchCount: 0,
        nextMatchAt: null,
        finalPosition: null,
        wonTitle: false,
        categoryLabel: null,
        partnerName: null,
      };
      existing.matchCount += 1;
      if (!existing.nextMatchAt || matchAt < existing.nextMatchAt) {
        existing.nextMatchAt = matchAt;
      }
      acc.set(event.id, existing);
      return acc;
    }, new Map<number, TournamentSummaryRow>()).values(),
  )
    .sort((a, b) => (a.nextMatchAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.nextMatchAt?.getTime() ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 6);

  const recentTournaments = Array.from(
    historyRows.reduce((acc, row) => {
      const key = row.event.id;
      const existing = acc.get(key) ?? {
        eventId: key,
        title: row.event.title,
        slug: row.event.slug,
        startsAt: row.event.startsAt ?? null,
        endsAt: row.event.endsAt ?? null,
        matchCount: 0,
        nextMatchAt: null,
        finalPosition: null,
        wonTitle: false,
        categoryLabel: null,
        partnerName: null,
      };
      existing.matchCount += 1;
      if (typeof row.finalPosition === "number" && (existing.finalPosition === null || row.finalPosition < existing.finalPosition)) {
        existing.finalPosition = row.finalPosition;
      }
      if (row.wonTitle) existing.wonTitle = true;
      if (!existing.categoryLabel && row.category?.label) {
        existing.categoryLabel = row.category.label;
      }
      if (!existing.partnerName && row.partnerPlayerProfile) {
        existing.partnerName = row.partnerPlayerProfile.displayName || row.partnerPlayerProfile.fullName || null;
      }
      acc.set(key, existing);
      return acc;
    }, new Map<number, TournamentSummaryRow>()).values(),
  )
    .sort((a, b) => (b.endsAt?.getTime() ?? b.startsAt?.getTime() ?? 0) - (a.endsAt?.getTime() ?? a.startsAt?.getTime() ?? 0))
    .slice(0, 6);

  const padelStats: PadelStats = {
    matches: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
  };

  const partnershipMap = new Map<string, TopPartnershipRow>();
  const clubStatsMap = new Map<number, TopClubRow>();

  const upsertPartnership = (partnerId: string, partnerName: string, didWin: boolean | null, playedAt: Date | null) => {
    const existing = partnershipMap.get(partnerId) ?? {
      partnerId,
      name: partnerName,
      matches: 0,
      wins: 0,
      losses: 0,
      lastPlayedAt: null,
    };
    existing.matches += 1;
    if (didWin === true) existing.wins += 1;
    if (didWin === false) existing.losses += 1;
    if (playedAt && (!existing.lastPlayedAt || playedAt > existing.lastPlayedAt)) {
      existing.lastPlayedAt = playedAt;
    }
    if (!existing.name && partnerName) {
      existing.name = partnerName;
    }
    partnershipMap.set(partnerId, existing);
  };

  for (const row of officialRows) {
    const participantRows = Array.isArray(row.participants) ? row.participants : [];
    const inAByParticipant = participantRows.some((item) => item.side === "A" && item.participant?.playerProfile?.userId === resolvedProfile.id);
    const inBByParticipant = participantRows.some((item) => item.side === "B" && item.participant?.playerProfile?.userId === resolvedProfile.id);
    const inABySlots = row.pairingA?.slots?.some((slot) => slot.profileId === resolvedProfile.id) ?? false;
    const inBBySlots = row.pairingB?.slots?.some((slot) => slot.profileId === resolvedProfile.id) ?? false;
    const inA = inAByParticipant || inABySlots;
    const inB = inBByParticipant || inBBySlots;
    if (!inA && !inB) continue;

    const eventOrganizationId = row.event?.organizationId;
    if (typeof eventOrganizationId === "number" && Number.isFinite(eventOrganizationId)) {
      const eventOrganization = row.event?.organization;
      const existing = clubStatsMap.get(eventOrganizationId) ?? {
        organizationId: eventOrganizationId,
        name:
          eventOrganization?.publicName?.trim() ||
          eventOrganization?.businessName?.trim() ||
          (eventOrganization?.username ? `@${eventOrganization.username}` : `Clube #${eventOrganizationId}`),
        matches: 0,
        rating: null,
      };
      existing.matches += 1;
      if (globalRatingProfile && typeof globalRatingProfile.rating === "number") {
        existing.rating = Number(globalRatingProfile.rating);
      }
      clubStatsMap.set(eventOrganizationId, existing);
    }

    padelStats.matches += 1;

    const userPairingId = inA ? row.pairingAId : row.pairingBId;
    const winnerPairingId = row.winnerPairingId;

    const sideAParticipantIds = participantRows
      .filter((item) => item.side === "A")
      .map((item) => item.participantId)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
    const sideBParticipantIds = participantRows
      .filter((item) => item.side === "B")
      .map((item) => item.participantId)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

    const participantDidWin =
      typeof row.winnerParticipantId === "number"
        ? inA
          ? sideAParticipantIds.includes(row.winnerParticipantId)
          : sideBParticipantIds.includes(row.winnerParticipantId)
        : null;

    const pairingDidWin = Boolean(userPairingId && winnerPairingId) ? winnerPairingId === userPairingId : null;
    const didWin = typeof participantDidWin === "boolean" ? participantDidWin : typeof pairingDidWin === "boolean" ? pairingDidWin : null;

    if (didWin === true) padelStats.wins += 1;
    if (didWin === false) padelStats.losses += 1;

    const scoreStats = resolvePadelMatchStats(row.scoreSets, row.score);
    if (scoreStats) {
      if (inA) {
        padelStats.setsWon += scoreStats.aSets;
        padelStats.setsLost += scoreStats.bSets;
        padelStats.gamesWon += scoreStats.aGames;
        padelStats.gamesLost += scoreStats.bGames;
      } else if (inB) {
        padelStats.setsWon += scoreStats.bSets;
        padelStats.setsLost += scoreStats.aSets;
        padelStats.gamesWon += scoreStats.bGames;
        padelStats.gamesLost += scoreStats.aGames;
      }
    }

    const playedAt = resolveMatchDate(row);

    const teammateParticipantRows =
      participantRows.length > 0
        ? participantRows.filter((item) => (inA ? item.side === "A" : inB ? item.side === "B" : false))
        : [];

    if (teammateParticipantRows.length > 0) {
      for (const item of teammateParticipantRows) {
        const partnerId = item.participant?.playerProfile?.userId ?? null;
        if (!partnerId || partnerId === resolvedProfile.id) continue;
        const partnerName = item.participant?.playerProfile?.displayName || item.participant?.playerProfile?.fullName || "Parceiro";
        upsertPartnership(partnerId, partnerName, didWin, playedAt);
      }
    } else {
      const teammateSlots = inA ? row.pairingA?.slots : row.pairingB?.slots;
      if (!teammateSlots) continue;
      for (const slot of teammateSlots) {
        const partnerId = slot.profileId;
        if (!partnerId || partnerId === resolvedProfile.id) continue;
        const partnerName = slot.playerProfile?.displayName || slot.playerProfile?.fullName || "Parceiro";
        upsertPartnership(partnerId, partnerName, didWin, playedAt);
      }
    }
  }

  const topPartnerships = Array.from(partnershipMap.values())
    .sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 3);

  const topClubs = Array.from(clubStatsMap.values())
    .sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches;
      const ratingA = a.rating ?? -1;
      const ratingB = b.rating ?? -1;
      if (ratingB !== ratingA) return ratingB - ratingA;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 3);

  const titlesWon = recentTournaments.filter((item) => item.wonTitle).length;
  const decidedMatches = padelStats.wins + padelStats.losses;
  const winRate = decidedMatches > 0 ? Math.round((padelStats.wins / decidedMatches) * 100) : 0;

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white">
      <section className="relative flex flex-col gap-6 py-10">
        <ProfileHeader
          isOwner={isOwner}
          name={resolvedProfile.fullName ?? resolvedProfile.username}
          username={resolvedProfile.username}
          avatarUrl={resolvedProfile.avatarUrl}
          avatarUpdatedAt={resolvedProfile.updatedAt ? resolvedProfile.updatedAt.getTime() : null}
          coverUrl={headerCoverUrl}
          bio={resolvedProfile.bio}
          city={null}
          visibility={resolvedProfile.visibility as "PUBLIC" | "PRIVATE" | "FOLLOWERS" | null}
          followers={followersCount}
          following={followingCount}
          targetUserId={resolvedProfile.id}
          initialIsFollowing={initialIsFollowing}
          isVerified={resolvedProfile.is_verified}
          padelAction={{
            href: "/padel/rankings",
            label: "Ranking Padel",
            tone: "ghost",
          }}
        />

        <div className="px-5 sm:px-8">
          <div className="orya-page-width flex flex-col gap-6">
            <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Estatísticas relevantes</p>
                  <h2 className="mt-2 text-sm font-semibold text-white/95">Resumo competitivo</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Nível" value={displayPadelLevel ?? "—"} subtitle="Nível atual." tone="emerald" />
                <StatCard title="Lado" value={resolveSideLabel(displayPadelPreferredSide)} subtitle="Lado preferido." tone="cyan" />
                <StatCard title="Clube" value={displayPadelClubName ?? rankingOrgName ?? "—"} subtitle="Base atual." tone="purple" />
                <StatCard
                  title="Global"
                  value={typeof rankingGlobalPosition === "number" ? `#${rankingGlobalPosition}` : "—"}
                  subtitle={globalRatingProfile?.leaderboardEligible ? "Leaderboard global." : "Sem elegibilidade global."}
                  tone="emerald"
                />
                <StatCard
                  title="Clube (ranking)"
                  value={typeof rankingOrgPosition === "number" ? `#${rankingOrgPosition}` : "—"}
                  subtitle={rankingOrgName ?? "Sem clube elegível."}
                  tone="cyan"
                />
                <StatCard
                  title="Rating"
                  value={globalRatingProfile ? Math.round(Number(globalRatingProfile.rating)) : "—"}
                  subtitle={
                    globalRatingProfile
                      ? `Último rebuild ${formatDateTime(globalRatingProfile.lastRebuildAt ?? null)}`
                      : "Glicko-2 global."
                  }
                  tone="purple"
                />
                <StatCard title="Jogos" value={padelStats.matches} subtitle="Jogos oficiais." />
                <StatCard title="Vitórias" value={padelStats.wins} subtitle={`Win rate ${winRate}%`} tone="emerald" />
                <StatCard title="Títulos" value={titlesWon} subtitle="Torneios ganhos." tone="purple" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] text-white/80">
                  Sets: {padelStats.setsWon}-{padelStats.setsLost} <span className="text-white/55">(saldo {padelStats.setsWon - padelStats.setsLost})</span>
                </div>
                <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-[12px] text-white/80">
                  Games: {padelStats.gamesWon}-{padelStats.gamesLost} <span className="text-white/55">(saldo {padelStats.gamesWon - padelStats.gamesLost})</span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Torneios</p>
                  <h2 className="mt-2 text-sm font-semibold text-white/95">Próximos e últimos</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Próximos torneios</p>
                  {upcomingTournaments.length === 0 ? (
                    <p className="mt-3 text-[12px] text-white/60">Sem torneios confirmados de momento.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {upcomingTournaments.map((item) => (
                        <Link
                          key={`upcoming-tournament-${item.eventId}`}
                          href={`/eventos/${item.slug}/calendario`}
                          className="block rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[12px] text-white/85 hover:border-white/25"
                        >
                          <p className="font-semibold text-white">{item.title}</p>
                          <p className="text-[11px] text-white/65">
                            {formatDateTime(item.nextMatchAt ?? item.startsAt)} · {item.matchCount} jogo(s) agendado(s)
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Últimos torneios</p>
                  {recentTournaments.length === 0 ? (
                    <p className="mt-3 text-[12px] text-white/60">Sem histórico de torneios ainda.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {recentTournaments.map((item) => (
                        <Link
                          key={`recent-tournament-${item.eventId}`}
                          href={`/eventos/${item.slug}`}
                          className="block rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[12px] text-white/85 hover:border-white/25"
                        >
                          <p className="font-semibold text-white">{item.title}</p>
                          <p className="text-[11px] text-white/65">
                            {item.wonTitle
                              ? "Título conquistado"
                              : item.finalPosition
                                ? `Posição final ${item.finalPosition}`
                                : "Sem posição final oficial"}
                            {item.categoryLabel ? ` · ${item.categoryLabel}` : ""}
                            {item.partnerName ? ` · Parceiro ${item.partnerName}` : ""}
                          </p>
                          <p className="text-[11px] text-white/50">{formatDate(item.endsAt ?? item.startsAt)}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Top 3</p>
                  <h2 className="mt-2 text-sm font-semibold text-white/95">Clubes e duplas onde mais jogas</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Top 3 clubes</p>
                  {topClubs.length === 0 ? (
                    <p className="mt-3 text-[12px] text-white/60">Sem clubes com jogos suficientes.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {topClubs.map((club, idx) => (
                        <div
                          key={`top-club-${club.organizationId}`}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[12px] text-white/85"
                        >
                          <div>
                            <p className="font-semibold text-white">#{idx + 1} {club.name}</p>
                            <p className="text-[11px] text-white/60">{club.matches} jogos oficiais</p>
                          </div>
                          <span className="text-[11px] text-white/65">
                            {club.rating !== null ? `rating ${Math.round(club.rating)}` : "rating —"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Top 3 duplas</p>
                  {topPartnerships.length === 0 ? (
                    <p className="mt-3 text-[12px] text-white/60">Sem duplas com jogos suficientes.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {topPartnerships.map((row, idx) => (
                        <div
                          key={`top-dupla-${row.partnerId}`}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[12px] text-white/85"
                        >
                          <div>
                            <p className="font-semibold text-white">#{idx + 1} {row.name}</p>
                            <p className="text-[11px] text-white/60">{row.matches} jogos · {row.wins}-{row.losses}</p>
                          </div>
                          <span className="text-[11px] text-white/65">
                            {row.lastPlayedAt ? `último ${formatDate(row.lastPlayedAt)}` : "sem data"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
