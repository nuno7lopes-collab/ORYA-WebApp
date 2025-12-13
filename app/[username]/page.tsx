import { notFound } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import FollowClient from "./FollowClient";

type Params = { username: string };

export default async function PublicProfilePage({ params }: { params: Promise<Params> }) {
  const { username } = await params;

  if (!username || username.trim() === "") {
    notFound();
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const profile = await prisma.profile.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      city: true,
      visibility: true,
      followers: {
        select: { id: true },
      },
      following: {
        select: { id: true },
      },
    },
  });

  if (!profile) {
    notFound();
  }

  const visibility = profile.visibility ?? "PUBLIC";
  const isOwner = viewer?.id === profile.id;
  const isPrivate = visibility === "PRIVATE" && !isOwner;
  const displayName = profile.fullName || profile.username || "Utilizador ORYA";
  const usernameLabel = profile.username || "perfil";

  // Eventos públicos deste organizador/utilizador
  const events = isPrivate
    ? []
    : await prisma.event.findMany({
        where: {
          ownerUserId: profile.id,
          status: "PUBLISHED",
        },
        select: {
          id: true,
          slug: true,
          title: true,
          type: true,
          startsAt: true,
          locationName: true,
          coverImageUrl: true,
        },
        orderBy: { startsAt: "asc" },
        take: 30,
      });

  const followersCount = profile.followers?.length ?? 0;
  const followingCount = profile.following?.length ?? 0;

  return (
    <main className="orya-body-bg min-h-screen text-white">
      <section className="max-w-5xl mx-auto px-5 py-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] flex items-center justify-center text-black font-semibold text-xl overflow-hidden shadow-[0_10px_28px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{displayName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{displayName}</h1>
            <p className="text-sm text-white/70">@{usernameLabel}</p>
            {!isOwner && !isPrivate && (
              <FollowClient targetUserId={profile.id} initialIsFollowing={false} />
            )}
            {!isPrivate && (
              <div className="flex gap-3 text-[12px] text-white/70">
                <span>{followingCount} a seguir</span>
                <span>{followersCount} seguidores</span>
              </div>
            )}
          </div>
        </div>
        {isPrivate ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            Este perfil é privado. Vês apenas avatar, nome e username.
          </div>
        ) : (
          <>
            <div className="space-y-2 text-sm text-white/65">
              {profile.city && <p>📍 {profile.city}</p>}
              <p>Eventos e experiências públicos deste organizador/usuário.</p>
            </div>

            <div className="mt-4 space-y-2">
              <h2 className="text-lg font-semibold">Eventos</h2>
              {events.length === 0 ? (
                <p className="text-sm text-white/60">Ainda não há eventos públicos associados.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {events.map((ev) => {
                    const href = ev.type === "EXPERIENCE" ? `/experiencias/${ev.slug}` : `/eventos/${ev.slug}`;
                    return (
                      <a
                        key={ev.id}
                        href={href}
                        className="group rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden hover:border-white/18 hover:-translate-y-[4px] transition block"
                      >
                        <div className="h-32 w-full bg-gradient-to-br from-[#111827]/60 to-[#0b1224]/60 overflow-hidden">
                          {ev.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={ev.coverImageUrl}
                              alt={ev.title}
                              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                          ) : null}
                        </div>
                        <div className="p-3 space-y-1.5">
                          <p className="text-[13px] font-semibold text-white line-clamp-2">{ev.title}</p>
                          <p className="text-[11px] text-white/70">
                            {ev.startsAt
                              ? new Date(ev.startsAt).toLocaleString("pt-PT", {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Data a anunciar"}
                          </p>
                          <p className="text-[11px] text-white/60 line-clamp-1">
                            {ev.locationName || "Local a anunciar"}
                          </p>
                          <span className="inline-flex rounded-full border border-white/12 bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                            {ev.type === "EXPERIENCE" ? "Experiência" : "Evento"}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
