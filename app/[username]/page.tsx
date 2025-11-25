import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function PublicProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const { username } = params;
  const profile = await prisma.profile.findUnique({
    where: { username },
  });
  if (!profile) {
    notFound();
  }

  const displayName =
    profile.fullName || profile.username || "Utilizador ORYA";
  const initial =
    displayName.trim().charAt(0).toUpperCase() || "O";
  const isOrganizer = profile.roles?.includes("organizer") ?? false;
  const joinYear = profile.createdAt ? profile.createdAt.getFullYear() : undefined;
  const experiences = await prisma.event.findMany({
    where: {
      type: "EXPERIENCE",
      ownerUserId: profile.id,
      status: "PUBLISHED",
    },
    orderBy: {
      startsAt: "asc",
    },
    take: 5,
  });

  return (
    <main className="min-h-screen orya-body-bg text-white px-4 sm:px-6 py-10 sm:py-14">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* HEADER TOPO / HERO */}
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/40">
              Perfil público ORYA
            </p>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span>{displayName}</span>
              <span className="text-white/35 text-base sm:text-lg font-normal">
                / ORYA
              </span>
            </h1>
            {profile.username && (
              <p className="text-xs sm:text-sm text-white/50 mt-0.5">
                @{profile.username}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-white/60">
              {joinYear && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  🎉 Entrou em {joinYear}
                </span>
              )}
              {profile.city && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  <span>📍</span>
                  <span>{profile.city}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 border border-white/10 font-semibold">
                {isOrganizer ? "👑 Organizador" : "🙋‍♂️ Utilizador"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href={`/login?redirect=/${encodeURIComponent(username)}`}
              className="px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] shadow-[0_0_22px_rgba(107,255,255,0.6)] hover:scale-105 active:scale-95 transition-transform"
            >
              Seguir
            </Link>
            <Link
              href="/explorar"
              className="hidden sm:inline-flex text-[10px] px-3 py-1.5 rounded-full border border-white/15 text-white/70 hover:bg-white/5 transition-colors"
            >
              Explorar ORYA
            </Link>
          </div>
        </header>

        {/* CARD PRINCIPAL DE PERFIL */}
        <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-[#020617] via-slate-950 to-black p-6 sm:p-7 md:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.9)]">
          {/* Glow de fundo futurista */}
          <div className="absolute inset-0 pointer-events-none opacity-60 blur-3xl bg-[radial-gradient(circle_at_top,_#FF00C8_0,_transparent_55%),_radial-gradient(circle_at_bottom,_#6BFFFF_0,_transparent_55%)]" />
          <div className="relative flex flex-col sm:flex-row gap-6 sm:gap-7">
            {/* Avatar */}
            <div className="flex sm:block items-center gap-4 sm:gap-0 shrink-0">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-[3px] bg-[conic-gradient(from_140deg,_#FF00C8,_#6BFFFF,_#1646F5,_#FF00C8)] shadow-[0_0_35px_rgba(107,255,255,0.5)]">
                <div className="w-full h-full rounded-full bg-black/70 overflow-hidden flex items-center justify-center text-4xl font-bold">
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{initial}</span>
                  )}
                </div>
              </div>
            </div>
            {/* Info principal */}
            <div className="flex-1 space-y-4">
              {/* Bio */}
              <div className="space-y-2">
                <p className="text-sm text-white/80">
                  {profile.bio
                    ? profile.bio
                    : "Este utilizador ainda não escreveu uma bio."}
                </p>
              </div>
              {/* Interesses */}
              {profile.favouriteCategories && profile.favouriteCategories.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                    INTERESSES
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {profile.favouriteCategories.map((cat: string) => (
                      <span
                        key={cat}
                        className="px-3 py-1 rounded-full bg-white/8 border border-white/15 text-[11px] text-white/80"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PLACEHOLDER SECTIONS */}
        <section className="space-y-4">
          <div className="rounded-2xl bg-black/60 border border-white/10 px-6 py-5">
            <h2 className="text-lg sm:text-xl font-semibold mb-1">Organiza</h2>
            <p className="text-white/60 text-sm">
              Em breve vais conseguir ver os eventos que esta pessoa organiza na ORYA.
            </p>
          </div>
          <div className="rounded-2xl bg-black/60 border border-white/10 px-6 py-5">
            <h2 className="text-lg sm:text-xl font-semibold mb-1">Cria experiências</h2>
            {experiences.length === 0 ? (
              <p className="text-white/60 text-sm">
                Este utilizador ainda não criou nenhuma experiência pública na ORYA.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-white/60 text-sm">
                  Algumas das experiências que esta pessoa cria com amigos:
                </p>
                <ul className="space-y-2">
                  {experiences.map((exp) => (
                    <li
                      key={exp.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/experiencias/${exp.slug}`}
                          className="text-sm font-medium text-white hover:underline"
                        >
                          {exp.title}
                        </Link>
                        <p className="text-[11px] text-white/55 mt-0.5 truncate">
                          {exp.locationName || exp.locationCity
                            ? `${exp.locationName || ""}${
                                exp.locationName && exp.locationCity ? " · " : ""
                              }${exp.locationCity || ""}`
                            : "Local a definir"}
                        </p>
                      </div>
                      {exp.startsAt && (
                        <span className="shrink-0 text-[11px] text-white/60">
                          {new Date(exp.startsAt).toLocaleDateString("pt-PT", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}