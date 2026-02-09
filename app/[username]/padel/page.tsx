import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import { getProfileCoverUrl } from "@/lib/profileCover";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import { resolvePadelMatchStats } from "@/domain/padel/score";
import PadelDisputeButton from "./PadelDisputeButton";
import { getUserFollowCounts, isUserFollowing } from "@/domain/social/follows";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
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
  if (!date) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
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

function buildPairingLabel(pairing?: {
  slots: Array<{ playerProfile?: { displayName?: string | null; fullName?: string | null } | null }>;
} | null) {
  if (!pairing) return "—";
  const names = pairing.slots
    .map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName)
    .filter(Boolean) as string[];
  return names.length ? names.join(" / ") : "Dupla";
}

function formatScoreSummary(match: {
  scoreSets: Array<{ teamA: number; teamB: number }> | null;
  score: Record<string, unknown> | null;
}) {
  const score = match.score || {};
  if (score.disputeStatus === "OPEN") return "Em disputa";
  if (match.scoreSets?.length) {
    return match.scoreSets.map((set) => `${set.teamA}-${set.teamB}`).join(", ");
  }
  const resultType =
    score.resultType === "WALKOVER" || score.walkover === true
      ? "WALKOVER"
      : score.resultType === "RETIREMENT"
        ? "RETIREMENT"
        : score.resultType === "INJURY"
          ? "INJURY"
          : null;
  if (resultType === "WALKOVER") return "WO";
  if (resultType === "RETIREMENT") return "Desistência";
  if (resultType === "INJURY") return "Lesão";
  return "—";
}

type PadelStats = {
  matches: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
};

type HeadToHeadRow = {
  opponentId: string;
  name: string;
  matches: number;
  wins: number;
  losses: number;
  lastPlayedAt: Date | null;
};

type RecentFormRow = { result: "W" | "L"; date: Date | null };

type StatTone = "default" | "emerald" | "cyan" | "purple";
type BadgeTone = "emerald" | "cyan" | "amber" | "violet" | "slate";

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

type PadelBadge = {
  id: string;
  label: string;
  description: string;
  tone: BadgeTone;
};

function badgeToneClasses(tone: BadgeTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-300/30 bg-emerald-500/15 text-emerald-50";
    case "cyan":
      return "border-cyan-300/30 bg-cyan-500/15 text-cyan-50";
    case "amber":
      return "border-amber-300/30 bg-amber-500/15 text-amber-50";
    case "violet":
      return "border-violet-300/30 bg-violet-500/15 text-violet-50";
    default:
      return "border-white/15 bg-white/10 text-white/70";
  }
}

