// app/eventos/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { CheckoutProvider } from "@/app/components/checkout/contextoCheckout";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import WavesSectionClient, { type WaveTicket, type WaveStatus } from "./WavesSectionClient";
import Link from "next/link";
import EventPageClient from "./EventPageClient";
import EventLiveClient from "./EventLiveClient";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Image from "next/image";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";
import type { CSSProperties } from "react";
import EventBackgroundTuner from "./EventBackgroundTuner";

type EventPageParams = { slug: string };
type EventPageParamsInput = EventPageParams | Promise<EventPageParams>;
type EventPageSearchParams = Record<string, string | string[] | undefined>;
type EventPageSearchParamsInput = EventPageSearchParams | Promise<EventPageSearchParams>;

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

const UPDATE_CATEGORY_LABELS: Record<string, string> = {
  TODAY: "Hoje",
  CHANGES: "Alterações",
  RESULTS: "Resultados",
  CALL_UPS: "Convocatórias",
};

const EVENT_BG_MASK = `linear-gradient(
  to bottom,
  rgba(0,0,0,var(--event-bg-mask-alpha-1,1)) var(--event-bg-mask-stop-1,0%),
  rgba(0,0,0,var(--event-bg-mask-alpha-2,0.98)) var(--event-bg-mask-stop-2,24%),
  rgba(0,0,0,var(--event-bg-mask-alpha-3,0.82)) var(--event-bg-mask-stop-3,46%),
  rgba(0,0,0,var(--event-bg-mask-alpha-4,0.5)) var(--event-bg-mask-stop-4,68%),
  rgba(0,0,0,var(--event-bg-mask-alpha-5,0.2)) var(--event-bg-mask-stop-5,86%),
  rgba(0,0,0,var(--event-bg-mask-alpha-6,0)) var(--event-bg-mask-stop-6,100%)
)`;

const EVENT_BG_OVERLAY = `linear-gradient(
  to bottom,
  rgba(0,0,0,var(--event-bg-overlay-top,0.38)) 0%,
  rgba(0,0,0,var(--event-bg-overlay-mid,0.22)) 45%,
  rgba(0,0,0,var(--event-bg-overlay-bottom,0.06)) 100%
)`;

const EVENT_BG_FADE = `linear-gradient(
  to bottom,
  rgba(0,0,0,0) 0%,
  rgba(0,0,0,0) var(--event-bg-fade-start,78%),
  rgba(0,0,0,var(--event-bg-fade-dark,0.78)) var(--event-bg-fade-mid,90%),
  rgba(0,0,0,1) var(--event-bg-fade-end,99%)
)`;

function initialsFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "OR";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

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

