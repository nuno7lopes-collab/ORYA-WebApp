// app/eventos/[slug]/page.tsx
import { prisma } from "@/lib/prisma";
import { CheckoutProvider } from "@/app/components/checkout/contextoCheckout";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import WavesSectionClient, { type WaveTicket, type WaveStatus } from "./WavesSectionClient";
import Link from "next/link";
import EventPageClient from "./EventPageClient";
import EventLiveClient from "./EventLiveClient";
import PadelPublicTablesClient from "./PadelPublicTablesClient";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Image from "next/image";
import { defaultBlurDataURL, optimizeImageUrl } from "@/lib/image";
import { getEventCoverSuggestionIds, getEventCoverUrl } from "@/lib/eventCover";
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";
import { checkPadelRegistrationWindow } from "@/domain/padelRegistration";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import type { CSSProperties } from "react";
import EventBackgroundTuner from "./EventBackgroundTuner";
import { normalizeEmail } from "@/lib/utils/email";
import { sanitizeUsername } from "@/lib/username";
import InviteGateClient from "./InviteGateClient";
import { Avatar } from "@/components/ui/avatar";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";
import { getTicketCopy } from "@/app/components/checkout/checkoutCopy";
import { resolveEventLocation } from "@/lib/location/eventLocation";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { EventAccessMode } from "@prisma/client";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";

