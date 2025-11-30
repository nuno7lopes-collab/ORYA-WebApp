// app/eventos/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { CheckoutProvider } from "@/app/components/checkout/contextoCheckout";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import WavesSectionClient, { type WaveTicket, type WaveStatus } from "./WavesSectionClient";
import Link from "next/link";
import EventPageClient from "./EventPageClient";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

type EventPageParams = { slug: string };
type EventPageParamsInput = EventPageParams | Promise<EventPageParams>;

export async function generateMetadata(
  { params }: { params: EventPageParamsInput },
): Promise<Metadata> {
  const resolved = await params;
  const slug = resolved?.slug;

  if (!slug) {
    return {
      title: "Evento | ORYA",
      description: "Explora eventos na ORYA.",
    };
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      locationName: true,
    },
  });

  if (!event) {
    return {
      title: "Evento não encontrado | ORYA",
      description: "Este evento já não está disponível.",
    };
  }

  const location = event.locationName || "ORYA";
  const baseTitle = event.title || "Evento ORYA";

  return {
    title: `${baseTitle} | ORYA`,
    description:
      event.description && event.description.trim().length > 0
        ? event.description
        : `Descobre o evento ${baseTitle} em ${location} na ORYA.`,
  };
}

type EventPageProps = {
  params: { slug?: string };
};

