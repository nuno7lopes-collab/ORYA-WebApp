import type { PublicEventCard, useTranslation } from "@orya/shared";
import { formatCurrency } from "./formatters";

type TranslateFn = ReturnType<typeof useTranslation>["t"];

type EventPriceSummary =
  | { kind: "free" }
  | { kind: "from"; amount: number; currency: string; isFixed: boolean }
  | { kind: "ticketsSoon" }
  | { kind: "none" };

const resolveEventPriceSummary = (event: PublicEventCard): EventPriceSummary => {
  if (event.isGratis) return { kind: "free" };

  if (typeof event.priceFrom === "number") {
    return {
      kind: "from",
      amount: event.priceFrom,
      currency: "EUR",
      isFixed: false,
    };
  }

  const ticketTypes = event.ticketTypes ?? [];
  const ticketPrices = ticketTypes
    .map((ticket) => (typeof ticket.price === "number" ? ticket.price : null))
    .filter((price): price is number => price !== null);
  if (ticketPrices.length > 0) {
    const min = Math.min(...ticketPrices) / 100;
    const max = Math.max(...ticketPrices) / 100;
    const currency =
      ticketTypes.find((ticket) => ticket.currency)?.currency?.toUpperCase() || "EUR";
    return {
      kind: "from",
      amount: min,
      currency,
      isFixed: min === max,
    };
  }

  if (ticketTypes.length > 0) {
    return { kind: "ticketsSoon" };
  }

  return { kind: "none" };
};

export const resolveEventPriceLabel = (
  event: PublicEventCard,
  t: TranslateFn,
): string | null => {
  const summary = resolveEventPriceSummary(event);

  if (summary.kind === "free") return t("common:price.free");
  if (summary.kind === "ticketsSoon") return t("common:price.ticketsSoon");
  if (summary.kind === "none") return null;

  if (summary.isFixed) {
    return formatCurrency(summary.amount, summary.currency, {
      maximumFractionDigits: 0,
    });
  }

  return t("common:price.from", {
    price: formatCurrency(summary.amount, summary.currency),
  });
};

export const resolveEventPriceState = (
  event: PublicEventCard,
  t: TranslateFn,
): { label: string; isSoon: boolean } | null => {
  const summary = resolveEventPriceSummary(event);
  const label = resolveEventPriceLabel(event, t);
  if (!label) return null;

  if (summary.kind === "ticketsSoon") {
    return { label, isSoon: true };
  }

  return { label, isSoon: false };
};