type EventPageParams = { slug: string };
type EventPageParamsInput = EventPageParams | Promise<EventPageParams>;
type EventPageSearchParams = Record<string, string | string[] | undefined>;
type EventPageSearchParamsInput = EventPageSearchParams | Promise<EventPageSearchParams>;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

  let event = await prisma.event.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      locationName: true,
      organizationId: true,
      coverImageUrl: true,
    },
  });
  if (!event) {
    const normalized = slugify(slug);
    if (normalized && normalized !== slug) {
      event = await prisma.event.findUnique({
        where: { slug: normalized },
        select: {
          title: true,
          description: true,
          locationName: true,
          organizationId: true,
          coverImageUrl: true,
        },
      });
    }
  }

  if (!event || !event.organizationId) {
    return {
      title: "Evento não encontrado | ORYA",
      description: "Este evento já não está disponível.",
    };
  }

  const location = event.locationName || "ORYA";
    const baseTitle = event.title || "Evento ORYA";
    const baseUrl = getAppBaseUrl();
    const canonicalUrl = `${baseUrl}/eventos/${slug}`;
    const coverUrl = event.coverImageUrl
      ? event.coverImageUrl.startsWith("http")
        ? event.coverImageUrl
        : `${baseUrl}${event.coverImageUrl.startsWith("/") ? "" : "/"}${event.coverImageUrl}`
      : null;

  const description =
    event.description && event.description.trim().length > 0
      ? event.description
      : `Descobre o evento ${baseTitle} em ${location} na ORYA.`;

  return {
    metadataBase: new URL(baseUrl),
    alternates: { canonical: canonicalUrl },
    title: `${baseTitle} | ORYA`,
    description,
    openGraph: {
      title: `${baseTitle} | ORYA`,
      description,
      url: canonicalUrl,
      type: "website",
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
    twitter: {
      card: coverUrl ? "summary_large_image" : "summary",
      title: `${baseTitle} | ORYA`,
      description,
      images: coverUrl ? [coverUrl] : undefined,
    },
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
type PadelStandingRow = {
  pairingId: number;
  points: number;
  wins: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
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
    include: {
      ticketTypes: {
        include: {
          padelEventCategoryLink: {
            include: { category: { select: { label: true } } };
          };
        };
      };
      padelCategoryLinks: {
        include: { category: { select: { label: true } } };
      };
    };
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
      ticketTypes: {
        include: {
          padelEventCategoryLink: {
            include: { category: { select: { label: true } } },
          },
        },
      },
      padelCategoryLinks: {
        include: { category: { select: { label: true } } },
      },
      padelTournamentConfig: true,
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: { mode: true },
      },
      organization: {
        select: {
          username: true,
          publicName: true,
          businessName: true,
          brandingAvatarUrl: true,
          status: true,
        },
      },
    },
  });
  if (!event || !event.organizationId) {
    const normalized = slugify(slug);
    if (normalized && normalized !== slug) {
      const fallback = await prisma.event.findUnique({
        where: { slug: normalized },
        include: {
          ticketTypes: {
            include: {
              padelEventCategoryLink: {
                include: { category: { select: { label: true } } },
              },
            },
          },
          padelCategoryLinks: {
            include: { category: { select: { label: true } } },
          },
          padelTournamentConfig: true,
          accessPolicies: {
            orderBy: { policyVersion: "desc" },
            take: 1,
            select: { mode: true },
          },
          organization: {
            select: {
              username: true,
              publicName: true,
              businessName: true,
              brandingAvatarUrl: true,
              status: true,
            },
          },
        },
      });
      if (fallback && fallback.organizationId) {
        redirect(`/eventos/${fallback.slug}`);
      }
    }
    notFound();
  }
  const isGratis = deriveIsFreeEvent({
    pricingMode: event.pricingMode ?? undefined,
    ticketPrices: event.ticketTypes.map((t) => t.price ?? 0),
  });
  const ticketTypesWithVisibility = event.ticketTypes as TicketTypeWithVisibility[];
  const visibleTicketTypes = ticketTypesWithVisibility.filter((t) => t.isVisible ?? true);
  const accessPolicy = event.accessPolicies?.[0] ?? null;
  const accessMode = resolveEventAccessMode(accessPolicy);
  const isInviteRestricted = accessMode === EventAccessMode.INVITE_ONLY;
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status);
  const userEmailNormalized = user ? normalizeEmail(user.email ?? null) : null;
  const usernameNormalized = profile?.username ? sanitizeUsername(profile.username) : null;
  const hasUsername = Boolean(usernameNormalized);
  const needsInviteCheck = isInviteRestricted;
  let isInvited = !needsInviteCheck;
  if (needsInviteCheck && !isAdmin && user) {
    const identifiers: string[] = [];
    if (userEmailNormalized) identifiers.push(userEmailNormalized);
    if (usernameNormalized) identifiers.push(usernameNormalized);
    if (identifiers.length > 0) {
      const invite = await prisma.eventInvite.findFirst({
        where: { eventId: event.id, targetIdentifier: { in: identifiers }, scope: "PUBLIC" },
        select: { id: true },
      });
      if (invite) {
        isInvited = true;
      }
    }
  } else if (needsInviteCheck && isAdmin) {
    isInvited = true;
  }
  const showInviteGate = isInviteRestricted && !isInvited;
  const canFreeCheckout = Boolean(user) && hasUsername && (!isInviteRestricted || isInvited);
  const allowCheckoutBase = !showInviteGate && (isGratis ? canFreeCheckout : true);
  const isPadel = event.templateType === "PADEL";
  const ticketCopy = getTicketCopy(isPadel ? "PADEL" : "DEFAULT");
  const ticketSectionLabel = ticketCopy.pluralCap;
  const freeBadgeLabel = ticketCopy.freeLabel;
  const ctaFreeLabel = ticketCopy.isPadel ? ticketCopy.buyLabel : "Garantir lugar";
  const ctaPaidLabel = ticketCopy.viewLabel;
  const hasTicketLabel = `Já tens ${ticketCopy.articleSingular} ${ticketCopy.singular} para este ${
    isPadel ? "torneio" : "evento"
  }`;
  const ticketSelectLabel = ticketCopy.isPadel ? "Seleciona a tua inscrição" : "Seleciona o teu bilhete";
  const freeInfoDescription = ticketCopy.isPadel
    ? "Basta garantir a tua inscrição — não há custo."
    : "Basta garantir o teu lugar — não há custo de bilhete.";
  const freeGateTitle = ticketCopy.freeLabel;
  const salesNotOpenTitle = ticketCopy.isPadel ? "Inscrições ainda não abriram" : "Vendas ainda não abriram";
  const salesNotOpenDescription = ticketCopy.isPadel
    ? "As inscrições para este torneio ainda não abriram. Volta mais tarde!"
    : "As vendas de bilhetes para este evento ainda não abriram. Volta mais tarde!";
  const salesClosedTitle = ticketCopy.isPadel ? "Inscrições encerradas" : "Vendas encerradas";
  const salesClosedDescription = ticketCopy.isPadel
    ? "As inscrições para este torneio já encerraram."
    : "As vendas para este evento já encerraram.";
  const soldOutDescription = `Não há mais ${ticketCopy.plural} disponíveis para este ${
    isPadel ? "torneio" : "evento"
  }.`;
  const resalesTitle = ticketCopy.isPadel ? "Inscrições entre utilizadores" : "Bilhetes entre utilizadores";
  const resalesDescription = ticketCopy.isPadel
    ? "Estas inscrições são vendidas por outros utilizadores da ORYA."
    : "Estes bilhetes são vendidos por outros utilizadores da ORYA.";
  const resalesFallbackLabel = ticketCopy.isPadel ? "Inscrição ORYA" : "Bilhete ORYA";
  const resalesCtaLabel = ticketCopy.isPadel ? ticketCopy.buyLabel : "Comprar agora";
  const eventEndedCopy = `Este ${isPadel ? "torneio" : "evento"} já terminou. ${
    ticketCopy.isPadel ? "As inscrições" : "Os bilhetes"
  } deixaram de estar disponíveis.`;
  const freeUsernameGateMessage = isGratis
    ? user
      ? hasUsername
        ? null
        : ticketCopy.isPadel
          ? "Define um username na tua conta para concluíres a inscrição gratuita."
          : "Define um username na tua conta para garantires a entrada gratuita."
      : ticketCopy.isPadel
        ? "Inicia sessão e define um username para garantires a inscrição."
        : "Inicia sessão e define um username para garantires o lugar."
    : null;
  const checkoutVariant =
    isPadel && event.padelTournamentConfig?.padelV2Enabled ? "PADEL" : "DEFAULT";
  const padelAdvanced = (event.padelTournamentConfig?.advancedSettings || {}) as {
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
    competitionState?: string | null;
  };
  const padelCompetitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: padelAdvanced.competitionState ?? null,
  });
  const padelRegistrationStartsAt =
    padelAdvanced.registrationStartsAt && !Number.isNaN(new Date(padelAdvanced.registrationStartsAt).getTime())
      ? new Date(padelAdvanced.registrationStartsAt)
      : null;
  const padelRegistrationEndsAt =
    padelAdvanced.registrationEndsAt && !Number.isNaN(new Date(padelAdvanced.registrationEndsAt).getTime())
      ? new Date(padelAdvanced.registrationEndsAt)
      : null;
  const padelRegistrationCheck =
    checkoutVariant === "PADEL"
      ? checkPadelRegistrationWindow({
          eventStatus: event.status,
          eventStartsAt: event.startsAt ?? null,
          registrationStartsAt: padelRegistrationStartsAt,
          registrationEndsAt: padelRegistrationEndsAt,
          competitionState: padelCompetitionState,
        })
      : { ok: true as const };
  const padelRegistrationMessage = !padelRegistrationCheck.ok
    ? padelRegistrationCheck.code === "EVENT_NOT_PUBLISHED"
      ? "As inscrições ainda não estão abertas."
      : padelRegistrationCheck.code === "INSCRIPTIONS_NOT_OPEN"
        ? "As inscrições ainda não abriram."
        : padelRegistrationCheck.code === "INSCRIPTIONS_CLOSED"
          ? "As inscrições já fecharam."
          : padelRegistrationCheck.code === "TOURNAMENT_STARTED"
            ? "O torneio já começou. Inscrições encerradas."
            : "Inscrições indisponíveis."
    : null;
  const padelSnapshot = isPadel ? await buildPadelEventSnapshot(event.id) : null;
  const padelCompetitionLabel = padelSnapshot
    ? padelSnapshot.competitionState === "HIDDEN"
      ? "Oculto"
      : padelSnapshot.competitionState === "DEVELOPMENT"
        ? "Desenvolvimento"
        : padelSnapshot.competitionState === "PUBLIC"
          ? "Público"
          : "Cancelado"
    : null;
  const viewParam =
    typeof resolvedSearchParams?.view === "string" ? resolvedSearchParams.view : null;
  const showLiveInline = viewParam === "live";
  const liveHref = `/eventos/${slug}/live`;
  const liveInlineHref = `/eventos/${slug}?view=live`;

  const resolvedLocation = resolveEventLocation({
    locationName: event.locationName,
    locationCity: event.locationCity,
    address: event.address,
    locationSource: event.locationSource,
    locationFormattedAddress: event.locationFormattedAddress,
    locationComponents: event.locationComponents as Record<string, unknown> | null,
    locationOverrides: event.locationOverrides as Record<string, unknown> | null,
    latitude: event.latitude,
    longitude: event.longitude,
  });
  const safeLocationName = resolvedLocation.name || "Local a anunciar";
  const safeLocationAddress = resolvedLocation.displayAddress || "Morada a anunciar";
  const googleMapsUrl = resolvedLocation.mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedLocation.mapQuery)}`
    : null;
  const safeTimezone = event.timezone || "Europe/Lisbon";
  const organizationDisplay =
    event.organization?.publicName ||
    event.organization?.businessName ||
    null;
  const organizationUsername =
    event.organization?.status === "ACTIVE"
      ? event.organization?.username ?? null
      : null;
  const safeOrganization = organizationDisplay || "Organização ORYA";
  const organizationAvatarUrl = event.organization?.brandingAvatarUrl?.trim() || null;
  const organizationHandle = organizationUsername ? `@${organizationUsername}` : null;
  const liveHubVisibility = event.liveHubVisibility ?? "PUBLIC";

  // Nota: no modelo atual, não determinamos o utilizador autenticado neste
  // Server Component para evitar erros de escrita de cookies.
  // A verificação de "já tens bilhete" pode ser feita no cliente.
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

  const cover = getEventCoverUrl(event.coverImageUrl, {
    seed: event.slug ?? event.title ?? String(event.id),
    suggestedIds: getEventCoverSuggestionIds({ templateType: event.templateType ?? null }),
    width: 1200,
    quality: 72,
    format: "webp",
  });
  const coverSource = cover?.trim() ? cover : null;
  // versão ultra-leve apenas para o blur de fundo (mantém o efeito mas evita puxar MBs)
  const blurredCover = coverSource ? optimizeImageUrl(coverSource, 120, 20, "webp", 120, "cover") : null;
  const backgroundCover = blurredCover || coverSource;
  const hasCover = Boolean(backgroundCover);

  const nowDate = new Date();
  const eventEnded = endDateObj < nowDate;
  const canSeeTickets = !isInviteRestricted || isInvited || isAdmin;

  const orderedTickets = visibleTicketTypes
    .filter((t) => {
      if (!t) return false;
      return canSeeTickets;
    })
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
      padelCategoryId: t.padelEventCategoryLink?.padelCategoryId ?? null,
      padelCategoryLabel: t.padelEventCategoryLink?.category?.label ?? null,
      padelCategoryLinkId: t.padelEventCategoryLinkId ?? null,
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
        ? isPadel
          ? "Inscrições abertas"
          : "Bilhetes à venda"
        : anyUpcoming
          ? isPadel
            ? "Inscrições em breve"
            : "Vendas em breve"
          : allClosed
            ? isPadel
              ? "Inscrições encerradas"
              : "Vendas encerradas"
            : ticketCopy.pluralCap;
  const availabilityTone = eventEnded || allClosed
    ? "border-white/25 bg-white/10 text-white/70"
    : allSoldOut
      ? "border-orange-400/40 bg-orange-500/15 text-orange-100"
      : anyOnSale
        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
        : "border-yellow-400/40 bg-yellow-500/15 text-yellow-100";

  const headersList = await headers();
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host");
  const baseUrl = host ? `${protocol}://${host}` : null;

  // Carregar revendas deste evento via API F5-9
  let resales: EventResale[] = [];
  try {
    if (baseUrl) {
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

  const showPriceFrom = !isGratis && minTicketPrice !== null;

  const padelV2Enabled = Boolean(event.padelTournamentConfig?.padelV2Enabled);
  const padelCategoryLinks = Array.isArray(event.padelCategoryLinks) ? event.padelCategoryLinks : [];
  const padelDefaultCategoryId =
    event.padelTournamentConfig?.defaultCategoryId ??
    padelCategoryLinks.find((link) => link.isEnabled)?.padelCategoryId ??
    null;
  const padelDefaultCategoryLinkId =
    padelDefaultCategoryId != null
      ? padelCategoryLinks.find((link) => link.padelCategoryId === padelDefaultCategoryId)?.id ?? null
      : null;
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
    const filtered =
      padelV2Enabled && padelDefaultCategoryLinkId
        ? eligible.filter((t) => t.padelEventCategoryLinkId === padelDefaultCategoryLinkId)
        : eligible;
    if (!filtered.length) return null;
    const cheapest = filtered.reduce((min, cur) => (cur.price < min.price ? cur : min), filtered[0]);
    return cheapest.id ?? null;
  })();

  let padelStandings: Record<string, PadelStandingRow[]> = {};

  const canShowPadelTables = isPadel && padelV2Enabled && isPublicEvent && padelCompetitionState === "PUBLIC";
  if (canShowPadelTables) {
    if (baseUrl) {
      try {
        const standingsRes = await fetch(
          `${baseUrl}/api/padel/standings?eventId=${event.id}`,
          { cache: "no-store" },
        );
        if (standingsRes.ok) {
          const data = (await standingsRes.json().catch(() => null)) as
            | { ok?: boolean; standings?: Record<string, PadelStandingRow[]> }
            | null;
          if (data?.ok && data.standings) {
            padelStandings = Object.fromEntries(
              Object.entries(data.standings).map(([group, rows]) => [
                group,
                rows.map((row) => ({
                  ...row,
                  setsFor: row.setsFor ?? 0,
                  setsAgainst: row.setsAgainst ?? 0,
                })),
              ]),
            );
          }
        }
      } catch (err) {
        console.error("Erro ao carregar standings padel", slug, err);
      }
    }

  }
  const shouldShowPadelTables = canShowPadelTables;

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
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={backgroundVars}
    >
      <CheckoutProvider>
        {hasCover && <EventBackgroundTuner targetId="event-page" defaults={backgroundDefaults} />}
        {hasCover && (
          <div
            className="pointer-events-none fixed inset-0 overflow-hidden"
            aria-hidden="true"
          >
            {/* camada principal: cover blur com máscara para fazer o fade vertical muito suave */}
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `url(${backgroundCover})`,
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
        )}

        {/* ========== HERO ============ */}
        <section className="relative z-10 w-full pb-16 pt-20 md:pb-20 md:pt-28">
          <div className="orya-page-width flex items-center justify-between px-4 md:px-8">
            <Link
              href="/explorar/eventos"
              className="inline-flex items-center gap-2 text-xs font-medium text-white/75 transition hover:text-white"
            >
              <span className="text-lg leading-none">←</span>
              <span>Voltar a explorar</span>
            </Link>
            <div className="hidden items-center gap-2 rounded-full border border-white/12 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70 sm:flex">
              <span>Evento ORYA</span>
              <span className="h-1 w-1 rounded-full bg-white/40" />
              {organizationUsername ? (
                <Link href={`/${organizationUsername}`} className="text-white/80 hover:text-white">
                  {safeOrganization}
                </Link>
              ) : (
                <span>{safeOrganization}</span>
              )}
            </div>
          </div>

          <div className="orya-page-width mt-6 grid grid-cols-1 gap-6 px-4 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#7CFFEA]/70 to-transparent" />
              <div className="relative rounded-3xl border border-white/10 bg-black/55 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl md:p-8 animate-fade-slide">
                <div className="relative">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-white/60">
                    <span>{safeLocationName}</span>
                    <span className="h-1 w-1 rounded-full bg-white/30" />
                    <span>{event.locationCity || "Cidade por anunciar"}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-white/85">
                    <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${availabilityTone}`}>
                      {availabilityLabel}
                    </span>
                    {isInviteRestricted && (
                      <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/80">
                        Só por convite
                      </span>
                    )}
                    {isGratis ? (
                      <span className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-100">
                        {freeBadgeLabel}
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

                  <h1 className="mt-4 text-4xl font-semibold leading-tight text-white md:text-5xl lg:text-6xl">
                    {event.title}
                  </h1>
                  <div className="mt-3 h-px w-24 bg-gradient-to-r from-[#7CFFEA] via-[#9F8CFF] to-transparent" />

                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                      Organizado por
                    </p>
                    {organizationUsername ? (
                      <Link
                        href={`/${organizationUsername}`}
                        className="mt-2 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 transition hover:border-white/20 hover:bg-white/10"
                      >
                        <Avatar
                          src={organizationAvatarUrl}
                          name={safeOrganization}
                          className="h-10 w-10 border border-white/20"
                          textClassName="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80"
                          fallbackText="OR"
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{safeOrganization}</span>
                            <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/65">
                              Organização
                            </span>
                          </div>
                          {organizationHandle && (
                            <span className="text-xs text-white/60">{organizationHandle}</span>
                          )}
                        </div>
                      </Link>
                    ) : (
                      <div className="mt-2 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-3 py-2">
                        <Avatar
                          src={organizationAvatarUrl}
                          name={safeOrganization}
                          className="h-10 w-10 border border-white/20"
                          textClassName="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80"
                          fallbackText="OR"
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{safeOrganization}</span>
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
                      <span>{hasTicketLabel}</span>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    {!eventEnded && (
                      <a
                        href="#bilhetes"
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-transform hover:scale-105 active:scale-95 md:text-sm"
                      >
                        {isGratis ? ctaFreeLabel : ctaPaidLabel}
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
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#FF7AD9]/60 to-transparent" />
              <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-white/12 bg-black/40 shadow-[0_24px_60px_rgba(0,0,0,0.75)]">
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

          <div className="orya-page-width mt-6 px-4 md:px-8">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur">
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
              <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                  Local
                </p>
                <p className="mt-2 text-sm font-semibold text-white/90">
                  {safeLocationName}
                </p>
                <p className="text-xs text-white/60">
                  {event.locationCity || "Cidade a anunciar"}
                </p>
                {googleMapsUrl && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                  >
                    Abrir no Google Maps
                  </a>
                )}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                  Preço
                </p>
                <p className="mt-2 text-sm font-semibold text-white/90">
                  {isGratis
                    ? freeBadgeLabel
                    : showPriceFrom
                      ? `${(displayPriceFrom ?? 0).toFixed(2)} €`
                      : "A anunciar"}
                </p>
                <p className="text-xs text-white/60">
                  {isGratis
                    ? ticketCopy.isPadel
                      ? "Inscreve-te agora."
                      : "Reserva o teu lugar agora."
                    : "Preço final confirmado no checkout."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div
          className="pointer-events-none relative z-10 orya-page-width px-6 md:px-10"
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
        <section className="relative z-10 orya-page-width grid grid-cols-1 gap-12 px-6 pb-28 pt-10 md:grid-cols-3 md:px-10">
          {/* LEFT SIDE — Info + Descrição */}
          <div className="space-y-12 md:col-span-2">
            <section
              id="resumo"
              className="rounded-3xl border border-white/10 bg-black/45 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:p-8 animate-fade-slide"
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

            <section className="rounded-3xl border border-white/10 bg-black/45 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:p-8" id="live">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
                    <span>Live</span>
                    <span className="h-1 w-1 rounded-full bg-white/30" />
                    <span>{isPadel ? "Jogos e resultados" : "Atualizações ao vivo"}</span>
                    {liveHubVisibility !== "PUBLIC" && (
                      <>
                        <span className="h-1 w-1 rounded-full bg-white/30" />
                        <span>{liveHubVisibility === "PRIVATE" ? "Privado" : "Desativado"}</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{isPadel ? "Ao vivo" : "Live"}</h3>
                  <p className="mt-2 text-xs text-white/60">
                    {isPadel
                      ? "Jogos, brackets e ranking ao vivo."
                      : "Destaques e horários ao vivo."}
                  </p>
                </div>
                {liveHubVisibility !== "DISABLED" && (
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
                    {isPadel && (
                      <Link
                        href={`/eventos/${slug}/score`}
                        className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-white/10"
                      >
                        Placar ao vivo
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {liveHubVisibility === "DISABLED" ? (
                <div className="mt-4 rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white/70">
                  O LiveHub deste evento está desativado.
                </div>
              ) : showLiveInline ? (
                <div className="mt-4">
                  <EventLiveClient slug={slug} variant="inline" />
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white/70">
                  {isPadel
                    ? "Abre o modo live para veres resultados e jogos atualizados."
                    : "Abre o modo live para veres as atualizações do evento."}
                </div>
              )}
            </section>

            {shouldShowPadelTables && (
              <section
                id="padel-classificacoes"
                className="rounded-3xl border border-white/10 bg-black/45 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:p-8 animate-fade-slide"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
                      <span>Padel</span>
                      <span className="h-1 w-1 rounded-full bg-white/30" />
                      <span>Classificações</span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold">Classificações</h3>
                  </div>
                </div>

                <PadelPublicTablesClient
                  eventId={event.id}
                  initialStandings={padelStandings}
                />
              </section>
            )}

          </div>

          {/* RIGHT SIDE — CARD DE INFORMAÇÕES / TICKETS */}
          <aside className="space-y-8 md:sticky md:top-28 md:self-start">
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#7CFFEA]/60 to-transparent" />
              <div className="relative rounded-3xl border border-white/12 bg-black/55 p-7 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold">{ticketSectionLabel}</h3>
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
                    <div className="rounded-xl border border-white/12 bg-black/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
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
                    <div className="rounded-xl border border-white/12 bg-black/50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                        Local
                      </p>
                      <p className="mt-1 text-sm text-white/85">
                        {safeLocationName}
                      </p>
                      <p className="text-xs text-white/60">
                        {safeLocationAddress}
                      </p>
                    </div>
                  </div>

                  <div id="bilhetes" className="mt-4 scroll-mt-28">
                    {!eventEnded ? (
                      <div className="space-y-5 border-t border-white/12 pt-5">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-semibold">
                            {ticketSelectLabel}
                          </h3>
                          {!isGratis && showPriceFrom && (
                            <span className="text-xs text-white/75">
                              A partir de{" "}
                              <span className="font-semibold text-white">
                                {(displayPriceFrom ?? 0).toFixed(2)} €
                              </span>
                            </span>
                          )}
                        </div>

                        {showInviteGate ? (
                          <InviteGateClient
                            slug={event.slug}
                            isGratis={isGratis}
                            isAuthenticated={Boolean(user)}
                            hasUsername={hasUsername}
                            userEmailNormalized={userEmailNormalized}
                            usernameNormalized={usernameNormalized}
                            uiTickets={uiTickets}
                            checkoutUiVariant={checkoutVariant}
                              padelMeta={
                                checkoutVariant === "PADEL"
                                  ? {
                                      eventId: event.id,
                                      organizationId: event.organizationId ?? null,
                                      categoryId: padelDefaultCategoryId ?? null,
                                      categoryLinkId: padelDefaultCategoryLinkId ?? null,
                                  }
                                  : undefined
                              }
                          />
                        ) : (
                          <>
                            {isGratis && (
                              <>
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2.5 text-sm text-emerald-100">
                                  <div>
                                    <p className="font-semibold">{freeBadgeLabel}</p>
                                    <p className="text-[11px] text-emerald-100/85">
                                      {freeInfoDescription}
                                    </p>
                                  </div>
                                </div>
                                {freeUsernameGateMessage && (
                                  <div className="rounded-xl border border-white/12 bg-black/50 px-3.5 py-2.5 text-sm text-white/85">
                                    <p className="font-semibold">{freeGateTitle}</p>
                                    <p className="text-[11px] text-white/70">{freeUsernameGateMessage}</p>
                                  </div>
                                )}
                              </>
                            )}

                            {allowCheckoutBase ? (
                              padelRegistrationMessage ? (
                                <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2.5 text-sm text-amber-100">
                                  <div>
                                    <p className="font-semibold">Inscrições indisponíveis</p>
                                    <p className="text-[11px] text-amber-100/85">{padelRegistrationMessage}</p>
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
                                      {soldOutDescription}
                                    </p>
                                  </div>
                                </div>
                              ) : !anyOnSale && anyUpcoming ? (
                                <div className="rounded-xl border border-yellow-400/40 bg-yellow-500/15 px-3.5 py-2.5 text-sm text-yellow-100">
                                  <div>
                                    <p className="font-semibold">{salesNotOpenTitle}</p>
                                    <p className="text-[11px] text-yellow-100/85">
                                      {salesNotOpenDescription}
                                    </p>
                                  </div>
                                </div>
                              ) : allClosed ? (
                                <div className="rounded-xl border border-white/12 bg-black/45 px-3.5 py-2.5 text-sm text-white/80">
                                  <div>
                                    <p className="font-semibold">{salesClosedTitle}</p>
                                    <p className="text-[11px] text-white/70">
                                      {salesClosedDescription}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <WavesSectionClient
                                  slug={event.slug}
                                  tickets={uiTickets}
                                  isGratisEvent={isGratis}
                                  checkoutUiVariant={checkoutVariant}
                                  padelMeta={
                                    checkoutVariant === "PADEL"
                                      ? {
                                          eventId: event.id,
                                          organizationId: event.organizationId ?? null,
                                          categoryId: padelDefaultCategoryId ?? null,
                                          categoryLinkId: padelDefaultCategoryLinkId ?? null,
                                        }
                                      : undefined
                                  }
                                />
                              )
                            ) : null}
                          </>
                        )}

                        {resales.length > 0 && (
                            <div className="mt-7 space-y-4 border-t border-white/12 pt-5">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-base font-semibold">
                                  {resalesTitle}
                                </h3>
                                <span className="text-xs text-white/70">
                                  {resales.length} oferta
                                  {resales.length === 1 ? "" : "s"} de revenda
                                </span>
                              </div>

                              <p className="text-xs text-white/65">
                                {resalesDescription} O pagamento é feito de forma segura através da plataforma.
                              </p>

                            <div className="space-y-4">
                              {resales.map((r) => (
                                <div
                                  key={r.id}
                                  className="flex items-center justify-between rounded-xl border border-white/12 bg-black/50 px-3.5 py-2.5 text-sm"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-medium">
                                        {r.ticketTypeName ?? resalesFallbackLabel}
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
                                    className={`${CTA_PRIMARY} px-3 py-1.5 text-xs active:scale-95`}
                                  >
                                    {resalesCtaLabel}
                                  </Link>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-3 text-sm text-white/85">
                        {eventEndedCopy}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {padelSnapshot && (
              <div className="rounded-3xl border border-white/10 bg-black/45 p-6 shadow-[0_20px_45px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
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
                    Estado: {padelCompetitionLabel ?? padelSnapshot.status}
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
                  organizationId: event.organizationId ?? null,
                  categoryId: padelDefaultCategoryId ?? null,
                  categoryLinkId: padelDefaultCategoryLinkId ?? null,
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
