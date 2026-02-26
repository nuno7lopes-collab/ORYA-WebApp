import { EventPricingMode } from "@prisma/client";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";

type TicketPricingInput = {
  price: number | null | undefined;
  currency?: string | null;
  status?: string | null;
  totalQuantity?: number | null;
  soldQuantity?: number | null;
};

const PURCHASEABLE_TICKET_STATUSES = new Set(["ON_SALE", "UPCOMING", "ACTIVE"]);

function isPurchaseableTicket(ticket: TicketPricingInput) {
  const normalizedStatus =
    typeof ticket.status === "string" ? ticket.status.trim().toUpperCase() : "";
  if (normalizedStatus && !PURCHASEABLE_TICKET_STATUSES.has(normalizedStatus)) {
    return false;
  }
  const totalQuantity =
    typeof ticket.totalQuantity === "number" && Number.isFinite(ticket.totalQuantity)
      ? ticket.totalQuantity
      : null;
  const soldQuantity =
    typeof ticket.soldQuantity === "number" && Number.isFinite(ticket.soldQuantity)
      ? ticket.soldQuantity
      : 0;
  if (totalQuantity !== null && soldQuantity >= totalQuantity) {
    return false;
  }
  return true;
}

export function resolveTicketPricingSummary(params: {
  pricingMode?: EventPricingMode | null;
  ticketTypes?: TicketPricingInput[] | null;
}) {
  const candidateTickets = (params.ticketTypes ?? [])
    .filter(isPurchaseableTicket)
    .map((ticket) => {
      if (typeof ticket.price !== "number" || !Number.isFinite(ticket.price)) {
        return null;
      }
      const normalizedCurrency =
        typeof ticket.currency === "string" && ticket.currency.trim()
          ? ticket.currency.trim().toUpperCase()
          : null;
      return {
        priceCents: Math.max(0, Math.round(ticket.price)),
        currency: normalizedCurrency,
      };
    })
    .filter(
      (ticket): ticket is { priceCents: number; currency: string | null } =>
        ticket !== null,
    );

  const ticketPrices = candidateTickets.map((ticket) => ticket.priceCents);
  const isGratis = deriveIsFreeEvent({
    pricingMode: params.pricingMode ?? undefined,
    ticketPrices,
  });
  const priceFromCents =
    isGratis ? 0 : ticketPrices.length > 0 ? Math.min(...ticketPrices) : null;

  return {
    ticketPrices,
    isGratis,
    priceFromCents,
    priceFrom: priceFromCents !== null ? priceFromCents / 100 : null,
    priceCurrency:
      candidateTickets.find((ticket) => ticket.currency)?.currency ?? null,
  };
}
