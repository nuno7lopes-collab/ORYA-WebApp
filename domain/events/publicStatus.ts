import { EventStatus } from "@prisma/client";

// Eventos visiveis para descoberta (listas, feeds, pesquisas).
export const PUBLIC_EVENT_DISCOVER_STATUSES: EventStatus[] = ["PUBLISHED", "DATE_CHANGED"];

// Eventos acessiveis publicamente (inclui passados/cancelados).
export const PUBLIC_EVENT_STATUSES: EventStatus[] = [
  ...PUBLIC_EVENT_DISCOVER_STATUSES,
  "FINISHED",
  "CANCELLED",
];

export const isPublicEventStatus = (status?: EventStatus | string | null) =>
  Boolean(status && PUBLIC_EVENT_STATUSES.includes(status as EventStatus));

export const isPublicDiscoverStatus = (status?: EventStatus | string | null) =>
  Boolean(status && PUBLIC_EVENT_DISCOVER_STATUSES.includes(status as EventStatus));
