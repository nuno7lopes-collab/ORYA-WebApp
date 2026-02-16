import type {
  CalendarBookingType,
  CalendarChannel,
  CalendarFilters,
  CalendarPaymentStatus,
} from "./types";

export const BOOKING_STATUS_OPTIONS = [
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "PENDING_CONFIRMATION", label: "Pendente confirmação" },
  { value: "PENDING", label: "Pendente" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
  { value: "CANCELLED_BY_CLIENT", label: "Cancelado pelo cliente" },
  { value: "CANCELLED_BY_ORG", label: "Cancelado pela organização" },
  { value: "NO_SHOW", label: "No-show" },
  { value: "DISPUTED", label: "Disputa" },
] as const;

export const BOOKING_TYPE_OPTIONS: Array<{ value: CalendarBookingType; label: string }> = [
  { value: "INDIVIDUAL", label: "Individual" },
  { value: "GROUP", label: "Grupo" },
  { value: "BLOCK", label: "Bloqueio" },
];

export const CHANNEL_OPTIONS: Array<{ value: CalendarChannel; label: string }> = [
  { value: "ONLINE", label: "Online" },
  { value: "PRESENTIAL", label: "Presencial" },
  { value: "BACKOFFICE", label: "Backoffice" },
  { value: "UNKNOWN", label: "Indefinido" },
];

export const PAYMENT_STATUS_OPTIONS: Array<{ value: CalendarPaymentStatus; label: string }> = [
  { value: "PAID", label: "Pago" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "PROCESSING", label: "Em processamento" },
  { value: "PENDING", label: "Pendente" },
  { value: "UNKNOWN", label: "Indefinido" },
];

export const DEFAULT_CALENDAR_FILTERS: CalendarFilters = {
  statuses: [],
  bookingTypes: [],
  channels: [],
  paymentStatuses: [],
  serviceIds: [],
  createdFrom: null,
  createdTo: null,
  requestedProfessionalIds: [],
};

export function cloneFilters(filters: CalendarFilters): CalendarFilters {
  return {
    statuses: [...filters.statuses],
    bookingTypes: [...filters.bookingTypes],
    channels: [...filters.channels],
    paymentStatuses: [...filters.paymentStatuses],
    serviceIds: [...filters.serviceIds],
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    requestedProfessionalIds: [...filters.requestedProfessionalIds],
  };
}

export function emptyFilters(): CalendarFilters {
  return cloneFilters(DEFAULT_CALENDAR_FILTERS);
}
