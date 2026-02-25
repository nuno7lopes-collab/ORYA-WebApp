"use client";
import { useCheckout } from "@/app/components/checkout/contextoCheckout";
import { CTA_PRIMARY } from "@/app/org/_shared/dashboardUi";
import { getTicketCopy } from "@/app/components/checkout/checkoutCopy";
import { t } from "@/lib/i18n";

export type WaveStatus = "on_sale" | "upcoming" | "closed" | "sold_out";

export type WaveTicket = {
  id: string;
  name: string;
  price: number;
  currency: string;
  remaining: number | null; // null = stock ilimitado
  status: WaveStatus;
  startsAt: string | null;
  endsAt: string | null;
  available: boolean;
  isVisible: boolean;
  // info extra de stock (opcional, vindo da API)
  totalQuantity?: number | null;
  soldQuantity?: number;
  padelCategoryId?: number | null;
  padelCategoryLabel?: string | null;
  padelCategoryLinkId?: number | null;
};

type WavesSectionClientProps = {
  slug: string;
  tickets: WaveTicket[];
  layout?: "rail" | "panel";
  // para sabermos se devemos ir para checkout ou fazer “join” direto
  isGratisEvent?: boolean;
  checkoutUiVariant?: "DEFAULT" | "PADEL";
  locale?: string | null;
  padelMeta?: {
    eventId: number;
    organizationId: number | null;
    categoryId?: number | null;
    categoryLinkId?: number | null;
  };
  inviteEmail?: string | null;
};

