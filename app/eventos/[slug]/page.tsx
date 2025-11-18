// app/eventos/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import WavesSectionClient, {
  WaveTicket,
  WaveStatus,
} from "./WavesSectionClient";
import { createSupabaseServer } from "@/lib/supabaseServer";

type EventPageParams = {
  slug: string;
};

type EventPageProps = {
  // No Next 16, params é uma Promise
  params: Promise<EventPageParams>;
};

function getWaveStatus(ticket: {
  startsAt: Date | null;
  endsAt: Date | null;
  totalQuantity: number | null;
  soldQuantity: number;
}) {
  const now = new Date();

  if (
    ticket.totalQuantity !== null &&
    ticket.totalQuantity !== undefined &&
    ticket.soldQuantity >= ticket.totalQuantity
  ) {
    return "sold_out" as const;
  }

  if (ticket.startsAt && now < ticket.startsAt) {
    return "upcoming" as const;
  }

  if (ticket.endsAt && now > ticket.endsAt) {
    return "closed" as const;
  }

  return "on_sale" as const;
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;

  if (!slug) {
    console.error("EventPage: slug param em falta", await params);
    notFound();
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      tickets: true,
      purchases: {
        select: {
          id: true,
          quantity: true,
          userId: true,
        },
      },
    },
  });

  if (!event) {
    notFound();
  }

  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const goingCount = event.purchases.reduce(
    (sum: number, p: { quantity: number | null }) => sum + (p.quantity ?? 0),
    0,
  );

  const currentUserHasTicket =
    !!userId &&
    event.purchases.some(
      (p) => p.userId !== null && p.userId === userId,
    );

  const startDateObj = new Date(event.startDate);
  const endDateObj = new Date(event.endDate);

  const date = startDateObj.toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const time = startDateObj.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime = endDateObj.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const cover =
    event.coverImageUrl && event.coverImageUrl.trim().length > 0
      ? event.coverImageUrl
      : "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600";

  const interestedCount: number = 0;

  const orderedTickets = event.tickets
    .filter((t) => t.isVisible && t.available)
    .sort((a, b) => {
      const ao = a.sortOrder ?? 0;
      const bo = b.sortOrder ?? 0;
      if (ao !== bo) return ao - bo;
      return a.price - b.price;
    });

  const uiTickets: WaveTicket[] = orderedTickets.map((t, index) => {
    const remaining =
      t.totalQuantity === null || t.totalQuantity === undefined
        ? null
        : t.totalQuantity - t.soldQuantity;

    const status = getWaveStatus({
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      totalQuantity: t.totalQuantity,
      soldQuantity: t.soldQuantity,
    }) as WaveStatus;

    return {
      id: t.id,
      name: t.name?.trim() || `Wave ${index + 1}`,
      price: (t.price ?? 0) / 100,
      currency: t.currency,
      totalQuantity: t.totalQuantity,
      soldQuantity: t.soldQuantity,
      remaining,
      status,
      startsAt: t.startsAt ? t.startsAt.toISOString() : null,
      endsAt: t.endsAt ? t.endsAt.toISOString() : null,
      available: t.available,
      isVisible: t.isVisible,
    };
  });

  const minTicketPrice =
    uiTickets.length > 0
      ? uiTickets.reduce(
          (min, t) => (t.price < min ? t.price : min),
          uiTickets[0].price,
        )
      : null;

  const basePriceEuros =
    event.basePrice !== null && event.basePrice !== undefined
      ? ((event.basePrice as number) ?? 0) / 100
      : null;

  const displayPriceFrom =
    minTicketPrice !== null ? minTicketPrice : basePriceEuros;

  const nowDate = new Date();
  const hasTickets = uiTickets.length > 0;
  const anyOnSale = uiTickets.some((t) => t.status === "on_sale");
  const anyUpcoming = uiTickets.some((t) => t.status === "upcoming");
  const allSoldOut =
    hasTickets && uiTickets.every((t) => t.status === "sold_out");
  const allClosed =
    hasTickets &&
    uiTickets.every(
      (t) => t.status === "closed" || t.status === "sold_out",
    );
  const eventEnded = endDateObj < nowDate;

  let eventStatusLabel = "Evento ativo";
  if (eventEnded) {
    eventStatusLabel = "Evento terminado";
  } else if (allSoldOut) {
    eventStatusLabel = "Evento esgotado";
  } else if (!anyOnSale && anyUpcoming) {
    eventStatusLabel = "Vendas ainda não abriram";
  } else if (allClosed) {
    eventStatusLabel = "Vendas encerradas";
  }

  const hasFiniteStock =
    uiTickets.length > 0 && uiTickets.some((t) => t.remaining !== null);
  const totalRemainingTickets = hasFiniteStock
    ? uiTickets.reduce(
        (sum, t) => sum + Math.max(0, t.remaining ?? 0),
        0,
      )
    : null;

  const safeLocationName = event.locationName || "Local a anunciar";
  const safeTimezone = event.timezone || "Europe/Lisbon";
  const safeOrganizer = event.organizerName || "ORYA";

  const showPriceFrom =
    !event.isFree && (minTicketPrice !== null || event.basePrice !== null);

  return (
    <main className="relative orya-body-bg min-h-screen w-full text-white">
      {/* BG: blur da capa a cobrir o topo da página com transição super suave para o fundo ORYA */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[160vh] overflow-hidden"
        aria-hidden="true"
      >
        {/* camada principal: cover blur com máscara para fazer o fade vertical muito suave */}
        <div
          className="h-full w-full scale-[1.25]"
          style={{
            backgroundImage: `url(${cover})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px)",
            WebkitFilter: "blur(40px)",
            transform: "scale(1.25)",
            WebkitTransform: "scale(1.25)",
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 18%, rgba(0,0,0,0.8) 35%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.3) 75%, rgba(0,0,0,0) 100%)",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.95) 18%, rgba(0,0,0,0.8) 35%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.3) 75%, rgba(0,0,0,0) 100%)",
          }}
        />
        {/* overlay extra para garantir legibilidade no topo da hero e uma transição ainda mais orgânica */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-transparent" />
      </div>

      {/* ========== HERO ============ */}
      <section className="relative z-10 w-full pt-24 pb-10 md:pt-28 md:pb-12">
        <div className="mx-auto flex w-full max-w-6xl items-end px-4 md:px-8">
          <div className="flex w-full flex-col gap-6 md:flex-row md:items-stretch">
            {/* CARTÃO VIDRO – INFO DO EVENTO */}
            <div className="inline-flex max-w-3xl flex-1 flex-col gap-4 rounded-3xl border border-white/18 bg-gradient-to-br from-[#FF8AD908] via-[#9BE7FF14] to-[#020617e6] px-6 py-5 shadow-[0_24px_60px_rgba(0,0,0,0.75)] backdrop-blur-2xl md:px-8 md:py-7">
              <p className="mb-1 text-xs uppercase tracking-[0.22em] text-white/70">
                Evento ORYA · {safeLocationName}
              </p>

              {/* Badges / info rápida */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/85 md:text-sm">
                <span className="rounded-full border border-white/25 bg-black/35 px-3 py-1">
                  {date.charAt(0).toUpperCase() + date.slice(1)} · {time} –{" "}
                  {endTime}
                </span>
                <span className="rounded-full border border-white/25 bg-black/35 px-3 py-1">
                  {safeLocationName}
                </span>
                {event.isFree ? (
                  <span className="rounded-full border border-emerald-400/50 bg-emerald-500/18 px-3 py-1 text-emerald-100">
                    Entrada gratuita
                  </span>
                ) : showPriceFrom ? (
                  <span className="rounded-full border border-fuchsia-400/50 bg-fuchsia-500/18 px-3 py-1 text-fuchsia-100">
                    Desde {(displayPriceFrom ?? 0).toFixed(2)}€
                  </span>
                ) : (
                  <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/12 px-3 py-1 text-fuchsia-100/90">
                    Preço a anunciar
                  </span>
                )}
              </div>

              {/* Título */}
              <h1 className="bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] bg-clip-text text-3xl font-extrabold leading-tight text-transparent md:text-5xl lg:text-6xl md:leading-[1.03]">
                {event.title}
              </h1>

              {/* Estado / pessoas + badge "Já tens bilhete" */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/85">
                <div className="flex items-center gap-2">
                  <span
                    className={`block h-2 w-2 rounded-full ${
                      eventEnded
                        ? "bg-white/40"
                        : allSoldOut
                          ? "bg-orange-400"
                          : anyOnSale
                            ? "bg-emerald-400 animate-pulse"
                            : "bg-yellow-400"
                    }`}
                  />
                  <span>
                    {eventStatusLabel} ·{" "}
                    {goingCount === 0
                      ? "Sê o primeiro a garantir o teu lugar"
                      : `${goingCount} pessoa${
                          goingCount === 1 ? "" : "s"
                        } já têm bilhete`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-white/70">
                  <span className="text-[13px]">♡</span>
                  {interestedCount === 0 ? (
                    <span>
                      Em breve vais poder marcar interesse neste evento.
                    </span>
                  ) : (
                    <span>
                      {interestedCount} pessoa
                      {interestedCount === 1 ? "" : "s"} interessada
                      {interestedCount === 1 ? "" : "s"}.
                    </span>
                  )}
                </div>

                {currentUserHasTicket && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/70 bg-emerald-500/18 px-3 py-1 text-xs text-emerald-100">
                    <span className="text-sm">🎟️</span>
                    <span>Já tens bilhete para este evento</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                {!eventEnded && (
                  <a
                    href="#bilhetes"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-transform hover:scale-105 active:scale-95 md:text-sm"
                  >
                    Ver bilhetes
                    <span className="text-xs">↓</span>
                  </a>
                )}
                {!eventEnded && showPriceFrom && (
                  <span className="text-xs text-white/80 md:text-sm">
                    A partir de{" "}
                    <span className="font-semibold text-white">
                      {(displayPriceFrom ?? 0).toFixed(2)} €
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* POSTER / CAPA DO EVENTO À DIREITA (maior, alinhado em altura com o card) */}
            <div className="md:w-[280px] lg:w-[320px] flex-shrink-0 flex">
              <div className="relative mt-4 h-60 w-full overflow-hidden rounded-3xl border border-white/20 bg-white/5 shadow-[0_22px_50px_rgba(0,0,0,0.9)] backdrop-blur-2xl md:mt-0 md:h-full min-h-[230px]">
                <img
                  src={cover}
                  alt={`Capa do evento ${event.title}`}
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/0" />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-2 max-w-6xl px-4 md:px-8">
          <p className="text-xs text-white/70">
            Capa oficial do evento · {safeOrganizer}
          </p>
        </div>
      </section>

      {/* ========== CONTENT AREA ============ */}
      <section className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-16 px-6 pb-20 pt-8 md:grid-cols-3 md:px-10 md:pt-10">
        {/* LEFT SIDE — Info + Descrição */}
        <div className="space-y-10 md:col-span-2">
          <div>
            <h2 className="mb-4 text-2xl font-semibold">Sobre o evento</h2>
            <p className="whitespace-pre-line leading-relaxed text-white/80">
              {event.description &&
              event.description.trim().length > 0
                ? event.description
                : "A descrição deste evento será atualizada em breve."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-lg font-semibold">
                Informações adicionais
              </h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li>
                  <span className="text-white/55">Fuso horário: </span>
                  {safeTimezone}
                </li>
                <li>
                  <span className="text-white/55">Organizador: </span>
                  {safeOrganizer}
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-lg font-semibold">Como funciona</h3>
              <p className="text-sm text-white/80">
                Este evento junta desporto, música e energia real. Reserva o teu
                lugar, aparece com antecedência e traz a tua melhor atitude para
                um dia competitivo, mas sempre com espírito ORYA.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE — CARD DE INFORMAÇÕES / TICKETS */}
        <div className="space-y-6 rounded-2xl border border-white/15 bg-gradient-to-br from-[#FF8AD908] via-[#9BE7FF14] to-[#020617e6] p-6 shadow-[0_22px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
          <div>
            <h3 className="mb-2 text-xl font-semibold">Data &amp; Hora</h3>
            <p className="text-white/80">
              {date.charAt(0).toUpperCase() + date.slice(1)} · {time} –{" "}
              {endTime}
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xl font-semibold">Local</h3>
            <p className="text-white/85">{safeLocationName}</p>
            {event.address && (
              <p className="text-sm text-white/60">{event.address}</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xl font-semibold">
              Estado &amp; lotação
            </h3>
            <p className="text-sm text-white/80">{eventStatusLabel}</p>
            <p className="text-sm text-white/80">
              {goingCount === 0
                ? "Ainda ninguém confirmou presença."
                : `${goingCount} pessoa${
                    goingCount === 1 ? "" : "s"
                  } já têm bilhete confirmado (todas as waves).`}
            </p>
            {hasFiniteStock &&
              !eventEnded &&
              !event.isFree &&
              totalRemainingTickets !== null && (
                <p className="mt-1 text-xs text-white/75">
                  Há ainda{" "}
                    <span className="font-semibold text-white">
                      {totalRemainingTickets}
                    </span>{" "}
                  bilhete
                  {totalRemainingTickets === 1 ? "" : "s"} disponível
                  {totalRemainingTickets === 1 ? "" : "s"} no total.
                </p>
              )}
            <p className="mt-1 text-[11px] text-white/55">
              Contagem baseada em compras reais de bilhetes em todas as waves.
            </p>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/45 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">♡</span>
                <div className="text-xs">
                  <p className="font-medium text-white/85">
                    Pessoas interessadas
                  </p>
                  <p className="text-white/70">
                    Em breve vais poder marcar este evento como “quero ir”.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/70">
                {interestedCount} interessad
                {interestedCount === 1 ? "a" : "os"}
              </span>
            </div>
          </div>

          {!eventEnded ? (
            <div
              id="bilhetes"
              className="scroll-mt-24 space-y-4 border-t border-white/12 pt-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xl font-semibold">Bilhetes</h3>
                {!event.isFree && showPriceFrom && (
                  <span className="text-xs text-white/75">
                    A partir de{" "}
                    <span className="font-semibold text-white">
                      {(displayPriceFrom ?? 0).toFixed(2)} €
                    </span>
                  </span>
                )}
              </div>

              {event.isFree ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2.5 text-sm text-emerald-100">
                  <div>
                    <p className="font-semibold">Entrada gratuita</p>
                    <p className="text-[11px] text-emerald-100/85">
                      Basta garantir o teu lugar — não há custo de bilhete.
                    </p>
                  </div>
                </div>
              ) : uiTickets.length === 0 ? (
                <div className="rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white/80">
                  Ainda não há waves configuradas para este evento.
                </div>
              ) : (
                <WavesSectionClient
                  slug={event.slug}
                  tickets={uiTickets}
                  isFreeEvent={event.isFree}
                />
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white/85">
              Este evento já terminou. Bilhetes e inscrições deixaram de estar
              disponíveis.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}