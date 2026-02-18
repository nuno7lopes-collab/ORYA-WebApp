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

function normalizeStringList(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right, "pt-PT"));
}

function normalizeNumberList(values: number[]) {
  return [...values].sort((left, right) => left - right);
}

export function areFiltersEqual(left: CalendarFilters, right: CalendarFilters) {
  if (left.createdFrom !== right.createdFrom) return false;
  if (left.createdTo !== right.createdTo) return false;

  const leftStatuses = normalizeStringList(left.statuses);
  const rightStatuses = normalizeStringList(right.statuses);
  if (leftStatuses.length !== rightStatuses.length) return false;
  if (leftStatuses.some((value, index) => value !== rightStatuses[index])) return false;

  const leftTypes = normalizeStringList(left.bookingTypes);
  const rightTypes = normalizeStringList(right.bookingTypes);
  if (leftTypes.length !== rightTypes.length) return false;
  if (leftTypes.some((value, index) => value !== rightTypes[index])) return false;

  const leftChannels = normalizeStringList(left.channels);
  const rightChannels = normalizeStringList(right.channels);
  if (leftChannels.length !== rightChannels.length) return false;
  if (leftChannels.some((value, index) => value !== rightChannels[index])) return false;

  const leftPayments = normalizeStringList(left.paymentStatuses);
  const rightPayments = normalizeStringList(right.paymentStatuses);
  if (leftPayments.length !== rightPayments.length) return false;
  if (leftPayments.some((value, index) => value !== rightPayments[index])) return false;

  const leftServices = normalizeNumberList(left.serviceIds);
  const rightServices = normalizeNumberList(right.serviceIds);
  if (leftServices.length !== rightServices.length) return false;
  if (leftServices.some((value, index) => value !== rightServices[index])) return false;

  const leftRequested = normalizeNumberList(left.requestedProfessionalIds);
  const rightRequested = normalizeNumberList(right.requestedProfessionalIds);
  if (leftRequested.length !== rightRequested.length) return false;
  if (leftRequested.some((value, index) => value !== rightRequested[index])) return false;

  return true;
}