export default function WavesSectionClient({
  slug,
  tickets: initialTickets,
  layout = "panel",
  isGratisEvent,
  checkoutUiVariant = "DEFAULT",
  locale,
  padelMeta,
  inviteEmail,
}: WavesSectionClientProps) {
  const { abrirCheckout, atualizarDados } = useCheckout();
  const tickets = initialTickets;
  const ticketCopy = getTicketCopy(checkoutUiVariant, locale);
  const freeCtaLabel = ticketCopy.isPadel ? ticketCopy.buyLabel : t("ctaPublicTicketAction", locale);
  const inviteAdditional =
    inviteEmail && inviteEmail.trim()
      ? { guestEmail: inviteEmail.trim(), guestEmailConfirm: inviteEmail.trim() }
      : {};

  const visibleTickets = tickets.filter((t) => t.isVisible);
  const onSaleLabel = ticketCopy.isPadel
    ? t("availabilityRegistrationsOpen", locale)
    : t("availabilityTicketsOnSale", locale);
  const upcomingLabel = ticketCopy.isPadel
    ? t("availabilityRegistrationsSoon", locale)
    : t("availabilitySalesSoon", locale);
  const closedLabel = ticketCopy.isPadel
    ? t("availabilityRegistrationsClosed", locale)
    : t("availabilitySalesClosed", locale);
  const purchasableTickets = visibleTickets.filter(
    (t) => t.status === "on_sale" || t.status === "upcoming",
  );
  const primaryTicket =
    purchasableTickets.find((ticket) => ticket.status === "on_sale") ?? purchasableTickets[0] ?? null;

  const minPrice =
    purchasableTickets.length > 0
      ? Math.min(...purchasableTickets.map((t) => t.price))
      : null;
  const isGratisLabel = Boolean(isGratisEvent);
  const noTicketsLabel = t("noTicketsAvailable", locale).replace("{items}", ticketCopy.plural);
  const allClosed = visibleTickets.length > 0 && visibleTickets.every((ticket) => ticket.status === "closed");
  const allSoldOut = visibleTickets.length > 0 && visibleTickets.every((ticket) => ticket.status === "sold_out");
  const hasUpcoming = visibleTickets.some((ticket) => ticket.status === "upcoming");
  const disabledCtaLabel = allSoldOut
    ? t("availabilitySoldOut", locale)
    : allClosed
      ? closedLabel
      : hasUpcoming
        ? upcomingLabel
        : noTicketsLabel;

  const formatPrice = (price: number, currency: string) => {
    const safeCurrency = currency?.trim() || "EUR";
    try {
      return new Intl.NumberFormat(locale || "pt-PT", {
        style: "currency",
        currency: safeCurrency,
        minimumFractionDigits: 2,
      }).format(price);
    } catch {
      return `${price.toFixed(2)}€`;
    }
  };

  const openTicketCheckout = (ticket: WaveTicket) => {
    atualizarDados({
      slug,
      waves: visibleTickets,
      additional: {
        checkoutUiVariant,
        padelMeta,
        ...inviteAdditional,
      },
    });

    abrirCheckout({
      slug,
      ticketId: ticket.id,
      price: ticket.price,
      ticketName: ticket.name,
      eventId: padelMeta?.eventId ? String(padelMeta.eventId) : undefined,
      additional: {
        checkoutUiVariant,
        padelMeta,
        ...inviteAdditional,
      },
      waves: visibleTickets,
    });

    setTimeout(() => {
      try {
        const evt = new Event("orya-force-step1");
        window.dispatchEvent(evt);
      } catch {}
    }, 10);
  };

  const statusLabelForTicket = (ticket: WaveTicket) => {
    if (ticket.status === "sold_out") return t("availabilitySoldOut", locale);
    if (ticket.status === "closed") return closedLabel;
    if (ticket.status === "upcoming") return upcomingLabel;
    return onSaleLabel;
  };

  if (layout === "rail") {
    return (
      <div className="w-full" data-testid="event-purchase-rail">
        <div className="relative flex items-center gap-3 rounded-2xl border border-white/14 bg-black/50 px-4 py-3 backdrop-blur-xl md:px-5 md:py-3.5">
          <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[#7CFFEA]/70 to-transparent" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] uppercase tracking-[0.16em] text-white/58">
              {ticketCopy.pluralCap}
            </p>
            <p className="mt-1 truncate text-lg font-semibold leading-tight text-white/92 md:text-[1.35rem]">
              {isGratisLabel ? (
                <span className="text-white">{ticketCopy.freeLabel}</span>
              ) : minPrice !== null && primaryTicket ? (
                <>
                  {t("fromLabel", locale)}{" "}
                  <span className="text-white">
                    {formatPrice(minPrice, primaryTicket.currency)}
                  </span>
                </>
              ) : (
                <span className="text-white/62">{noTicketsLabel}</span>
              )}
            </p>
          </div>

          <button
            type="button"
            disabled={!primaryTicket}
            onClick={() => {
              if (!primaryTicket) return;
              openTicketCheckout(primaryTicket);
            }}
            className={`${CTA_PRIMARY} min-h-11 min-w-[152px] max-w-[62%] shrink-0 justify-center px-4 py-2 text-[0.9rem] shadow-[0_12px_30px_rgba(124,255,234,0.2)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {!primaryTicket
              ? disabledCtaLabel
              : isGratisLabel
                ? freeCtaLabel
                : ticketCopy.buyLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 w-full border-y border-white/14" data-testid="event-purchase-panel">
      {visibleTickets.length > 0 ? (
        visibleTickets.map((ticket) => {
          const canCheckout = ticket.status === "on_sale" || ticket.status === "upcoming";
          return (
            <div
              key={ticket.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-white/12 px-0 py-3 first:border-t-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{ticket.name}</p>
                <p className="mt-1 text-xs text-white/65">
                  {statusLabelForTicket(ticket)}
                  {ticket.remaining !== null && ticket.remaining >= 0 ? ` · ${ticket.remaining} restantes` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white/92">
                  {isGratisLabel ? ticketCopy.freeLabel : formatPrice(ticket.price, ticket.currency)}
                </span>
                <button
                  type="button"
                  disabled={!canCheckout}
                  onClick={() => {
                    if (!canCheckout) return;
                    openTicketCheckout(ticket);
                  }}
                  className={`${CTA_PRIMARY} min-h-10 min-w-[120px] justify-center px-4 py-2 text-xs active:scale-95 disabled:cursor-not-allowed disabled:opacity-55`}
                >
                  {canCheckout
                    ? isGratisLabel
                      ? freeCtaLabel
                      : ticketCopy.buyLabel
                    : statusLabelForTicket(ticket)}
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="py-3 text-sm text-white/72">
          {noTicketsLabel}
        </div>
      )}

      {primaryTicket ? (
        <div className="border-t border-white/12 py-2.5 text-xs text-white/68">
          {t("fromLabel", locale)}{" "}
          <span className="font-semibold text-white/92">
            {isGratisLabel ? ticketCopy.freeLabel : formatPrice(minPrice ?? primaryTicket.price, primaryTicket.currency)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
