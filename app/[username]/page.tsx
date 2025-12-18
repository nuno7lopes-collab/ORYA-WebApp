import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import ProfileHeader from "@/app/components/profile/ProfileHeader";

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

export default async function UserProfilePage({ params }: PageProps) {
  const resolvedParams = await params;
  const usernameParam = resolvedParams?.username;

  if (!usernameParam || usernameParam.toLowerCase() === "me") {
    redirect("/me");
  }

  const [viewerId, profile] = await Promise.all([
    getViewerId(),
    prisma.profile.findUnique({
      where: { username: usernameParam },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        bio: true,
        city: true,
        visibility: true,
        createdAt: true,
      },
    }),
  ]);

  if (!profile || !profile.username) {
    notFound();
  }

  const isOwner = viewerId === profile.id;
  const isPrivate = profile.visibility === "PRIVATE";
  const canShowPrivate = isOwner || !isPrivate;
  let initialIsFollowing = false;

  let stats = {
    total: 0,
    upcoming: 0,
    past: 0,
    totalSpent: "—",
  };
  let followersCount = 0;
  let followingCount = 0;

  let recent: Array<{
    id: string;
    title: string;
    venueName: string | null;
    coverUrl: string | null;
    startAt: Date | null;
    isUpcoming: boolean;
  }> = [];

  if (prisma.follows) {
    const [followers, following] = await Promise.all([
      prisma.follows.count({ where: { following_id: profile.id } }),
      prisma.follows.count({ where: { follower_id: profile.id } }),
    ]);
    followersCount = followers;
    followingCount = following;

    if (!isOwner && viewerId) {
      const followRow = await prisma.follows.findFirst({
        where: { follower_id: viewerId, following_id: profile.id },
        select: { id: true },
      });
      initialIsFollowing = Boolean(followRow);
    }
  }

  if (canShowPrivate && (prisma as any).entitlement) {
    const now = new Date();
    try {
      const [total, upcoming, past, recentEntitlements] = await Promise.all([
        (prisma as any).entitlement.count({ where: { ownerUserId: profile.id } }),
        (prisma as any).entitlement.count({
          where: { ownerUserId: profile.id, snapshotStartAt: { gte: now } },
        }),
        (prisma as any).entitlement.count({
          where: { ownerUserId: profile.id, snapshotStartAt: { lt: now } },
        }),
        (prisma as any).entitlement.findMany({
          where: { ownerUserId: profile.id },
          orderBy: [{ snapshotStartAt: "desc" }],
          take: 4,
          select: {
            id: true,
            snapshotTitle: true,
            snapshotVenueName: true,
            snapshotCoverUrl: true,
            snapshotStartAt: true,
          },
        }),
      ]);

      stats = {
        total,
        upcoming,
        past,
        totalSpent: "—",
      };

      recent = (recentEntitlements ?? []).map((r: any) => ({
        id: r.id,
            title: r.snapshotTitle,
            venueName: r.snapshotVenueName,
            coverUrl: r.snapshotCoverUrl,
            startAt: r.snapshotStartAt,
            isUpcoming: r.snapshotStartAt ? new Date(r.snapshotStartAt) >= now : false,
          }));
    } catch (err) {
      console.warn("[profile] falha ao carregar entitlements", err);
    }
  }

  const displayName = profile.fullName?.trim() || profile.username || "Utilizador ORYA";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_18%,rgba(255,0,200,0.06),transparent_38%),radial-gradient(circle_at_88%_12%,rgba(107,255,255,0.06),transparent_32%),radial-gradient(circle_at_42%_78%,rgba(22,70,245,0.06),transparent_38%),linear-gradient(135deg,#050611_0%,#040812_60%,#05060f_100%)] text-white">
      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <ProfileHeader
          isOwner={isOwner}
          name={profile.fullName}
          username={profile.username}
          avatarUrl={profile.avatarUrl}
          bio={profile.bio}
          city={profile.city}
          visibility={profile.visibility as "PUBLIC" | "PRIVATE" | null}
          createdAt={profile.createdAt?.toISOString?.() ?? null}
          followers={followersCount}
          following={followingCount}
          targetUserId={profile.id}
          initialIsFollowing={initialIsFollowing}
        />

        {canShowPrivate ? (
          <>
            <section className="rounded-3xl border border-white/12 bg-gradient-to-r from-white/6 via-[#0f1424]/35 to-white/6 p-5 shadow-[0_14px_46px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Eventos com bilhete"
                  value={stats.total}
                  subtitle="Timeline ORYA."
                  tone="default"
                />
                <StatCard
                  title="Próximos"
                  value={stats.upcoming}
                  subtitle="O que vem aí."
                  tone="emerald"
                />
                <StatCard
                  title="Passados"
                  value={stats.past}
                  subtitle="Memórias."
                  tone="cyan"
                />
                <StatCard
                  title="Total investido"
                  value={stats.totalSpent}
                  subtitle="Bruto - taxas."
                  tone="purple"
                />
              </div>
            </section>

            {isOwner ? (
              <section className="rounded-3xl border border-[#6BFFFF]/22 bg-gradient-to-br from-[#030816f2] via-[#050a18] to-[#05060f] backdrop-blur-2xl p-5 space-y-4 shadow-[0_18px_60px_rgba(5,6,16,0.55)] min-h-[280px] relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.04),transparent_38%),radial-gradient(circle_at_85%_18%,rgba(255,255,255,0.03),transparent_34%),radial-gradient(circle_at_50%_85%,rgba(255,255,255,0.03),transparent_40%)]" />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-sm font-semibold text-white/95 tracking-[0.08em]">
                      Carteira ORYA
                    </h2>
                    <p className="text-[11px] text-white/68">
                      Entitlements ativos primeiro; memórias logo atrás. Tudo num só lugar.
                    </p>
                  </div>
                  <Link
                    href="/me/carteira"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 text-white text-[11px] font-semibold px-4 py-1.5 shadow-[0_10px_26px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-95 transition-transform backdrop-blur"
                  >
                    Ver carteira
                    <span className="text-[12px]">↗</span>
                  </Link>
                </div>

                {recent.length === 0 ? (
                  <div className="flex h-48 items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-sm text-white/70">
                    Ainda não tens bilhetes ORYA.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {recent.map((item) => (
                      <RecentCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <EventListCard
                  title="Próximos eventos"
                  items={recent.filter((r) => r.isUpcoming)}
                  emptyLabel="Sem eventos futuros para mostrar."
                />
                <EventListCard
                  title="Eventos passados"
                  items={recent.filter((r) => !r.isUpcoming)}
                  emptyLabel="Sem eventos passados para mostrar."
                />
              </div>
            )}
          </>
        ) : (
          <section className="rounded-3xl border border-white/14 bg-white/5 p-6 shadow-[0_26px_70px_rgba(0,0,0,0.55)] backdrop-blur-2xl text-center">
            <h2 className="text-lg font-semibold text-white">Perfil privado</h2>
            <p className="mt-2 text-sm text-white/70">
              {displayName} mantém a timeline privada. Só o próprio consegue ver os eventos e
              bilhetes.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

type StatTone = "default" | "emerald" | "cyan" | "purple";

function toneClasses(tone: StatTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-300/30 from-emerald-500/16 via-emerald-500/9 to-[#0c1a14] shadow-[0_12px_26px_rgba(16,185,129,0.18)] text-emerald-50";
    case "cyan":
      return "border-cyan-300/30 from-cyan-500/16 via-cyan-500/9 to-[#08171c] shadow-[0_12px_26px_rgba(34,211,238,0.18)] text-cyan-50";
    case "purple":
      return "border-purple-300/30 from-purple-500/16 via-purple-500/9 to-[#120d1f] shadow-[0_12px_26px_rgba(168,85,247,0.18)] text-purple-50";
    default:
      return "border-white/14 from-white/10 via-[#0b1224]/75 to-[#0a0f1d] shadow-[0_12px_26px_rgba(0,0,0,0.45)] text-white";
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
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 transition-transform duration-150 hover:-translate-y-[3px] hover:shadow-[0_22px_50px_rgba(0,0,0,0.65)] ${toneClasses(
        tone,
      )}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 mix-blend-screen" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-white/5 blur-2xl" />
      <p
        className={`text-[11px] uppercase tracking-[0.16em] ${
          tone === "default" ? "text-white/65" : "text-white/75"
        }`}
      >
        {title}
      </p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      <p className="text-[12px] text-white/70">{subtitle}</p>
    </div>
  );
}

function RecentCard({
  item,
}: {
  item: { id: string; title: string; venueName: string | null; coverUrl: string | null; startAt: Date | null };
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/5 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,0,200,0.14),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(107,255,255,0.14),transparent_50%),#0b0f1b]">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverUrl}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white/55">
              ORYA
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white line-clamp-2">{item.title}</p>
          <p className="text-[11px] text-white/70 line-clamp-1">{item.venueName || "Local a anunciar"}</p>
          <p className="text-[11px] text-white/60">{formatDate(item.startAt)}</p>
        </div>
      </div>
    </div>
  );
}

function EventListCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<{ id: string; title: string; venueName: string | null; coverUrl: string | null; startAt: Date | null }>;
  emptyLabel: string;
}) {
  return (
    <section className="rounded-3xl border border-white/14 bg-gradient-to-br from-white/8 via-[#0b0f1d]/75 to-[#070b18]/85 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-[12px] text-white/70">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RecentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
