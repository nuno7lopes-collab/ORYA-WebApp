import type { OrganizationOperationalMode } from "@/lib/organizationOperationalMode";

export type CalendarEntityKind = "PROFESSIONAL" | "RESOURCE" | "COURT" | "GENERAL";

export type CalendarEventKind = "EVENT" | "TOURNAMENT" | "RESERVATION" | "CLASS";

export type CalendarBookingType = "INDIVIDUAL" | "GROUP" | "BLOCK";

export type CalendarChannel = "ONLINE" | "PRESENTIAL" | "BACKOFFICE" | "UNKNOWN";

export type CalendarPaymentStatus = "PAID" | "PARTIAL" | "PROCESSING" | "PENDING" | "UNKNOWN";

export type TimeInterval = {
  startMinute: number;
  endMinute: number;
};

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
};

export type ResourceItem = {
  id: number;
  label: string;
  capacity: number;
  isActive: boolean;
  priority: number;
  sourceType?: "RESOURCE" | "COURT";
  courtId?: number | null;
  padelClubId?: number | null;
  clubName?: string | null;
};

export type ProfessionalItem = {
  id: number;
  name: string;
  roleTitle: string | null;
  isActive: boolean;
  priority: number;
  user?: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
};

export type ServiceItem = {
  id: number;
  title: string;
  kind: string;
  isActive: boolean;
  professionalLinks?: Array<{ professionalId: number }>;
  resourceLinks?: Array<{ resourceId: number }>;
};

export type CollectionResponse<T> = {
  ok: boolean;
  items: T[];
  errorCode?: string;
  message?: string;
};

export type AvailabilityTemplate = {
  availabilityId: number;
  dayOfWeek: number;
  intervals: unknown;
};

export type AvailabilitySchedule = {
  id: number;
  startDate: string;
  endDate: string | null;
  createdAt?: string;
};

export type AvailabilityOverride = {
  date: string;
  kind: string;
  intervals: unknown;
};

export type AvailabilityResponse = {
  ok: boolean;
  schedules?: AvailabilitySchedule[];
  templates?: AvailabilityTemplate[];
  overrides?: AvailabilityOverride[];
  inheritsOrganization?: boolean;
  errorCode?: string;
  message?: string;
};

export type ReservationBooking = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  status: string;
  createdAt: string;
  channel?: CalendarChannel;
  paymentStatus?: CalendarPaymentStatus;
  assignmentMode?: string;
  paymentIntentId?: string | null;
  court?: {
    id: number;
    name: string;
    isActive?: boolean;
  } | null;
  service?: {
    id: number;
    title: string;
    kind: string;
  } | null;
  professional?: {
    id: number;
    name: string;
    user?: {
      fullName: string | null;
      avatarUrl: string | null;
    } | null;
  } | null;
  resource?: {
    id: number;
    label: string;
    capacity: number;
  } | null;
  partySize?: number | null;
  changeRequest?: {
    proposedProfessionalId: number | null;
    proposedResourceId: number | null;
  } | null;
};

export type ReservationListResponse = {
  ok: boolean;
  items: ReservationBooking[];
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

export type CalendarFilters = {
  statuses: string[];
  bookingTypes: CalendarBookingType[];
  channels: CalendarChannel[];
  paymentStatuses: CalendarPaymentStatus[];
  serviceIds: number[];
  createdFrom: string | null;
  createdTo: string | null;
  requestedProfessionalIds: number[];
};

export type CalendarColumn = {
  id: string;
  entityKind: CalendarEntityKind;
  entityId: number;
  label: string;
  subtitle: string | null;
  avatarUrl: string | null;
  workingIntervals: TimeInterval[];
};

export type PositionedEvent = {
  event: CalendarEvent;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
};

export type ActiveFilterChip = {
  id: string;
  label: string;
};
