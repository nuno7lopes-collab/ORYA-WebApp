// lib/events.ts
import type { Event, Ticket } from "@prisma/client";

export type EventCardDTO = {
  id: number;
  slug: string;
  title: string;
  shortDescription: string | null;

  startDate: string;
  endDate: string;

  venue: {
    name: string;
    address: string;
    city: string | null;
    lat: number | null;
    lng: number | null;
  };

  coverImageUrl: string | null;

  isFree: boolean;
  priceFrom: number | null;

  stats: {
    goingCount: number;
    interestedCount: number;
  };

  wavesSummary: {
    totalWaves: number;
    onSaleCount: number;
    soldOutCount: number;
    nextWaveOpensAt: string | null;
  };

  category: string | null;
  tags: string[];
};

type WaveStatus = "on_sale" | "sold_out" | "upcoming" | "closed";

function getWaveStatus(ticket: Ticket): WaveStatus {
  const now = new Date();

  if (
    ticket.totalQuantity !== null &&
    ticket.totalQuantity !== undefined &&
    ticket.soldQuantity >= ticket.totalQuantity
  ) {
    return "sold_out";
  }

  if (ticket.startsAt && now < ticket.startsAt) {
    return "upcoming";
  }

  if (ticket.endsAt && now > ticket.endsAt) {
    return "closed";
  }

  return "on_sale";
}

export function mapEventToCardDTO(
  event: Event & { tickets: Ticket[] }
): EventCardDTO {
  const shortDescription =
    event.description.length > 160
      ? event.description.slice(0, 157) + "..."
      : event.description;

  const waveStatuses = event.tickets.map(getWaveStatus);
  const totalWaves = waveStatuses.length;
  const onSaleCount = waveStatuses.filter((s) => s === "on_sale").length;
  const soldOutCount = waveStatuses.filter((s) => s === "sold_out").length;

  const upcomingWaves = event.tickets
    .filter((t) => getWaveStatus(t) === "upcoming" && t.startsAt)
    .sort(
      (a, b) =>
        (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)
    );

  const nextWaveOpensAt = upcomingWaves[0]?.startsAt
    ? upcomingWaves[0].startsAt.toISOString()
    : null;

  // preço mínimo entre waves "on_sale"; se não houver, entre todas
  const onSaleTickets = event.tickets.filter(
    (t) =>
      getWaveStatus(t) === "on_sale" &&
      t.available &&
      t.isVisible
  );

  const candidateTickets =
    onSaleTickets.length > 0 ? onSaleTickets : event.tickets;

  const priceFrom =
    candidateTickets.length > 0
      ? Math.min(...candidateTickets.map((t) => t.price))
      : null;

  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    shortDescription,

    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),

    venue: {
      name: event.locationName,
      address: event.address,
      city: null, // futuro: adicionar campo city no Event
      lat: null,  // futuro: latitude
      lng: null,  // futuro: longitude
    },

    coverImageUrl: event.coverImageUrl ?? null,

    isFree: event.isFree,
    priceFrom,

    stats: {
      goingCount: 0, // futuro: calcular a partir de participações
      interestedCount: 0,
    },

    wavesSummary: {
      totalWaves,
      onSaleCount,
      soldOutCount,
      nextWaveOpensAt,
    },

    category: null, // futuro: coluna category no Event
    tags: [],        // futuro: tabela/coluna de tags
  };
}