type EventResale = {
  id: string;
  ticketId: string;
  price: number;
  currency: string;
  seller?: {
    username: string | null;
    fullName: string | null;
  } | null;
  ticketTypeName?: string | null;
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

export default async function EventPage({ params }: { params: EventPageParamsInput }) {
  const { slug } = await params;

  if (!slug) {
    return notFound();
  }

  const now = new Date();

  type EventWithTickets = Prisma.EventGetPayload<{
    include: { ticketTypes: true };
  }>;

  type TicketTypeWithVisibility =
    EventWithTickets["ticketTypes"][number] & { isVisible?: boolean | null };

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user
    ? await prisma.profile.findUnique({ where: { id: user.id } })
    : null;
  const isAdmin = Array.isArray(profile?.roles) ? profile.roles.includes("admin") : false;

  const event = await prisma.event.findUnique({
    where: { slug },
    include: { ticketTypes: true },
  });
  if (!event) {
    notFound();
  }
  if (event.isTest && !isAdmin) {
    notFound();
  }

  // Buscar bilhetes ligados a este evento (para contagem de pessoas)
  const tickets = await prisma.ticket.findMany({
    where: { eventId: event.id },
  });

  const safeLocationName = event.locationName || "Local a anunciar";
  const safeTimezone = event.timezone || "Europe/Lisbon";
  const safeOrganizer = "ORYA";

  const goingCount = tickets.length;

  // Nota: no modelo atual, não determinamos o utilizador autenticado neste
  // Server Component para evitar erros de escrita de cookies.
  // A verificação de "já tens bilhete" pode ser feita no cliente.
  const userId: string | null = null;
  const currentUserHasTicket = false;

  const startDateObj = event.startsAt;
  const endDateObj = event.endsAt ?? event.startsAt;

  const dateFormatter = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: safeTimezone,
  });

  const timeFormatter = new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: safeTimezone,
  });

  const date = dateFormatter.format(startDateObj);
  const time = timeFormatter.format(startDateObj);
  const endTime = timeFormatter.format(endDateObj);

  const cover =
    event.coverImageUrl && event.coverImageUrl.trim().length > 0
      ? event.coverImageUrl
      : "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600";

  const nowDate = new Date();
  const eventEnded = endDateObj < nowDate;

  const ticketTypesWithVisibility = event.ticketTypes as TicketTypeWithVisibility[];

  const orderedTickets = ticketTypesWithVisibility
    .filter((t) => t.isVisible ?? true)
    .sort((a, b) => {
      const ao = a.sortOrder ?? 0;
      const bo = b.sortOrder ?? 0;
      if (ao !== bo) return ao - bo;
      return a.price - b.price;
    });

  const uiTickets: WaveTicket[] = orderedTickets.map((t, index) => {
    const rawStatus = String(t.status || "").toUpperCase();
    const remaining =
      t.totalQuantity === null || t.totalQuantity === undefined
        ? null
        : t.totalQuantity - t.soldQuantity;

    const statusFromEnum =
      rawStatus === "CLOSED" || rawStatus === "ENDED" || rawStatus === "OFF_SALE"
        ? "closed"
        : rawStatus === "SOLD_OUT"
          ? "sold_out"
          : rawStatus === "UPCOMING"
            ? "upcoming"
            : "on_sale";

    // Override: if remaining is 0, this wave é sold_out (mesmo com status)
    const finalStatus: WaveStatus =
      remaining !== null && remaining <= 0
        ? "sold_out"
        : statusFromEnum !== "on_sale"
          ? (statusFromEnum as WaveStatus)
          : getWaveStatus({
              startsAt: t.startsAt,
              endsAt: t.endsAt,
              totalQuantity: t.totalQuantity,
              soldQuantity: t.soldQuantity,
            });

    return {
      id: String(t.id),
      name: t.name?.trim() || `Wave ${index + 1}`,
      price: (t.price ?? 0) / 100,
      currency: t.currency,
      totalQuantity: t.totalQuantity,
      soldQuantity: t.soldQuantity,
      remaining,
      status: finalStatus as WaveStatus,
      startsAt: t.startsAt ? t.startsAt.toISOString() : null,
      endsAt: t.endsAt ? t.endsAt.toISOString() : null,
      available:
        finalStatus === "on_sale"
          ? remaining === null
            ? true
            : remaining > 0 && !eventEnded
          : false,
      isVisible: t.isVisible ?? true,
    };
  });

  const minTicketPrice =
    uiTickets.length > 0
      ? uiTickets.reduce(
          (min, t) => (t.price < min ? t.price : min),
          uiTickets[0].price,
        )
      : null;

  const displayPriceFrom = minTicketPrice;
  const anyOnSale = uiTickets.some((t) => t.status === "on_sale");
  const anyUpcoming = uiTickets.some((t) => t.status === "upcoming");
  const allClosed = uiTickets.length > 0 && uiTickets.every((t) => t.status === "closed");
  const allSoldOut = uiTickets.length > 0 && uiTickets.every((t) => t.status === "sold_out");

  // Carregar revendas deste evento via API F5-9
  let resales: EventResale[] = [];
  try {
    const headersList = await headers();
    const protocol = headersList.get("x-forwarded-proto") ?? "http";
    const host = headersList.get("host");

    if (host) {
      const baseUrl = `${protocol}://${host}`;
      const res = await fetch(
        `${baseUrl}/api/eventos/${encodeURIComponent(slug)}/resales`,
        { cache: "no-store" }
      );

      if (res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; resales?: EventResale[] }
          | null;

        if (data?.ok && Array.isArray(data.resales)) {
          resales = data.resales;
        }
      } else {
        console.error(
          "Falha ao carregar revendas para o evento",
          slug,
          res.status,
        );
      }
    }
  } catch (err) {
    console.error("Erro ao carregar revendas para o evento", slug, err);
  }

  const showPriceFrom = !event.isFree && minTicketPrice !== null;

  return (
    <CheckoutProvider>
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
        {/* fade tardio para preto para unir com o fundo */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.45) 82%, rgba(0,0,0,0.8) 92%, rgba(0,0,0,1) 100%)",
          }}
        />
      </div>

      {/* ========== HERO ============ */}
      <section className="relative z-10 w-full pt-24 pb-10 md:pt-28 md:pb-12">
        <div className="mx-auto mb-4 flex w-full max-w-6xl items-center px-4 md:px-8">
          <Link
            href="/explorar"
            className="inline-flex items-center gap-2 text-xs font-medium text-white/75 transition hover:text-white"
          >
            <span className="text-lg leading-none">←</span>
            <span>Voltar a explorar</span>
          </Link>
        </div>
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

              {/* badge "Já tens bilhete" */}
              {currentUserHasTicket && (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/70 bg-emerald-500/18 px-3 py-1 text-xs text-emerald-100">
                  <span className="text-sm">🎟️</span>
                  <span>Já tens bilhete para este evento</span>
                </div>
              )}

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
              ) : allSoldOut ? (
                <div className="rounded-xl border border-orange-400/40 bg-orange-500/15 px-3.5 py-2.5 text-sm text-orange-100">
                  <div>
                    <p className="font-semibold">Evento esgotado</p>
                    <p className="text-[11px] text-orange-100/85">
                      Não há mais bilhetes disponíveis para este evento.
                    </p>
                  </div>
                </div>
              ) : !anyOnSale && anyUpcoming ? (
                <div className="rounded-xl border border-yellow-400/40 bg-yellow-500/15 px-3.5 py-2.5 text-sm text-yellow-100">
                  <div>
                    <p className="font-semibold">Vendas ainda não abriram</p>
                    <p className="text-[11px] text-yellow-100/85">
                      As vendas de bilhetes para este evento ainda não abriram. Volta mais tarde!
                    </p>
                  </div>
                </div>
              ) : allClosed ? (
                <div className="rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white/80">
                  <div>
                    <p className="font-semibold">Vendas encerradas</p>
                    <p className="text-[11px] text-white/70">
                      As vendas para este evento já encerraram.
                    </p>
                  </div>
                </div>
              ) : (
                <WavesSectionClient
                  slug={event.slug}
                  tickets={uiTickets}
                  isFreeEvent={event.isFree}
                />
              )}

              {resales.length > 0 && (
                <div className="mt-6 border-t border-white/15 pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">
                      Bilhetes entre utilizadores
                    </h3>
                    <span className="text-xs text-white/70">
                      {resales.length} oferta
                      {resales.length === 1 ? "" : "s"} de revenda
                    </span>
                  </div>

                  <p className="text-xs text-white/65">
                    Estes bilhetes são vendidos por outros utilizadores da ORYA.
                    O pagamento é feito de forma segura através da plataforma.
                  </p>

                  <div className="space-y-3">
                    {resales.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {r.ticketTypeName ?? "Bilhete ORYA"}
                            </span>
                            {r.seller && (
                              <span className="text-xs text-white/60">
                                por{" "}
                                {r.seller.username
                                  ? `@${r.seller.username}`
                                  : r.seller.fullName ?? "utilizador ORYA"}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-white/65">
                            Preço pedido:{" "}
                            <span className="font-semibold text-white">
                              {(r.price / 100).toFixed(2)} €
                            </span>
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 text-xs font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.65)] opacity-70 cursor-not-allowed"
                        >
                          Comprar em breve
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
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
      <EventPageClient
        event={event}
        uiTickets={uiTickets}
        cover={cover}
        currentUserId={userId}
      />
      </main>
    </CheckoutProvider>
  );
}
export const dynamic = "force-dynamic";
export const revalidate = 0;
