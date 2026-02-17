import { getDateParts, makeUtcDateFromLocal, normalizeIntervals, resolveIntervalsForDate } from "@/lib/reservas/availability";
import type {
  ActiveFilterChip,
  AgendaItem,
  CalendarBookingType,
  CalendarChannel,
  CalendarEvent,
  CalendarFilters,
  CalendarPaymentStatus,
  PositionedEvent,
  ReservationBooking,
  TimeInterval,
  AvailabilityResponse,
} from "./types";

export const SLOT_MINUTES = 15;
export const DAY_MINUTES = 24 * 60;
export const HOUR_START = 0;
export const HOUR_END = 24;
export const DEFAULT_HOUR_HEIGHT = 56;

const DEFAULT_WORKING_WEEKDAY_INTERVALS: TimeInterval[] = [{ startMinute: 8 * 60, endMinute: 17 * 60 }];

export type NormalizedAvailability = {
  templatesByDay: Map<number, TimeInterval[]>;
  overridesByDate: Map<string, Array<{ kind: string; intervals: TimeInterval[] }>>;
  inheritsOrganization: boolean;
};

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !json) {
    const message =
      typeof (json as { message?: string } | null)?.message === "string"
        ? (json as { message: string }).message
        : `Falha ao carregar dados (${response.status})`;
    throw new Error(message);
  }
  return json;
}

export function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function parseIdList(raw: string | null) {
  if (!raw) return [];
  const deduped = new Set<number>();
  raw
    .split(",")
    .map((part) => Number(part.trim()))
    .forEach((id) => {
      if (Number.isFinite(id) && id > 0) deduped.add(id);
    });
  return [...deduped].sort((a, b) => a - b);
}

export function setIdListParam(params: URLSearchParams, key: string, ids: number[]) {
  if (ids.length === 0) {
    params.delete(key);
    return;
  }
  params.set(key, ids.join(","));
}

export function buildZonedDate(
  parts: { year: number; month: number; day: number },
  timezone: string,
  hour = 0,
  minute = 0,
) {
  return makeUtcDateFromLocal({ ...parts, hour, minute }, timezone);
}

function addDaysToParts(parts: { year: number; month: number; day: number }, amount: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + amount);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

export function addMonthsToParts(parts: { year: number; month: number }, amount: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  base.setUTCMonth(base.getUTCMonth() + amount);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1 };
}

export function addDays(date: Date, amount: number, timezone: string) {
  const parts = getDateParts(date, timezone);
  return buildZonedDate(addDaysToParts(parts, amount), timezone, 12, 0);
}

export function parseDateParam(raw: string | null, timezone: string): Date | null {
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const candidate = buildZonedDate({ year, month, day }, timezone, 12, 0);
  const resolved = getDateParts(candidate, timezone);
  if (resolved.year !== year || resolved.month !== month || resolved.day !== day) return null;
  return candidate;
}