function BadgePill({ badge }: { badge: PadelBadge }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${badgeToneClasses(
        badge.tone,
      )}`}
      title={badge.description}
    >
      <span>{badge.label}</span>
    </span>
  );
}

function buildPadelBadges({
  matches,
  wins,
  tournamentsPlayed,
  currentWinStreak,
}: {
  matches: number;
  wins: number;
  tournamentsPlayed: number;
  currentWinStreak: number;
}) {
  const badges: PadelBadge[] = [];

  if (matches >= 1) {
    const matchBadge =
      matches >= 25
        ? { label: "25 jogos", description: "Veterano em court." }
        : matches >= 10
          ? { label: "10 jogos", description: "Ritmo de competição." }
          : { label: "Estreia", description: "Primeiro jogo concluído." };
    badges.push({ id: "matches", tone: "slate", ...matchBadge });
  }

  if (wins >= 5) {
    const winBadge =
      wins >= 20
        ? { label: "20 vitórias", description: "Vitórias de respeito." }
        : wins >= 10
          ? { label: "10 vitórias", description: "Vitórias consistentes." }
          : { label: "5 vitórias", description: "Boa fase." };
    badges.push({ id: "wins", tone: "emerald", ...winBadge });
  }

  if (tournamentsPlayed >= 1) {
    const tournamentBadge =
      tournamentsPlayed >= 5
        ? { label: "5 torneios", description: "Experiência em torneios." }
        : tournamentsPlayed >= 3
          ? { label: "3 torneios", description: "Competição regular." }
          : { label: "1 torneio", description: "Primeira competição." };
    badges.push({ id: "tournaments", tone: "violet", ...tournamentBadge });
  }

  if (currentWinStreak >= 3) {
    const streakBadge =
      currentWinStreak >= 5
        ? { label: "5 seguidas", description: "Sequência implacável." }
        : { label: "3 seguidas", description: "Sequência positiva." };
    badges.push({ id: "streak", tone: "amber", ...streakBadge });
  }

  return badges;
}

export default async function PadelProfilePage({ params }: PageProps) {
  const resolvedParams = await params;
  const usernameParam = resolvedParams?.username;

  if (!usernameParam || usernameParam.toLowerCase() === "me") {
    redirect("/me");
  }

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
        contactPhone: true,
        gender: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
        visibility: true,
        is_verified: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.organization.findFirst({
      where: { username: usernameParam, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  if (!profile && organizationProfile) {
    redirect(`/${usernameParam}`);
  }
  if (!profile) {
    notFound();
  }

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
    followingCount = counts.followingTotal;

    if (viewerId && !isOwner) {
      isFollowing = await isUserFollowing(viewerId, resolvedProfile.id);
      initialIsFollowing = isFollowing;
    }
  }

  const canSeeProfile = isOwner || !isPrivate || isFollowing;
  const profileHandle = resolvedProfile.username ?? usernameParam;
  const coverCandidate =
    resolvedProfile.coverUrl?.trim() ||
    resolvedProfile.avatarUrl ||
    null;
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

  const padelMissing = getPadelOnboardingMissing({
    profile: {
      fullName: resolvedProfile.fullName,
      username: resolvedProfile.username,
      contactPhone: resolvedProfile.contactPhone ?? null,
      gender: resolvedProfile.gender ?? null,
      padelLevel: resolvedProfile.padelLevel ?? null,
      padelPreferredSide: resolvedProfile.padelPreferredSide ?? null,
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
              href: `/${profileHandle}`,
              label: "Ver perfil",
              tone: "ghost",
            }}
          />
          <div className="px-5 sm:px-8">
            <div className="orya-page-width rounded-3xl border border-white/15 bg-white/5 p-6 text-sm text-white/70 backdrop-blur-2xl">
              Perfil privado.
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!padelComplete && !isOwner) {
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
              href: `/${profileHandle}`,
              label: "Ver perfil",
              tone: "ghost",
            }}
          />
          <div className="px-5 sm:px-8">
            <div className="orya-page-width rounded-3xl border border-white/15 bg-white/5 p-6 text-sm text-white/70 backdrop-blur-2xl">
              Padel indisponível.
            </div>
          </div>
        </section>
      </main>
    );
  }

  let padelMatches: Array<{
    id: number;
    status: string;
    roundLabel: string | null;
    groupLabel: string | null;
    startAt: Date | null;
    scoreSets: Array<{ teamA: number; teamB: number }> | null;
    score: Record<string, unknown> | null;
    event: { title: string; slug: string };
    pairingA: any;
    pairingB: any;
  }> = [];
  let padelUpcoming: typeof padelMatches = [];
  let padelRecent: typeof padelMatches = [];

  try {
    const matchRows = await prisma.eventMatchSlot.findMany({
      where: {
        OR: [
          { pairingA: { slots: { some: { profileId: resolvedProfile.id } } } },
          { pairingB: { slots: { some: { profileId: resolvedProfile.id } } } },
        ],
      },
      include: {
        event: { select: { title: true, slug: true } },
        pairingA: { include: { slots: { select: { playerProfile: { select: { displayName: true, fullName: true } } } } } },
        pairingB: { include: { slots: { select: { playerProfile: { select: { displayName: true, fullName: true } } } } } },
      },
      orderBy: [{ startTime: "desc" }, { plannedStartAt: "desc" }, { id: "desc" }],
      take: 12,
    });

    padelMatches = matchRows.map((match) => ({
      id: match.id,
      status: match.status,
      roundLabel: match.roundLabel ?? null,
      groupLabel: match.groupLabel ?? null,
      startAt: match.startTime ?? match.plannedStartAt ?? match.actualStartAt ?? null,
      scoreSets: Array.isArray(match.scoreSets) ? (match.scoreSets as Array<{ teamA: number; teamB: number }>) : null,
      score: match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : null,
      event: { title: match.event.title, slug: match.event.slug },
      pairingA: match.pairingA,
      pairingB: match.pairingB,
    }));

    const now = new Date();
    padelUpcoming = padelMatches
      .filter((match) => match.startAt && match.startAt >= now)
      .sort((a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0))
      .slice(0, 4);
    padelRecent = padelMatches
      .filter((match) => !match.startAt || match.startAt < now)
      .sort((a, b) => (b.startAt?.getTime() ?? 0) - (a.startAt?.getTime() ?? 0))
      .slice(0, 4);
  } catch {
    // ignore
  }

  const padelStats: PadelStats = {
    matches: 0,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
  };
  let headToHead: HeadToHeadRow[] = [];
  let recentForm: RecentFormRow[] = [];
  let tournamentsPlayed = 0;
  let currentWinStreak = 0;

  try {
    const statsRows = await prisma.eventMatchSlot.findMany({
      where: {
        status: "DONE",
        OR: [
          { pairingA: { slots: { some: { profileId: resolvedProfile.id } } } },
          { pairingB: { slots: { some: { profileId: resolvedProfile.id } } } },
        ],
      },
      select: {
        id: true,
        eventId: true,
        pairingAId: true,
        pairingBId: true,
        winnerPairingId: true,
        scoreSets: true,
        score: true,
        startTime: true,
        plannedStartAt: true,
        actualStartAt: true,
        createdAt: true,
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
      },
    });

    const opponentMap = new Map<string, HeadToHeadRow>();
    const formRows: RecentFormRow[] = [];
    const tournamentIds = new Set<number>();

    for (const match of statsRows) {
      const inA = match.pairingA?.slots?.some((slot) => slot.profileId === resolvedProfile.id) ?? false;
      const inB = match.pairingB?.slots?.some((slot) => slot.profileId === resolvedProfile.id) ?? false;
      if (!inA && !inB) continue;

      padelStats.matches += 1;
      if (Number.isFinite(match.eventId)) tournamentIds.add(match.eventId);
      const userPairingId = inA ? match.pairingAId : match.pairingBId;
      const winnerPairingId = match.winnerPairingId;
      const decided = Boolean(userPairingId && winnerPairingId);
      const didWin = decided && winnerPairingId === userPairingId;
      if (decided) {
        if (didWin) padelStats.wins += 1;
        else padelStats.losses += 1;
      }

      const stats = resolvePadelMatchStats(match.scoreSets, match.score);
      if (stats) {
        if (inA) {
          padelStats.setsWon += stats.aSets;
          padelStats.setsLost += stats.bSets;
          padelStats.gamesWon += stats.aGames;
          padelStats.gamesLost += stats.bGames;
        } else if (inB) {
          padelStats.setsWon += stats.bSets;
          padelStats.setsLost += stats.aSets;
          padelStats.gamesWon += stats.bGames;
          padelStats.gamesLost += stats.aGames;
        }
      }

      if (decided) {
        formRows.push({ result: didWin ? "W" : "L", date: resolveMatchDate(match) });
      }

      const opponentSlots = inA ? match.pairingB?.slots : match.pairingA?.slots;
      if (!opponentSlots) continue;
      for (const slot of opponentSlots) {
        const opponentId = slot.profileId;
        if (!opponentId || opponentId === resolvedProfile.id) continue;
        const name = slot.playerProfile?.displayName || slot.playerProfile?.fullName || "Jogador";
        const existing = opponentMap.get(opponentId) ?? {
          opponentId,
          name,
          matches: 0,
          wins: 0,
          losses: 0,
          lastPlayedAt: null,
        };
        existing.matches += 1;
        if (decided) {
          if (didWin) existing.wins += 1;
          else existing.losses += 1;
        }
        const playedAt = resolveMatchDate(match);
        if (playedAt && (!existing.lastPlayedAt || playedAt > existing.lastPlayedAt)) {
          existing.lastPlayedAt = playedAt;
        }
        if (!existing.name && name) {
          existing.name = name;
        }
        opponentMap.set(opponentId, existing);
      }
    }

    headToHead = Array.from(opponentMap.values())
      .sort((a, b) => {
        if (b.matches !== a.matches) return b.matches - a.matches;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 6);
    const sortedForm = formRows.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    recentForm = sortedForm.slice(0, 5);
    currentWinStreak = 0;
    for (const row of sortedForm) {
      if (row.result === "W") currentWinStreak += 1;
      else break;
    }
    tournamentsPlayed = tournamentIds.size;
  } catch {
    // ignore
  }

  const decidedMatches = padelStats.wins + padelStats.losses;
  const winRate = decidedMatches > 0 ? Math.round((padelStats.wins / decidedMatches) * 100) : 0;
  const badges = buildPadelBadges({
    matches: padelStats.matches,
    wins: padelStats.wins,
    tournamentsPlayed,
    currentWinStreak,
  });

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
            href: `/${profileHandle}`,
            label: "Ver perfil normal",
            tone: "ghost",
          }}
        />

        <div className="px-5 sm:px-8">
          <div className="orya-page-width flex flex-col gap-6">
            <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Nivel"
                  value={resolvedProfile.padelLevel ?? "—"}
                  subtitle="Nível de jogo."
                  tone="emerald"
                />
                <StatCard
                  title="Lado"
                  value={
                    resolvedProfile.padelPreferredSide === "ESQUERDA"
                      ? "Esquerda"
                      : resolvedProfile.padelPreferredSide === "DIREITA"
                        ? "Direita"
                        : resolvedProfile.padelPreferredSide === "QUALQUER"
                          ? "Qualquer"
                          : "—"
                  }
                  subtitle="Preferência."
                  tone="cyan"
                />
                <StatCard
                  title="Clube"
                  value={resolvedProfile.padelClubName ?? "—"}
                  subtitle="Base atual."
                  tone="purple"
                />
                <StatCard
                  title="Jogos"
                  value={padelStats.matches}
                  subtitle="Jogos terminados."
                  tone="default"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Performance</p>
                  <h2 className="mt-2 text-sm font-semibold text-white/95">Estatísticas</h2>
                  <p className="text-[12px] text-white/70">
                    Baseado em {padelStats.matches} jogos terminados.
                  </p>
                </div>
                <p className="text-[11px] text-white/60">Win rate {winRate}%</p>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Vitórias"
                  value={padelStats.wins}
                  subtitle={`Win rate ${winRate}%`}
                  tone="emerald"
                />
                <StatCard
                  title="Derrotas"
                  value={padelStats.losses}
                  subtitle="Jogos decididos."
                  tone="default"
                />
                <StatCard
                  title="Sets"
                  value={`${padelStats.setsWon}-${padelStats.setsLost}`}
                  subtitle={`Saldo ${padelStats.setsWon - padelStats.setsLost}`}
                  tone="cyan"
                />
                <StatCard
                  title="Games"
                  value={`${padelStats.gamesWon}-${padelStats.gamesLost}`}
                  subtitle={`Saldo ${padelStats.gamesWon - padelStats.gamesLost}`}
                  tone="purple"
                />
              </div>
              <div className="mt-4 rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Conquistas</p>
                    <p className="text-[12px] text-white/70">Badges desbloqueadas em torneios.</p>
                  </div>
                  {currentWinStreak >= 3 ? (
                    <span className="text-[11px] text-amber-200">{currentWinStreak} vitórias seguidas</span>
                  ) : null}
                </div>
                {badges.length === 0 && (
                  <p className="mt-3 text-[12px] text-white/60">Ainda sem conquistas. Continua a jogar!</p>
                )}
                {badges.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <BadgePill key={badge.id} badge={badge} />
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Head-to-head</p>
                  <p className="mt-2 text-[12px] text-white/70">Top adversários enfrentados.</p>
                  {headToHead.length === 0 && (
                    <p className="mt-3 text-[12px] text-white/60">Sem confrontos suficientes.</p>
                  )}
                  {headToHead.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {headToHead.map((row) => (
                        <div
                          key={row.opponentId}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/80"
                        >
                          <div>
                            <p className="font-semibold">{row.name}</p>
                            {row.lastPlayedAt && (
                              <p className="text-[11px] text-white/50">
                                Último: {formatDate(row.lastPlayedAt)}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-[11px] text-white/70">
                            <p>
                              {row.wins}-{row.losses}
                            </p>
                            <p>{row.matches} jogos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Forma recente</p>
                  <p className="mt-2 text-[12px] text-white/70">Últimos resultados.</p>
                  {recentForm.length === 0 && (
                    <p className="mt-3 text-[12px] text-white/60">Sem resultados suficientes.</p>
                  )}
                  {recentForm.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recentForm.map((item, idx) => (
                        <div
                          key={`form-${idx}`}
                          className={`rounded-full border px-3 py-1 text-[11px] ${
                            item.result === "W"
                              ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-50"
                              : "border-rose-300/40 bg-rose-500/10 text-rose-50"
                          }`}
                        >
                          {item.result === "W" ? "Vitória" : "Derrota"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/15 bg-white/5 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Padel</p>
                  <h2 className="mt-2 text-sm font-semibold text-white/95">Jogos e resultados</h2>
                  <p className="text-[12px] text-white/70">Próximos jogos e últimos resultados.</p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Próximos</p>
                  {padelUpcoming.length === 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                      Sem jogos agendados.
                    </div>
                  )}
                  {padelUpcoming.map((match) => (
                    <div key={`padel-up-${match.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                      <p className="text-[11px] text-white/60">{match.event.title}</p>
                      <p className="text-sm text-white/90">
                        {buildPairingLabel(match.pairingA)} vs {buildPairingLabel(match.pairingB)}
                      </p>
                      {formatDate(match.startAt) ? (
                        <p className="text-[11px] text-white/60">
                          {match.roundLabel || match.groupLabel || "Jogo"} · {formatDate(match.startAt)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Últimos</p>
                  {padelRecent.length === 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
                      Sem histórico recente.
                    </div>
                  )}
                  {padelRecent.map((match) => {
                    const score = match.score || {};
                    const disputeStatusRaw = typeof score.disputeStatus === "string" ? score.disputeStatus : null;
                    const disputeStatus =
                      disputeStatusRaw === "OPEN" || disputeStatusRaw === "RESOLVED" ? disputeStatusRaw : null;
                    const disputeReason = typeof score.disputeReason === "string" ? score.disputeReason : null;
                    return (
                      <div key={`padel-recent-${match.id}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                        <p className="text-[11px] text-white/60">{match.event.title}</p>
                        <p className="text-sm text-white/90">
                          {buildPairingLabel(match.pairingA)} vs {buildPairingLabel(match.pairingB)}
                        </p>
                        {formatDate(match.startAt) ? (
                          <p className="text-[11px] text-white/60">
                            {match.roundLabel || match.groupLabel || "Jogo"} · {formatDate(match.startAt)}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-white/70">Resultado: {formatScoreSummary(match)}</p>
                        {isOwner && match.status === "DONE" && (
                          <PadelDisputeButton
                            matchId={match.id}
                            initialStatus={disputeStatus as "OPEN" | "RESOLVED" | null}
                            initialReason={disputeReason}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/15 bg-white/5 p-5 text-sm text-white/70 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>Explora o perfil normal para ver a atividade geral.</p>
                <Link href={`/${profileHandle}`} className="text-white/85 underline">
                  Ir para perfil normal →
                </Link>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