export default async function EventPage({
  params,
  searchParams,
}: {
  params: EventPageParamsInput;
  searchParams?: EventPageSearchParamsInput;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams);

  if (!slug) {
    return notFound();
  }

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
    include: {
      ticketTypes: true,
      padelTournamentConfig: true,
      organizer: {
        select: {
          username: true,
          publicName: true,
          businessName: true,
          brandingAvatarUrl: true,
          publicListingEnabled: true,
          status: true,
        },
      },
    },
  });
  if (!event) {
    notFound();
  }
  if (event.isTest && !isAdmin) {
    notFound();
  }
  const isPadel = event.templateType === "PADEL";
  const checkoutVariant =
    isPadel && event.padelTournamentConfig?.padelV2Enabled ? "PADEL" : "DEFAULT";
  const padelSnapshot = isPadel ? await buildPadelEventSnapshot(event.id) : null;
  const viewParam =
    typeof resolvedSearchParams?.view === "string" ? resolvedSearchParams.view : null;
  const showLiveInline = viewParam === "live";
  const liveHref = `/eventos/${slug}/live`;
  const liveInlineHref = `/eventos/${slug}?view=live`;

  // Buscar bilhetes ligados a este evento (para contagem de pessoas)
  const safeLocationName = event.locationName || "Local a anunciar";
  const safeTimezone = event.timezone || "Europe/Lisbon";
  const organizerDisplay =
    event.organizer?.publicName ||
    event.organizer?.businessName ||
    null;
  const organizerUsername =
    event.organizer?.publicListingEnabled !== false && event.organizer?.status === "ACTIVE"
      ? event.organizer?.username ?? null
      : null;
  const safeOrganizer = organizerDisplay || "Organização ORYA";
  const organizerAvatarUrl = event.organizer?.brandingAvatarUrl?.trim() || null;
  const organizerInitials = initialsFromName(safeOrganizer);
  const organizerHandle = organizerUsername ? `@${organizerUsername}` : null;

  const eventUpdates = await prisma.organizationUpdate.findMany({
    where: { eventId: event.id, status: "PUBLISHED" },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    take: 5,
  });

  const updateDateFormatter = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: safeTimezone,
  });

  const formattedUpdates = eventUpdates.map((update) => {
    const date = update.publishedAt ?? update.createdAt;
    return {
      ...update,
      dateLabel: date ? updateDateFormatter.format(date) : "A definir",
      categoryLabel: UPDATE_CATEGORY_LABELS[update.category] ?? update.category,
    };
  });

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
  const formattedDate = date.charAt(0).toUpperCase() + date.slice(1);
  const descriptionText =
    event.description && event.description.trim().length > 0
      ? event.description.trim()
      : "A descrição deste evento será atualizada em breve.";

  const rawCover =
    event.coverImageUrl && event.coverImageUrl.trim().length > 0
      ? event.coverImageUrl
      : "/images/placeholder-event.jpg";
  const cover = optimizeImageUrl(rawCover, 1200, 72, "webp");
  // versão ultra-leve apenas para o blur de fundo (mantém o efeito mas evita puxar MBs)
  const blurredCover = optimizeImageUrl(rawCover, 120, 20, "webp");

  const nowDate = new Date();
  const eventEnded = endDateObj < nowDate;
  const eventStarted = startDateObj <= nowDate && endDateObj >= nowDate;
  const eventUpcoming = startDateObj > nowDate;
  const phaseIndex = eventEnded ? 2 : eventStarted ? 1 : 0;
  const timelineSteps = [
    {
      key: "before",
      label: "Antes",
      hint: eventUpcoming ? "Inscrições abertas" : "Concluído",
    },
    {
      key: "during",
      label: "Durante",
      hint: eventStarted ? "A decorrer agora" : eventEnded ? "Concluído" : "Em breve",
    },
    {
      key: "after",
      label: "Depois",
      hint: eventEnded ? "Histórico disponível" : "Em breve",
    },
  ].map((step, idx) => ({
    ...step,
    state: idx < phaseIndex ? "done" : idx === phaseIndex ? "active" : "pending",
  }));

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
  const availabilityLabel = eventEnded
    ? "Evento terminado"
    : allSoldOut
      ? "Esgotado"
      : anyOnSale
        ? "Bilhetes à venda"
        : anyUpcoming
          ? "Vendas em breve"
          : allClosed
            ? "Vendas encerradas"
            : "Bilhetes";
  const availabilityTone = eventEnded || allClosed
    ? "border-white/25 bg-white/10 text-white/70"
    : allSoldOut
      ? "border-orange-400/40 bg-orange-500/15 text-orange-100"
      : anyOnSale
        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
        : "border-yellow-400/40 bg-yellow-500/15 text-yellow-100";

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

  const padelV2Enabled = Boolean(event.padelTournamentConfig?.padelV2Enabled);
  const defaultPadelTicketId = (() => {
    const eligible = orderedTickets.filter((t) => {
      const remaining =
        t.totalQuantity === null || t.totalQuantity === undefined
          ? null
          : t.totalQuantity - t.soldQuantity;
      const onSale = String(t.status || "").toUpperCase() === "ON_SALE";
      const hasStock = remaining === null ? true : remaining > 0;
      return onSale && hasStock;
    });
    if (!eligible.length) return null;
    const cheapest = eligible.reduce((min, cur) => (cur.price < min.price ? cur : min), eligible[0]);
    return cheapest.id ?? null;
  })();

  const backgroundDefaults = {
    blur: 56,
    scale: 1.28,
    saturate: 1.28,
    brightness: 1.06,
    maskStops: [0, 24, 46, 68, 86, 100] as [number, number, number, number, number, number],
    maskAlphas: [1, 0.98, 0.82, 0.5, 0.2, 0] as [number, number, number, number, number, number],
    overlayTop: 0.38,
    overlayMid: 0.22,
    overlayBottom: 0.06,
    fadeStart: 78,
    fadeMid: 90,
    fadeEnd: 99,
    fadeDark: 0.78,
  };

  const backgroundVars = {
    "--event-bg-blur": `${backgroundDefaults.blur}px`,
    "--event-bg-scale": `${backgroundDefaults.scale}`,
    "--event-bg-saturate": `${backgroundDefaults.saturate}`,
    "--event-bg-brightness": `${backgroundDefaults.brightness}`,
    "--event-bg-mask-stop-1": `${backgroundDefaults.maskStops[0]}%`,
    "--event-bg-mask-stop-2": `${backgroundDefaults.maskStops[1]}%`,
    "--event-bg-mask-stop-3": `${backgroundDefaults.maskStops[2]}%`,
    "--event-bg-mask-stop-4": `${backgroundDefaults.maskStops[3]}%`,
    "--event-bg-mask-stop-5": `${backgroundDefaults.maskStops[4]}%`,
    "--event-bg-mask-stop-6": `${backgroundDefaults.maskStops[5]}%`,
    "--event-bg-mask-alpha-1": `${backgroundDefaults.maskAlphas[0]}`,
    "--event-bg-mask-alpha-2": `${backgroundDefaults.maskAlphas[1]}`,
    "--event-bg-mask-alpha-3": `${backgroundDefaults.maskAlphas[2]}`,
    "--event-bg-mask-alpha-4": `${backgroundDefaults.maskAlphas[3]}`,
    "--event-bg-mask-alpha-5": `${backgroundDefaults.maskAlphas[4]}`,
    "--event-bg-mask-alpha-6": `${backgroundDefaults.maskAlphas[5]}`,
    "--event-bg-overlay-top": `${backgroundDefaults.overlayTop}`,
    "--event-bg-overlay-mid": `${backgroundDefaults.overlayMid}`,
    "--event-bg-overlay-bottom": `${backgroundDefaults.overlayBottom}`,
    "--event-bg-fade-start": `${backgroundDefaults.fadeStart}%`,
    "--event-bg-fade-mid": `${backgroundDefaults.fadeMid}%`,
    "--event-bg-fade-end": `${backgroundDefaults.fadeEnd}%`,
    "--event-bg-fade-dark": `${backgroundDefaults.fadeDark}`,
  } as CSSProperties;

  return (
    <main
      id="event-page"
      className="relative orya-body-bg min-h-screen w-full overflow-hidden text-white"
      style={backgroundVars}
    >
      <CheckoutProvider>
        <EventBackgroundTuner targetId="event-page" defaults={backgroundDefaults} />
        {/* BG: blur da capa a cobrir o topo da página com transição super suave para o fundo ORYA */}
        <div
          className="pointer-events-none fixed inset-0 overflow-hidden"
          aria-hidden="true"
        >
          {/* camada principal: cover blur com máscara para fazer o fade vertical muito suave */}
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `url(${blurredCover})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter:
                "blur(var(--event-bg-blur, 56px)) saturate(var(--event-bg-saturate, 1.28)) brightness(var(--event-bg-brightness, 1.06))",
              WebkitFilter:
                "blur(var(--event-bg-blur, 56px)) saturate(var(--event-bg-saturate, 1.28)) brightness(var(--event-bg-brightness, 1.06))",
              transform: "scale(var(--event-bg-scale, 1.28))",
              WebkitTransform: "scale(var(--event-bg-scale, 1.28))",
              WebkitMaskImage: EVENT_BG_MASK,
              maskImage: EVENT_BG_MASK,
            }}
          />
          {/* overlay extra para garantir legibilidade no topo da hero e uma transição ainda mais orgânica */}
          <div className="absolute inset-0" style={{ background: EVENT_BG_OVERLAY }} />
          {/* fade tardio para preto para unir com o fundo */}
          <div
            className="absolute inset-0"
            style={{
              background: EVENT_BG_FADE,
            }}
          />
        </div>

        {/* camada de cor extra para vidro premium */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-36 right-[-140px] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgba(255,0,200,0.35),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute top-[26vh] -left-40 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(107,255,255,0.3),transparent_60%)] opacity-80 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_35%,rgba(0,0,0,0.6))] mix-blend-screen" />
        </div>

        {/* ========== HERO ============ */}
        <section className="relative z-10 w-full pb-16 pt-20 md:pb-20 md:pt-28">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 md:px-8">
            <Link
              href="/explorar"
              className="inline-flex items-center gap-2 text-xs font-medium text-white/75 transition hover:text-white"
            >
              <span className="text-lg leading-none">←</span>
              <span>Voltar a explorar</span>
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70 sm:flex">
              <span>Evento ORYA</span>
              <span className="h-1 w-1 rounded-full bg-white/40" />
              {organizerUsername ? (
                <Link href={`/${organizerUsername}`} className="text-white/80 hover:text-white">
                  {safeOrganizer}
                </Link>
              ) : (
                <span>{safeOrganizer}</span>
              )}
            </div>
          </div>

          <div className="mx-auto mt-6 grid w-full max-w-6xl grid-cols-1 gap-6 px-4 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-[1px] rounded-[32px] bg-[linear-gradient(135deg,rgba(255,0,200,0.35),rgba(107,255,255,0.35),rgba(22,70,245,0.35))] opacity-70 blur-[2px]" />
              <div className="relative rounded-[30px] border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.16),rgba(2,6,16,0.78))] p-6 shadow-[0_28px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl md:p-8 animate-fade-slide">
                <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.18),transparent_55%)] opacity-80" />
                <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.35))] opacity-70" />
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/60">
                    <span>{safeLocationName}</span>
                    <span className="h-1 w-1 rounded-full bg-white/30" />
                    <span>{event.locationCity || "Cidade a anunciar"}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-white/85">
                    <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${availabilityTone}`}>
                      {availabilityLabel}
                    </span>
                    {event.isFree ? (
                      <span className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-100">
                        Entrada gratuita
                      </span>
                    ) : showPriceFrom ? (
                      <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-100">
                        Desde {(displayPriceFrom ?? 0).toFixed(2)} €
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/75">
                        Preço a anunciar
                      </span>
                    )}
                  </div>

                  <h1 className="mt-4 bg-gradient-to-r from-[#FF72D0] via-[#6BFFFF] to-[#5B7CFF] bg-clip-text text-4xl font-extrabold leading-tight text-transparent md:text-5xl lg:text-6xl">
                    {event.title}
                  </h1>

                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                      Organizado por
                    </p>
                    {organizerUsername ? (
                      <Link
                        href={`/${organizerUsername}`}
                        className="mt-2 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 transition hover:border-white/20 hover:bg-white/10"
                      >
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/40 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                          {organizerAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={organizerAvatarUrl}
                              alt={safeOrganizer}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            organizerInitials
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{safeOrganizer}</span>
                            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/65">
                              Organização
                            </span>
                          </div>
                          {organizerHandle && (
                            <span className="text-xs text-white/60">{organizerHandle}</span>
                          )}
                        </div>
                      </Link>
                    ) : (
                      <div className="mt-2 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-black/40 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                          {organizerAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={organizerAvatarUrl}
                              alt={safeOrganizer}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            organizerInitials
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{safeOrganizer}</span>
                            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/65">
                              Organização
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {currentUserHasTicket && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1 text-xs text-emerald-100">
                      <span className="text-sm">🎟️</span>
                      <span>Já tens bilhete para este evento</span>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    {!eventEnded && (
                      <a
                        href="#bilhetes"
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-transform hover:scale-105 active:scale-95 md:text-sm"
                      >
                        {event.isFree ? "Garantir lugar" : "Ver bilhetes"}
                        <span className="text-xs">↓</span>
                      </a>
                    )}
                    <a
                      href="#resumo"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs text-white/80 transition hover:border-white/30 hover:bg-white/10 md:text-sm"
                    >
                      Ver resumo
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute -inset-[1px] rounded-[34px] bg-[conic-gradient(from_120deg,rgba(107,255,255,0.5),rgba(255,0,200,0.4),rgba(22,70,245,0.5),rgba(107,255,255,0.5))] opacity-60 blur-[2px]" />
              <div className="relative h-full min-h-[260px] overflow-hidden rounded-[32px] border border-white/15 bg-white/5 shadow-[0_28px_70px_rgba(0,0,0,0.85)]">
                <Image
                  src={cover}
                  alt={`Capa do evento ${event.title}`}
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(max-width: 768px) 90vw, (max-width: 1200px) 40vw, 480px"
                  className="object-cover"
                  placeholder="blur"
                  blurDataURL={defaultBlurDataURL}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
              </div>
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-6xl px-4 md:px-8">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                  Data &amp; hora
                </p>
                <p className="mt-2 text-sm font-semibold text-white/90">
                  {formattedDate}
                </p>
                <p className="text-xs text-white/60">
                  {time} – {endTime}
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                  Local
                </p>
                <p className="mt-2 text-sm font-semibold text-white/90">
                  {safeLocationName}
                </p>
                <p className="text-xs text-white/60">
                  {event.locationCity || "Cidade a anunciar"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                  Preço
                </p>
                <p className="mt-2 text-sm font-semibold text-white/90">
                  {event.isFree
                    ? "Entrada gratuita"
                    : showPriceFrom
                      ? `${(displayPriceFrom ?? 0).toFixed(2)} €`
                      : "A anunciar"}
                </p>
                <p className="text-xs text-white/60">
                  {event.isFree
                    ? "Reserva o teu lugar agora."
                    : "Taxas incluídas no checkout."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div
          className="pointer-events-none relative z-10 mx-auto max-w-6xl px-6 md:px-10"
          aria-hidden="true"
        >
          <div className="relative my-8 md:my-10">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/18 to-transparent" />
            <div className="absolute inset-0 blur-2xl">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-[#6BFFFF]/25 to-transparent" />
            </div>
          </div>
        </div>

        {/* ========== CONTENT AREA ============ */}
        <section className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 pb-28 pt-10 md:grid-cols-3 md:px-10">
          {/* LEFT SIDE — Info + Descrição */}
          <div className="space-y-12 md:col-span-2">
            <section
              id="resumo"
              className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8 animate-fade-slide"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
                <span>O que precisas de saber</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>Informação essencial</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold">Resumo do evento</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/80 md:text-base">
                {descriptionText}
              </p>
            </section>

            <section className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
                <span>O que acontece agora</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>{eventUpcoming ? "Antes" : eventStarted ? "Durante" : "Depois"}</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold">Antes · Durante · Depois</h3>
              <p className="mt-2 text-xs text-white/60">
                Mantém-te atualizado pela página do evento. Esta linha do tempo mostra o estado atual.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {timelineSteps.map((step) => (
                  <div
                    key={step.key}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      step.state === "done"
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50"
                        : step.state === "active"
                          ? "border-[#6BFFFF]/60 bg-[#0b1224] text-white"
                          : "border-white/15 bg-white/5 text-white/70"
                    }`}
                  >
                    <p className="font-semibold">{step.label}</p>
                    <p className="text-[12px] opacity-80">{step.hint}</p>
                  </div>
                ))}
              </div>
            </section>

            {isPadel && (
              <section className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8" id="live">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
                      <span>Live</span>
                      <span className="h-1 w-1 rounded-full bg-white/30" />
                      <span>Jogos e resultados</span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold">Acompanhamento ao vivo</h3>
                    <p className="mt-2 text-xs text-white/60">
                      Acompanha jogos, brackets e ranking em tempo real.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={liveHref}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10"
                    >
                      Abrir live
                    </Link>
                    <Link
                      href={liveInlineHref}
                      className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10"
                    >
                      Ver aqui
                    </Link>
                  </div>
                </div>

                {showLiveInline ? (
                  <div className="mt-4">
                    <EventLiveClient slug={slug} />
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white/70">
                    Abre o modo live para veres resultados e jogos atualizados.
                  </div>
                )}
              </section>
            )}

            <section className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:p-8">
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
                <span>Canal oficial</span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span>Atualizações da organização</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold">Comunicados rápidos</h3>
              <p className="mt-2 text-xs text-white/60">
                Alterações e informações importantes aparecem aqui primeiro.
              </p>

              {formattedUpdates.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white/70">
                  Sem atualizações oficiais para já.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {formattedUpdates.map((update) => (
                    <div
                      key={update.id}
                      className="rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white/80"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                            {update.categoryLabel}
                            {update.isPinned ? " · Fixado" : ""}
                          </p>
                          <h4 className="text-base font-semibold text-white">{update.title}</h4>
                        </div>
                        <span className="text-[11px] text-white/55">{update.dateLabel}</span>
                      </div>
                      {update.body && (
                        <p className="mt-2 text-[12px] text-white/70 whitespace-pre-line">
                          {update.body}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT SIDE — CARD DE INFORMAÇÕES / TICKETS */}
          <aside className="space-y-8 md:sticky md:top-28 md:self-start">
            <div className="relative">
              <div className="pointer-events-none absolute -inset-[1px] rounded-[32px] bg-[linear-gradient(135deg,rgba(255,0,200,0.35),rgba(107,255,255,0.35),rgba(22,70,245,0.35))] opacity-60 blur-[2px]" />
              <div className="relative rounded-[30px] border border-white/15 bg-[linear-gradient(140deg,rgba(255,255,255,0.16),rgba(2,6,16,0.78))] p-7 shadow-[0_28px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
                <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_18%_20%,rgba(255,255,255,0.18),transparent_55%)] opacity-80" />
                <div className="pointer-events-none absolute inset-0 rounded-[30px] bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.35))] opacity-70" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">Bilhetes</h3>
                      <p className="text-xs text-white/60">
                        Compra segura com confirmação imediata.
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${availabilityTone}`}
                    >
                      {availabilityLabel}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-1">
                    <div className="rounded-xl border border-white/15 bg-black/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                        Data
                      </p>
                      <p className="mt-1 text-sm text-white/85">
                        {formattedDate}
                      </p>
                      <p className="text-xs text-white/60">
                        {time} – {endTime}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/15 bg-black/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                        Local
                      </p>
                      <p className="mt-1 text-sm text-white/85">
                        {safeLocationName}
                      </p>
                      <p className="text-xs text-white/60">
                        {event.address || "Morada a anunciar"}
                      </p>
                    </div>
                  </div>

                  <div id="bilhetes" className="mt-4 scroll-mt-28">
                    {!eventEnded ? (
                      <div className="space-y-5 border-t border-white/12 pt-5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-semibold">
                            Seleciona o teu bilhete
                          </h3>
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
                            checkoutUiVariant={checkoutVariant}
                            padelMeta={
                              checkoutVariant === "PADEL"
                                ? {
                                    eventId: event.id,
                                    organizerId: event.organizerId ?? null,
                                    categoryId:
                                      event.padelTournamentConfig?.defaultCategoryId ?? null,
                                  }
                                : undefined
                            }
                          />
                        )}

                        {resales.length > 0 && (
                          <div className="mt-7 space-y-4 border-t border-white/15 pt-5">
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

                            <div className="space-y-4">
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

                                  <Link
                                    href={`/resale/${r.id}`}
                                    className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] px-3 py-1.5 text-xs font-semibold text-black shadow-[0_0_18px_rgba(107,255,255,0.65)] hover:scale-[1.01] active:scale-95 transition-transform"
                                  >
                                    Comprar agora
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white/85">
                        Este evento já terminou. Bilhetes e inscrições deixaram de estar
                        disponíveis.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {padelSnapshot && (
              <div className="rounded-3xl border border-white/15 bg-white/5 p-6 shadow-[0_24px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
                      PADEL
                    </p>
                    <h3 className="text-base font-semibold">Competição em detalhe</h3>
                    <p className="text-[12px] text-white/65">
                      {padelSnapshot.clubName || "Clube a anunciar"} ·{" "}
                      {padelSnapshot.clubCity || "Cidade em breve"}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[11px] text-white/75">
                    Estado: {padelSnapshot.status}
                  </span>
                </div>
                {padelSnapshot.timeline && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {padelSnapshot.timeline.map((step) => (
                      <div
                        key={step.key}
                        className={`rounded-lg border px-3 py-2 text-sm ${
                          step.state === "done"
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-50"
                            : step.state === "active"
                              ? "border-[#6BFFFF]/60 bg-[#0b1224] text-white"
                              : "border-white/15 bg-white/5 text-white/70"
                        }`}
                      >
                        <p className="font-semibold">{step.label}</p>
                        <p className="text-[12px] opacity-80">
                          {step.cancelled
                            ? "Cancelado"
                            : step.date
                              ? dateFormatter.format(new Date(step.date))
                              : "Data a anunciar"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 grid gap-3 text-[13px] md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                      Clubes
                    </p>
                    <p className="text-white/80">
                      Principal:{" "}
                      <span className="font-semibold text-white">
                        {padelSnapshot.clubName || "A anunciar"}
                      </span>
                    </p>
                    <p className="text-white/70">
                      Parceiros:{" "}
                      {padelSnapshot.partnerClubs && padelSnapshot.partnerClubs.length > 0
                        ? padelSnapshot.partnerClubs
                            .map((c) => c.name || `Clube ${c.id}`)
                            .join(" · ")
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                      Courts
                    </p>
                    {padelSnapshot.courts && padelSnapshot.courts.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {padelSnapshot.courts.map((c, idx) => (
                          <span
                            key={`${c.name}-${idx}`}
                            className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[12px]"
                          >
                            {c.name} {c.clubName ? `· ${c.clubName}` : ""}{" "}
                            {c.indoor ? "· Indoor" : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-white/70">Courts a definir.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </aside>
        </section>

        <EventPageClient
          slug={event.slug}
          uiTickets={uiTickets}
          checkoutUiVariant={checkoutVariant === "PADEL" ? "PADEL" : "DEFAULT"}
          padelMeta={
            checkoutVariant === "PADEL"
              ? {
                  eventId: event.id,
                  organizerId: event.organizerId ?? null,
                  categoryId: event.padelTournamentConfig?.defaultCategoryId ?? null,
                }
              : undefined
          }
          defaultPadelTicketId={defaultPadelTicketId}
        />
      </CheckoutProvider>
    </main>
  );
}
export const dynamic = "force-dynamic";
export const revalidate = 0;
