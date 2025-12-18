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
    <main className="relative min-h-screen bg-[radial-gradient(circle_at_15%_10%,#8a1ecb22_0%,transparent_28%),radial-gradient(circle_at_85%_8%,#00eaff22_0%,transparent_25%),radial-gradient(circle_at_40%_75%,#ff00c822_0%,transparent_38%),linear-gradient(135deg,#050611_0%,#040812_60%,#05060d_100%)] text-white pb-24 md:pb-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.04),transparent_60%)]" />

      <section className="relative mx-auto flex max-w-5xl flex-col gap-8 px-4 pt-8">
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
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-[#6BFFFF] shadow-[0_0_20px_rgba(107,255,255,0.25)] hover:border-white/25 hover:bg-white/10"
          >
            Explorar →
          </Link>
        </div>

        <div className="rounded-[28px] border border-white/12 bg-gradient-to-br from-[#0B1229] via-[#0A0E1A] to-[#05060f] shadow-[0_26px_70px_rgba(5,6,16,0.8)] backdrop-blur-3xl">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">
              Em alta agora
            </h2>
            <Link href="/explorar" className="text-[11px] text-[#6BFFFF] hover:underline">
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
                  className="group relative overflow-hidden rounded-2xl border border-white/12 bg-black/40 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
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
                        <p className="rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold text-white border border-white/15">
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
                        className="relative inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-2 text-xs font-semibold text-black shadow-[0_0_24px_rgba(107,255,255,0.55)] transition hover:brightness-110"
                      >
                        Abrir evento
                      </Link>
                    ) : (
                      <div className="flex w-full items-center justify-center rounded-xl border border-white/12 bg-gradient-to-r from-white/8 via-white/4 to-white/8 px-3 py-2 text-[11px] text-white/75 shadow-[0_0_24px_rgba(255,255,255,0.12)]">
                        Em breve
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-3 rounded-3xl border border-white/10 bg-gradient-to-br from-white/6 via-[#0d1426]/70 to-[#0b0f1d] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Os teus eventos</h2>
              <Link href="/explorar" className="text-[11px] text-[#6BFFFF] hover:underline">
                Ver mais
              </Link>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/75">
              Ainda não tens eventos. Explora e junta-te a um evento para aparecer aqui.
            </div>
          </section>

          <section className="space-y-3 rounded-3xl border border-white/10 bg-gradient-to-br from-white/6 via-[#0d1426]/70 to-[#0b0f1d] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Sugestões personalizadas</h2>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/75">
              Ainda estamos a conhecer-te. À medida que usares a ORYA, as sugestões vão aparecer aqui.
            </div>
          </section>
        </div>

        <section className="space-y-3 rounded-3xl border border-white/10 bg-gradient-to-br from-white/4 via-[#0c0f1c] to-[#0a0a15] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Oportunidades perto de ti agora</h2>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/75">
            Sem oportunidades perto de ti neste momento. Vais ser o primeiro a saber quando surgir algo porreiro.
          </div>
        </section>

        <section className="space-y-2 rounded-3xl border border-white/10 bg-gradient-to-br from-white/4 via-[#0c0f1c] to-[#0a0a15] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <h2 className="text-sm font-semibold text-white">Amigos vão a…</h2>
          <p className="text-sm text-white/75">
            Quando os teus amigos começarem a ir a eventos, vais ver aqui onde eles vão.
          </p>
        </section>
      </section>
    </main>
  );
}
