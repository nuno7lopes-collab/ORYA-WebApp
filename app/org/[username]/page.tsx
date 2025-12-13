import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";

type Params = { username: string };

export default async function PublicOrganizerPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;

  if (!username) notFound();

  const organizer = await prisma.organizer.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      id: true,
      displayName: true,
      publicName: true,
      businessName: true,
      username: true,
      city: true,
      address: true,
      showAddressPublicly: true,
      publicListingEnabled: true,
      brandingAvatarUrl: true,
      brandingPrimaryColor: true,
      brandingSecondaryColor: true,
    },
  });

  if (!organizer || organizer.publicListingEnabled === false) {
    notFound();
  }

  const events = await prisma.event.findMany({
    where: { organizerId: organizer.id, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      templateType: true,
      startsAt: true,
      locationName: true,
      coverImageUrl: true,
      isFree: true,
    },
    orderBy: { startsAt: "asc" },
    take: 50,
  });

  const primary = organizer.brandingPrimaryColor || "#6BFFFF";
  const secondary = organizer.brandingSecondaryColor || "#0b1224";
  const displayName = organizer.publicName || organizer.displayName || organizer.businessName || organizer.username || "Organizador";

  return (
    <main
      className="min-h-screen text-white"
      style={
        {
          "--brand-primary": primary,
          "--brand-secondary": secondary,
        } as CSSProperties
      }
    >
      <section className="mx-auto max-w-5xl px-5 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 rounded-2xl border border-white/15 bg-[var(--brand-secondary)] shadow-[0_10px_30px_rgba(0,0,0,0.45)] overflow-hidden">
            {organizer.brandingAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={organizer.brandingAvatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white/80">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Organizador</p>
            <h1 className="text-3xl font-bold">{displayName}</h1>
            {organizer.city && <p className="text-sm text-white/70">{organizer.city}</p>}
            {organizer.showAddressPublicly && organizer.address && (
              <p className="text-sm text-white/60">{organizer.address}</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[var(--brand-secondary)] via-[#0b1224] to-black p-5 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Eventos</h2>
              <p className="text-[12px] text-white/65">
                Agenda pública deste organizador. Apenas eventos listados publicamente são mostrados.
              </p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] text-white/70">
              {events.length} evento{events.length === 1 ? "" : "s"}
            </span>
          </div>

          {events.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70">
              Ainda não há eventos publicados por esta organização.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((ev) => (
                <a
                  key={ev.id}
                  href={`/eventos/${ev.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden hover:border-white/18 hover:-translate-y-[4px] transition block"
                >
                  <div className="h-32 w-full bg-gradient-to-br from-[var(--brand-secondary)]/80 to-black/60 overflow-hidden">
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
                    <p className="text-[11px] text-white/60 line-clamp-1">{ev.locationName || "Local a anunciar"}</p>
                    <span className="inline-flex rounded-full border border-white/12 bg-[var(--brand-primary)]/15 px-2 py-0.5 text-[10px] text-white/80">
                      {ev.templateType || "Evento"}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
