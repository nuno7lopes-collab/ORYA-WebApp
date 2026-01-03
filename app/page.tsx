import Link from "next/link";
import Image from "next/image";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapEventToCardDTO, type EventCardDTO } from "@/lib/events";
import { defaultBlurDataURL } from "@/lib/image";
import { getEventCoverUrl } from "@/lib/eventCover";
import HomePersonalized from "@/app/components/home/HomePersonalized";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildEventLink(event: EventCardDTO) {
  return `/eventos/${event.slug}`;
}

const eventSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  type: true,
  startsAt: true,
  endsAt: true,
  locationName: true,
  locationCity: true,
  isFree: true,
  coverImageUrl: true,
  ticketTypes: {
    select: {
      price: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.EventSelect;

type EventForHome = Prisma.EventGetPayload<{
  select: typeof eventSelect;
}>;

function formatDateLabel(event: EventCardDTO) {
  if (!event.startsAt) return "Data a anunciar";
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;

  const day = start.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  const startTime = start.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime =
    end &&
    end.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (endTime) {
    return `${day} · ${startTime} – ${endTime}`;
  }
  return `${day} · ${startTime}`;
}

function formatPriceLabel(event: EventCardDTO) {
  if (event.isFree) return "Entrada gratuita";
  if (event.priceFrom == null) return "Preço a anunciar";
  const formatted = event.priceFrom.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Desde ${formatted} €`;
}

function formatQuickDate(value?: string | null) {
  if (!value) return "Data a anunciar";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data a anunciar";
  return parsed.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

export default async function HomePage() {
  let eventsRaw: EventForHome[] = [];

  try {
    eventsRaw = await prisma.event.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { startsAt: "asc" },
      select: eventSelect,
      take: 12,
    });
  } catch (err) {
    console.error("[home] falha ao ligar à BD para listar eventos", err);
  }

  const events: EventCardDTO[] = eventsRaw
    .map(mapEventToCardDTO)
    .filter((e): e is EventCardDTO => e !== null);

  const spotlightCards = Array.from({ length: 3 }).map((_, idx) => events[idx] ?? null);
  const spotlightCovers = spotlightCards.map((ev, idx) =>
    getEventCoverUrl(ev?.coverImageUrl ?? null, {
      seed: ev?.slug ?? ev?.id ?? `home-${idx}`,
      width: 1200,
      quality: 70,
      format: "webp",
    })
  );
  const suggestionEvents = events.slice(0, 6).map((ev) => ({
    id: ev.id,
    slug: ev.slug,
    title: ev.title,
    startsAt: ev.startsAt ? ev.startsAt.toISOString() : null,
    coverImageUrl: ev.coverImageUrl ?? null,
    priceFrom: ev.priceFrom ?? null,
    locationCity: ev.locationCity ?? null,
  }));
  const quickSuggestions = suggestionEvents.slice(0, 4);

  return (
    <main className="relative min-h-screen w-full overflow-hidden text-white pb-24 md:pb-12">

      <section className="relative orya-page-width flex flex-col gap-6 px-4 pt-8 md:px-8 md:pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/55">Bem-vindo à</p>
            <h1 className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-3xl font-bold leading-tight text-transparent">
              ORYA
            </h1>
            <p className="text-sm text-white/70">Tudo a acontecer à tua volta, num só ecrã.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/explorar"
              className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:shadow-[0_22px_55px_rgba(255,255,255,0.25)]"
            >
              Explorar
              <span className="text-[10px] opacity-70 transition group-hover:opacity-100">→</span>
            </Link>
            <Link
              href="/organizacao"
              className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] text-white/80 backdrop-blur hover:bg-white/20"
            >
              Organizar
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.14),rgba(2,6,16,0.88))] shadow-[0_28px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Em alta agora</p>
                  <p className="text-sm text-white/70">Os destaques que estão a mexer a cidade.</p>
                </div>
                <Link
                  href="/explorar"
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/90 backdrop-blur transition hover:border-white/45 hover:bg-white/20"
                >
                  Ver tudo
                </Link>
              </div>

              <div className="mx-4 mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {spotlightCards.map((card, idx) => {
                  const cover = spotlightCovers[idx];
                  const isEmpty = !card;

                  return (
                    <div
                      key={idx}
                      className="group relative w-full overflow-hidden rounded-2xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(2,6,16,0.9))] shadow-[0_22px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_40%)] opacity-50" />
                      <div className="relative aspect-square w-full overflow-hidden">
                        {cover ? (
                          <Image
                            src={cover}
                            alt={card?.title ?? "Evento ORYA"}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                            placeholder="blur"
                            blurDataURL={defaultBlurDataURL}
                          />
                        ) : (
                          <div className="absolute inset-0">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,0,200,0.45),transparent_32%),radial-gradient(circle_at_78%_16%,rgba(107,255,255,0.35),transparent_28%),radial-gradient(circle_at_50%_80%,rgba(22,70,245,0.28),transparent_42%),linear-gradient(135deg,#0b1224_0%,#050915_72%)]" />
                            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.02)_20%,rgba(255,255,255,0.12)_45%,rgba(255,255,255,0.02)_72%,rgba(255,255,255,0.14)_100%)] opacity-35" />
                            <div className="absolute inset-3 rounded-[20px] border border-white/10 shadow-[0_0_22px_rgba(107,255,255,0.2)]" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-black/85" />
                        <div className="absolute left-3 top-3">
                          <span className="rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/80 shadow-[0_0_18px_rgba(255,255,255,0.25)]">
                            {isEmpty ? "Em breve" : "Destaque"}
                          </span>
                        </div>

                        {!isEmpty && (
                          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-[12px] font-semibold text-white drop-shadow-lg">
                                {card.title}
                              </p>
                              <p className="text-[11px] text-white/80">{formatDateLabel(card)}</p>
                            </div>
                            <p className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white border border-white/20">
                              {formatPriceLabel(card)}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 px-3 pb-3 pt-2">
                        {!isEmpty && (
                          <p className="text-[11px] text-white/75 line-clamp-2">
                            Evento em destaque. Abre para veres todos os detalhes e reservar já.
                          </p>
                        )}
                        {!isEmpty ? (
                          <Link
                            href={buildEventLink(card)}
                            className="relative inline-flex w-full items-center justify-center overflow-hidden rounded-lg border border-white/30 bg-white px-3 py-1.5 text-[11px] font-semibold text-black shadow-[0_14px_32px_rgba(0,0,0,0.35)] transition hover:shadow-[0_18px_45px_rgba(255,255,255,0.25)]"
                          >
                            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.55),rgba(255,255,255,0.15),rgba(255,255,255,0.35))] opacity-50" />
                            <span className="relative z-10">Abrir evento</span>
                          </Link>
                        ) : (
                          <div className="flex w-full items-center justify-center rounded-lg border border-white/18 bg-[linear-gradient(120deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] px-3 py-1.5 text-[11px] text-white/80 shadow-[0_0_24px_rgba(255,255,255,0.12)] backdrop-blur">
                            Em breve
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/12 bg-white/5 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">Para ti</p>
                  <p className="text-sm text-white/70">Sugestões rápidas com base no teu ritmo.</p>
                </div>
                <Link
                  href="/explorar"
                  className="text-[10px] text-white/70 hover:text-white"
                >
                  Ver mais
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {quickSuggestions.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-white/12 bg-black/30 px-4 py-6 text-[12px] text-white/60">
                    Sem sugestões para mostrar agora.
                  </div>
                ) : (
                  quickSuggestions.map((event) => {
                    const cover = getEventCoverUrl(event.coverImageUrl, {
                      seed: event.slug ?? event.id,
                      width: 420,
                      quality: 70,
                      format: "webp",
                    });
                    return (
                      <Link
                        key={event.id}
                        href={`/eventos/${event.slug}`}
                        className="group rounded-2xl border border-white/12 bg-black/40 overflow-hidden hover:border-white/25 transition"
                      >
                        <div className="relative aspect-square w-full overflow-hidden">
                          <Image
                            src={cover}
                            alt={event.title}
                            fill
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 220px"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                            placeholder="blur"
                            blurDataURL={defaultBlurDataURL}
                          />
                          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/70" />
                          <div className="absolute inset-x-3 bottom-3">
                            <p className="text-[11px] font-semibold text-white line-clamp-1">
                              {event.title}
                            </p>
                            <p className="text-[10px] text-white/70">
                              {formatQuickDate(event.startsAt)} · {event.locationCity ?? "Portugal"}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <HomePersonalized suggestions={suggestionEvents} variant="compact" />
        </div>
      </section>
    </main>
  );
}
