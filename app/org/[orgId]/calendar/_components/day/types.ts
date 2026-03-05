import type { OrganizationOperationalMode } from "@/lib/organizationOperationalMode";

export type CalendarEventKind = "EVENT" | "TOURNAMENT" | "RESERVATION" | "CLASS";

export type CalendarBookingType = "INDIVIDUAL" | "GROUP" | "BLOCK";

export type CalendarChannel = "ONLINE" | "PRESENTIAL" | "BACKOFFICE" | "UNKNOWN";

export type CalendarPaymentStatus = "PAID" | "PARTIAL" | "PROCESSING" | "PENDING" | "UNKNOWN";

export type AgendaItem = {
  kind: CalendarEventKind;
  eventId?: number | null;
  tournamentId?: number | null;
  reservationId?: number | null;
  classSessionId?: number | null;
  courtId?: number | null;
  resourceId?: number | null;
  professionalId?: number | null;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type AgendaCapabilities = {
  reservas: boolean;
  eventos: boolean;
  torneios: boolean;
};

export type AgendaResponse = {
  ok: boolean;
  items: AgendaItem[];
  capabilities?: AgendaCapabilities;
  operationalMode?: OrganizationOperationalMode;
  reservasOperational?: {
    acceptsNewBookings: boolean;
  };
};

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  reservationId: number | null;
  classSessionId: number | null;
  eventId: number | null;
  tournamentId: number | null;
  courtId: number | null;
  professionalId: number | null;
  resourceId: number | null;
  serviceId: number | null;
  serviceTitle: string | null;
  serviceKind: string | null;
  bookingType: CalendarBookingType;
  channel: CalendarChannel;
  paymentStatus: CalendarPaymentStatus;
  createdAt: string | null;
  requestedProfessionalId: number | null;
  requestedResourceId: number | null;
};
