import type { PublicEventCard } from "@/domain/events/publicEventCard";

export type TimingTag = {
  label: string;
  tone: "live" | "soon" | "default";
};

const toDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export function formatLocationLabel(event: PublicEventCard) {
  return event.location?.formattedAddress || event.location?.city || "Local a anunciar";
}

export function formatPriceLabel(event: PublicEventCard) {
  if (event.isGratis) return "Gratuito";
  if (event.priceFrom == null) return "Valor a anunciar";
  const formatted = event.priceFrom.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Desde ${formatted} EUR`;
}

export function formatEventDayLabel(event: PublicEventCard) {
  const start = toDate(event.startsAt);
  if (!start) return "Data a anunciar";
  return start.toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function buildTimingTag(event: PublicEventCard, now: Date): TimingTag {
  const start = toDate(event.startsAt);
  const end = toDate(event.endsAt);
  if (!start || !end) {
    return { label: "Agora", tone: "default" };
  }

  if (start <= now && end >= now) {
    return { label: "Agora", tone: "live" };
  }

  const diffMs = Math.max(start.getTime() - now.getTime(), 0);
  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) {
    return { label: `Falta ${diffMinutes} min`, tone: "soon" };
  }
  const diffHours = Math.ceil(diffMinutes / 60);
  if (diffHours < 24) {
    return { label: `Falta ${diffHours} h`, tone: "soon" };
  }
  const diffDays = Math.ceil(diffHours / 24);
  return { label: `Falta ${diffDays} d`, tone: "default" };
}
