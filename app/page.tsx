import Link from "next/link";
import Image from "next/image";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapEventToCardDTO, type EventCardDTO } from "@/lib/events";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildEventLink(event: EventCardDTO) {
  return event.type === "EXPERIENCE" ? `/experiencias/${event.slug}` : `/eventos/${event.slug}`;
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

export default async function HomePage() {
  let eventsRaw: EventForHome[] = [];

  try {
    eventsRaw = await prisma.event.findMany({
      where: { status: "PUBLISHED", isTest: false },
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

  const defaultCover = (() => {
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="840" viewBox="0 0 1400 840">
  <defs>
    <linearGradient id="bg" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#0b0c12"/>
      <stop offset="50%" stop-color="#080910"/>
      <stop offset="100%" stop-color="#05060b"/>
    </linearGradient>
    <radialGradient id="glow1" cx="20%" cy="24%" r="34%">
      <stop offset="0%" stop-color="#9aa6c7" stop-opacity="0.35"/>
      <stop offset="70%" stop-color="#9aa6c7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="78%" cy="20%" r="30%">
      <stop offset="0%" stop-color="#7d8fb5" stop-opacity="0.32"/>
      <stop offset="70%" stop-color="#7d8fb5" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow3" cx="52%" cy="80%" r="42%">
      <stop offset="0%" stop-color="#4f5b73" stop-opacity="0.28"/>
      <stop offset="70%" stop-color="#4f5b73" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.08)"/>
      <stop offset="42%" stop-color="rgba(255,255,255,0.02)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.08)"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="20%" stop-color="rgba(255,255,255,0.03)"/>
      <stop offset="50%" stop-color="rgba(255,255,255,0.1)"/>
      <stop offset="78%" stop-color="rgba(255,255,255,0.03)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0.14)"/>
    </linearGradient>
  </defs>
  <rect width="1400" height="840" fill="url(#bg)"/>
  <rect width="1400" height="840" fill="url(#glow1)"/>
  <rect width="1400" height="840" fill="url(#glow2)"/>
  <rect width="1400" height="840" fill="url(#glow3)"/>

  <rect x="130" y="100" width="1140" height="640" rx="38" fill="url(#glass)" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
  <rect x="105" y="82" width="1190" height="675" fill="url(#sheen)" opacity="0.45"/>

  <g opacity="0.12" stroke="rgba(255,255,255,0.24)" stroke-width="1">
    <path d="M110 220 Q540 150 930 240 T1310 220"/>
    <path d="M90 390 Q520 330 900 420 T1300 390"/>
    <path d="M70 570 Q520 520 900 620 T1320 600"/>
  </g>

  <g opacity="0.32" stroke="rgba(255,255,255,0.18)" stroke-width="1.3" fill="none">
    <circle cx="340" cy="240" r="46"/>
    <circle cx="1060" cy="220" r="38"/>
    <circle cx="940" cy="560" r="44"/>
  </g>
</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  })();

  const spotlightCards = Array.from({ length: 3 }).map((_, idx) => events[idx] ?? null);
  const spotlightCovers = spotlightCards.map((ev) =>
    ev?.coverImageUrl
      ? optimizeImageUrl(ev.coverImageUrl, 1200, 70, "webp") || ev.coverImageUrl
      : defaultCover
  );

  return (
    <main className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white pb-24 md:pb-12">
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.28),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute top-[22vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.22),transparent_60%)] opacity-80 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(22,70,245,0.25),transparent_60%)] opacity-70 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_35%,rgba(0,0,0,0.65))] mix-blend-screen" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.05),transparent_60%)]" />

      <section className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-10 md:px-8 md:pt-12">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/55">Bem-vindo à</p>
            <h1 className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-3xl font-bold leading-tight text-transparent">
              ORYA
            </h1>
            <p className="text-sm text-white/70">Explora eventos com o look glassy premium da plataforma.</p>
          </div>
          <Link
            href="/explorar"
            className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:shadow-[0_22px_55px_rgba(255,255,255,0.25)]"
          >
            Explorar
            <span className="text-[10px] opacity-70 transition group-hover:opacity-100">→</span>
          </Link>
        </div>

        <div className="rounded-[28px] border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.14),rgba(2,6,16,0.88))] shadow-[0_28px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">
              Em alta agora
            </h2>
            <Link
              href="/explorar"
              className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/90 backdrop-blur transition hover:border-white/45 hover:bg-white/20"
            >
              Ver tudo
            </Link>
          </div>

          <div className="mx-4 mb-5 grid gap-4 md:grid-cols-3">
            {spotlightCards.map((card, idx) => {
              const cover = card ? spotlightCovers[idx] : defaultCover;
              const isEmpty = !card;

              return (
                <div
                  key={idx}
                  className="group relative overflow-hidden rounded-2xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(2,6,16,0.9))] shadow-[0_22px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_40%)] opacity-50" />
                  <div className="relative h-44 w-full overflow-hidden">
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

                    <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[12px] font-semibold text-white drop-shadow-lg">
                          {isEmpty ? "Em breve" : card.title}
                        </p>
                        <p className="text-[11px] text-white/80">
                          {isEmpty ? "Novos eventos a caminho" : formatDateLabel(card)}
                        </p>
                      </div>
                      {!isEmpty && (
                        <p className="rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white border border-white/20">
                          {formatPriceLabel(card)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 px-4 pb-4 pt-3">
                    <p className="text-xs text-white/75">
                      {isEmpty
                        ? "Fica atento — vamos adicionar mais eventos em destaque."
                        : "Evento em destaque. Abre para veres todos os detalhes e reservar já."}
                    </p>
                    {!isEmpty ? (
                      <Link
                        href={buildEventLink(card)}
                        className="relative inline-flex w-full items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white px-3 py-2 text-xs font-semibold text-black shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition hover:shadow-[0_20px_55px_rgba(255,255,255,0.25)]"
                      >
                        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.55),rgba(255,255,255,0.15),rgba(255,255,255,0.35))] opacity-50" />
                        <span className="relative z-10">Abrir evento</span>
                      </Link>
                    ) : (
                      <div className="flex w-full items-center justify-center rounded-xl border border-white/18 bg-[linear-gradient(120deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] px-3 py-2 text-[11px] text-white/80 shadow-[0_0_24px_rgba(255,255,255,0.12)] backdrop-blur">
                        Em breve
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pointer-events-none relative" aria-hidden="true">
          <div className="relative my-8 md:my-10">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="absolute inset-0 blur-2xl">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[#6BFFFF]/35 to-transparent" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-3 rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(2,6,16,0.88))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Os teus eventos</h2>
              <Link
                href="/explorar"
                className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/90 backdrop-blur transition hover:border-white/45 hover:bg-white/20"
              >
                Ver mais
              </Link>
            </div>
            <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-4 text-sm text-white/85">
              Ainda não tens eventos. Explora e junta-te a um evento para aparecer aqui.
            </div>
          </section>

          <section className="space-y-3 rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(2,6,16,0.88))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Sugestões personalizadas</h2>
            </div>
            <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-4 text-sm text-white/85">
              Ainda estamos a conhecer-te. À medida que usares a ORYA, as sugestões vão aparecer aqui.
            </div>
          </section>
        </div>

        <section className="space-y-3 rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(2,6,16,0.88))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Oportunidades perto de ti agora</h2>
          </div>
          <div className="rounded-2xl border border-white/15 bg-black/45 px-4 py-4 text-sm text-white/85">
            Sem oportunidades perto de ti neste momento. Vais ser o primeiro a saber quando surgir algo porreiro.
          </div>
        </section>

        <section className="space-y-2 rounded-3xl border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.12),rgba(2,6,16,0.88))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
          <h2 className="text-sm font-semibold text-white">Amigos vão a…</h2>
          <p className="text-sm text-white/80">
            Quando os teus amigos começarem a ir a eventos, vais ver aqui onde eles vão.
          </p>
        </section>
      </section>
    </main>
  );
}