export function formatDateParam(date: Date, timezone: string) {
  const parts = getDateParts(date, timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function getDayKey(date: Date, timezone: string) {
  const parts = getDateParts(date, timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function isSameDay(a: Date, b: Date, timezone: string) {
  const aa = getDateParts(a, timezone);
  const bb = getDateParts(b, timezone);
  return aa.year === bb.year && aa.month === bb.month && aa.day === bb.day;
}

export function getTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return { hour: Number(map.get("hour") || 0), minute: Number(map.get("minute") || 0) };
}

export function minuteToLabel(minute: number) {
  const normalized = Math.max(0, Math.min(DAY_MINUTES, minute));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${pad2(hours)}:${pad2(mins)}`;
}

export function formatHeaderDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  }).format(date);
}

export function formatMonthLabel(parts: { year: number; month: number }) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  return new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function buildMonthCells(parts: { year: number; month: number }) {
  const firstDay = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  const daysInMonth = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  const mondayBasedOffset = (firstDay.getUTCDay() + 6) % 7;
  const cells: Array<{ year: number; month: number; day: number } | null> = [];
  for (let index = 0; index < mondayBasedOffset; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ year: parts.year, month: parts.month, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const rows: Array<Array<{ year: number; month: number; day: number } | null>> = [];
  for (let offset = 0; offset < cells.length; offset += 7) {
    rows.push(cells.slice(offset, offset + 7));
  }
  return rows;
}

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

function resolveBookingType(agendaItem: AgendaItem, booking: ReservationBooking | undefined): CalendarBookingType {
  if (agendaItem.kind !== "RESERVATION") return "BLOCK";
  const serviceKind = booking?.service?.kind?.trim().toUpperCase();
  if (serviceKind === "CLASS") return "GROUP";
  if ((booking?.partySize ?? 1) > 1) return "GROUP";
  return "INDIVIDUAL";
}

export function enrichAgendaItems(items: AgendaItem[], bookings: ReservationBooking[]) {
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  return items.map((item, index) => {
    const reservationId = item.kind === "RESERVATION" ? item.reservationId ?? null : null;
    const booking = reservationId ? bookingsById.get(reservationId) : undefined;
    const startsAt = item.startsAt;
    const endsAt = item.endsAt;
    return {
      id: `${item.kind}-${reservationId ?? item.eventId ?? item.tournamentId ?? index}-${startsAt}`,
      kind: item.kind,
      title: item.title,
      startsAt,
      endsAt,
      status: item.status,
      reservationId,
      eventId: item.kind === "EVENT" ? item.eventId ?? null : null,
      tournamentId: item.kind === "TOURNAMENT" ? item.tournamentId ?? null : null,
      courtId: item.courtId ?? booking?.court?.id ?? null,
      professionalId: item.professionalId ?? booking?.professional?.id ?? null,
      resourceId: item.resourceId ?? booking?.resource?.id ?? null,
      serviceId: booking?.service?.id ?? null,
      serviceTitle: booking?.service?.title ?? null,
      serviceKind: booking?.service?.kind ?? null,
      bookingType: resolveBookingType(item, booking),
      channel: item.kind === "RESERVATION" ? booking?.channel ?? "UNKNOWN" : "BACKOFFICE",
      paymentStatus: item.kind === "RESERVATION" ? booking?.paymentStatus ?? "UNKNOWN" : "UNKNOWN",
      createdAt: booking?.createdAt ?? null,
      requestedProfessionalId: booking?.changeRequest?.proposedProfessionalId ?? null,
      requestedResourceId: booking?.changeRequest?.proposedResourceId ?? null,
    } satisfies CalendarEvent;
  });
}

function isWithinCreatedRange(
  createdAt: string | null,
  createdFrom: string | null,
  createdTo: string | null,
  timezone: string,
) {
  if (!createdFrom && !createdTo) return true;
  if (!createdAt) return false;
  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return false;
  const createdKey = getDayKey(createdDate, timezone);
  if (createdFrom && createdKey < createdFrom) return false;
  if (createdTo && createdKey > createdTo) return false;
  return true;
}

export function filterEvents(events: CalendarEvent[], filters: CalendarFilters, timezone: string) {
  const normalizedStatuses = filters.statuses.map((status) => normalizeStatus(status));
  return events.filter((event) => {
    if (normalizedStatuses.length > 0 && !normalizedStatuses.includes(normalizeStatus(event.status))) {
      return false;
    }
    if (filters.bookingTypes.length > 0 && !filters.bookingTypes.includes(event.bookingType)) {
      return false;
    }
    if (filters.channels.length > 0 && !filters.channels.includes(event.channel)) {
      return false;
    }
    if (filters.paymentStatuses.length > 0 && !filters.paymentStatuses.includes(event.paymentStatus)) {
      return false;
    }
    if (filters.serviceIds.length > 0) {
      if (!event.serviceId || !filters.serviceIds.includes(event.serviceId)) return false;
    }
    if (!isWithinCreatedRange(event.createdAt, filters.createdFrom, filters.createdTo, timezone)) {
      return false;
    }
    if (filters.requestedProfessionalIds.length > 0) {
      const requestedProfessional = event.requestedProfessionalId ?? event.professionalId;
      if (!requestedProfessional || !filters.requestedProfessionalIds.includes(requestedProfessional)) {
        return false;
      }
    }
    return true;
  });
}

function clampMinute(value: number) {
  return Math.max(0, Math.min(DAY_MINUTES, value));
}

function getMinuteOfDay(date: Date, timezone: string) {
  const parts = getTimeParts(date, timezone);
  return parts.hour * 60 + parts.minute;
}

export type ProjectedDayEvent = {
  event: CalendarEvent;
  start: Date;
  end: Date;
  startMinute: number;
  endMinute: number;
};

export function buildProjectedEvents(params: {
  events: CalendarEvent[];
  day: Date;
  timezone: string;
}) {
  const dayStart = buildZonedDate(getDateParts(params.day, params.timezone), params.timezone, 0, 0);
  const dayEnd = addDays(dayStart, 1, params.timezone);

  const projected = params.events
    .map((event) => {
      const rawStart = new Date(event.startsAt);
      const rawEnd = new Date(event.endsAt);
      if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) return null;
      if (rawEnd <= dayStart || rawStart >= dayEnd) return null;

      const clampedStart = new Date(Math.max(rawStart.getTime(), dayStart.getTime()));
      const clampedEnd = new Date(Math.min(rawEnd.getTime(), dayEnd.getTime()));
      const startMinute = clampMinute(getMinuteOfDay(clampedStart, params.timezone));
      const endMinute = clampMinute(getMinuteOfDay(clampedEnd, params.timezone));
      if (endMinute <= startMinute) return null;

      return {
        event,
        start: clampedStart,
        end: clampedEnd,
        startMinute,
        endMinute,
      };
    })
    .filter(Boolean) as ProjectedDayEvent[];

  return projected.sort((left, right) => {
    if (left.startMinute !== right.startMinute) return left.startMinute - right.startMinute;
    return left.endMinute - right.endMinute;
  });
}

export function buildPositionedEvents(params: {
  events: CalendarEvent[];
  day: Date;
  timezone: string;
  minuteHeight: number;
}) {
  const projected = buildProjectedEvents(params);

  const clusterLaneCount = new Map<number, number>();
  let clusterId = -1;
  let active: Array<{ endMinute: number; lane: number }> = [];
  const positioned: Array<PositionedEvent & { clusterId: number }> = [];

  projected.forEach((entry) => {
    active = active.filter((item) => item.endMinute > entry.startMinute);
    if (active.length === 0) clusterId += 1;
    const usedLanes = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (usedLanes.has(lane)) lane += 1;

    active.push({ endMinute: entry.endMinute, lane });
    const laneCount = Math.max(clusterLaneCount.get(clusterId) ?? 0, lane + 1);
    clusterLaneCount.set(clusterId, laneCount);

    positioned.push({
      clusterId,
      event: entry.event,
      lane,
      laneCount: 1,
      top: entry.startMinute * params.minuteHeight,
      height: Math.max((entry.endMinute - entry.startMinute) * params.minuteHeight, 12),
    });
  });

  return positioned.map((entry) => ({
    event: entry.event,
    lane: entry.lane,
    laneCount: clusterLaneCount.get(entry.clusterId) ?? 1,
    top: entry.top,
    height: entry.height,
  }));
}

export function normalizeAvailability(payload: AvailabilityResponse, timezone: string): NormalizedAvailability {
  const templatesByDay = new Map<number, TimeInterval[]>();
  const overridesByDate = new Map<string, Array<{ kind: string; intervals: TimeInterval[] }>>();

  (payload.templates ?? []).forEach((template) => {
    if (!Number.isFinite(template.dayOfWeek)) return;
    templatesByDay.set(template.dayOfWeek, normalizeIntervals(template.intervals));
  });

  (payload.overrides ?? []).forEach((override) => {
    const date = new Date(override.date);
    if (Number.isNaN(date.getTime())) return;
    const key = getDayKey(date, timezone);
    const existing = overridesByDate.get(key) ?? [];
    existing.push({
      kind: typeof override.kind === "string" ? override.kind.toUpperCase() : "OPEN",
      intervals: normalizeIntervals(override.intervals),
    });
    overridesByDate.set(key, existing);
  });

  return {
    templatesByDay,
    overridesByDate,
    inheritsOrganization: Boolean(payload.inheritsOrganization),
  };
}

export function resolveIntervalsForDay(
  normalized: NormalizedAvailability | undefined,
  day: Date,
  timezone: string,
): TimeInterval[] {
  const dayParts = getDateParts(day, timezone);
  const dayOfWeek = new Date(Date.UTC(dayParts.year, dayParts.month - 1, dayParts.day)).getUTCDay();
  const defaultIntervals = dayOfWeek === 0 || dayOfWeek === 6 ? [] : DEFAULT_WORKING_WEEKDAY_INTERVALS;
  if (!normalized) return defaultIntervals;
  const overrides = normalized.overridesByDate.get(getDayKey(day, timezone)) ?? [];
  const resolved = resolveIntervalsForDate({
    dayOfWeek,
    templatesByDay: normalized.templatesByDay,
    overrides,
  });
  if (resolved.length > 0) return resolved;
  if (normalized.templatesByDay.size === 0 && overrides.length === 0) {
    return defaultIntervals;
  }
  return [];
}

export function invertIntervals(intervals: TimeInterval[]) {
  if (intervals.length === 0) return [{ startMinute: 0, endMinute: DAY_MINUTES }];
  const sorted = [...intervals]
    .map((interval) => ({
      startMinute: clampMinute(interval.startMinute),
      endMinute: clampMinute(interval.endMinute),
    }))
    .filter((interval) => interval.endMinute > interval.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute);

  const outside: TimeInterval[] = [];
  let cursor = 0;
  sorted.forEach((interval) => {
    if (interval.startMinute > cursor) {
      outside.push({ startMinute: cursor, endMinute: interval.startMinute });
    }
    cursor = Math.max(cursor, interval.endMinute);
  });
  if (cursor < DAY_MINUTES) {
    outside.push({ startMinute: cursor, endMinute: DAY_MINUTES });
  }
  return outside;
}

export function buildActiveFilterChips(params: {
  filters: CalendarFilters;
  serviceLabels: Map<number, string>;
  professionalLabels: Map<number, string>;
}): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  params.filters.statuses.forEach((status) => {
    chips.push({ id: `status-${status}`, label: `Estado: ${status}` });
  });
  params.filters.bookingTypes.forEach((type) => {
    chips.push({ id: `type-${type}`, label: `Tipo: ${type}` });
  });
  params.filters.channels.forEach((channel) => {
    chips.push({ id: `channel-${channel}`, label: `Canal: ${channel}` });
  });
  params.filters.paymentStatuses.forEach((status) => {
    chips.push({ id: `payment-${status}`, label: `Pagamento: ${status}` });
  });
  params.filters.serviceIds.forEach((serviceId) => {
    chips.push({
      id: `service-${serviceId}`,
      label: `Serviço: ${params.serviceLabels.get(serviceId) ?? `#${serviceId}`}`,
    });
  });
  if (params.filters.createdFrom || params.filters.createdTo) {
    const from = params.filters.createdFrom ?? "…";
    const to = params.filters.createdTo ?? "…";
    chips.push({ id: "created", label: `Criado: ${from} → ${to}` });
  }
  params.filters.requestedProfessionalIds.forEach((professionalId) => {
    chips.push({
      id: `requested-${professionalId}`,
      label: `Colaborador solicitado: ${params.professionalLabels.get(professionalId) ?? `#${professionalId}`}`,
    });
  });
  return chips;
}

export function countAppliedFilters(filters: CalendarFilters) {
  return (
    filters.statuses.length +
    filters.bookingTypes.length +
    filters.channels.length +
    filters.paymentStatuses.length +
    filters.serviceIds.length +
    filters.requestedProfessionalIds.length +
    (filters.createdFrom || filters.createdTo ? 1 : 0)
  );
}
