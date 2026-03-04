"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { ContextDrawer } from "@/components/ui/context-drawer";
import { OryaDateField } from "@/components/ui/datetime";
import { CalendarCommandBar } from "./CalendarCommandBar";
import type { CalendarView } from "./ViewSwitcher";
import { resolveAvailabilityOverlayHint, resolveAvailabilityOverlayState } from "./availabilityOverlayMode";
import { SearchableEntitySelect, type SearchableEntityOption } from "./day/SearchableEntitySelect";
import { buildCalendarOperationalGuidance } from "./operationalGuidance";
import {
  buildAggregateAgendaItems,
  getAggregateKey,
  type AggregateAgendaItem as WeekAggregateAgendaItem,
  type ProjectedAgendaItem as WeekProjectedAgendaItem,
} from "./week/aggregation";
import {
  getDateParts,
  makeUtcDateFromLocal,
  normalizeIntervals,
  resolveIntervalsForDate,
  resolveScheduleForDate,
} from "@/lib/reservas/availability";
import { CALENDAR_TIMEZONE_OPTIONS, normalizeCalendarTimezone } from "./timezones";
import { summarizeAgendaItemsByStatus } from "./statusSummary";
import { resolveAggregateItemsToneClass, resolveEventToneClass } from "./eventTones";
import type { OrganizationOperationalMode } from "@/lib/organizationOperationalMode";

type AgendaItem = {
  kind: "EVENT" | "TOURNAMENT" | "RESERVATION" | "CLASS";
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

type AgendaCapabilities = {
  reservas: boolean;
  eventos: boolean;
  torneios: boolean;
};

type AgendaResponse = {
  ok: boolean;
  items: AgendaItem[];
  capabilities?: AgendaCapabilities;
  operationalMode?: OrganizationOperationalMode;
  reservasOperational?: {
    acceptsNewBookings: boolean;
  };
};

type CollectionResponse<T> = {
  ok: boolean;
  items: T[];
  errorCode?: string;
  message?: string;
};

type ResourceItem = {
  id: number;
  label: string;
  capacity: number;
  isActive: boolean;
  priority: number;
  sourceType?: "RESOURCE" | "COURT";
  resourceId?: number | null;
  availabilityScopeId?: number | null;
  courtId?: number | null;
  padelClubId?: number | null;
  clubName?: string | null;
};

type ProfessionalItem = {
  id: number;
  name: string;
  roleTitle: string | null;
  isActive: boolean;
  priority: number;
};

type AvailabilityTemplate = {
  availabilityId: number;
  dayOfWeek: number;
  intervals: unknown;
};

type AvailabilityScheduleResponse = {
  id: number;
  startDate: string;
  endDate: string | null;
  createdAt?: string;
};

type AvailabilitySchedule = {
  id: number;
  startDate: Date;
  endDate: Date | null;
  createdAt?: Date;
};

type AvailabilityOverride = {
  date: string;
  kind: string;
  intervals: unknown;
};

type AvailabilityResponse = {
  ok: boolean;
  schedules?: AvailabilityScheduleResponse[];
  templates?: AvailabilityTemplate[];
  overrides?: AvailabilityOverride[];
  inheritsOrganization?: boolean;
  errorCode?: string;
  message?: string;
};

type Interval = { startMinute: number; endMinute: number };

type NormalizedAvailability = {
  schedules: AvailabilitySchedule[];
  templatesBySchedule: Map<number, Map<number, Interval[]>>;
  overridesByDate: Map<string, Array<{ kind: string; intervals: Interval[] }>>;
  inheritsOrganization: boolean;
};

function getOverrideKey(value: string, timezone: string) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = getDateParts(parsed, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

type PositionedAgendaItem = {
  item: AgendaItem;
  start: Date;
  end: Date;
};

type ProjectedAgendaItem = WeekProjectedAgendaItem<AgendaItem> & PositionedAgendaItem;
type AggregateAgendaItem = WeekAggregateAgendaItem<AgendaItem>;

const DEFAULT_HOUR_HEIGHT = 56;
const VISIBLE_HOURS = 10;
const HOUR_START = 0;
const HOUR_END = 24;
const PROFESSIONAL_OPTION_PREFIX = "P:";
const RESOURCE_OPTION_PREFIX = "R:";
const COURT_OPTION_PREFIX = "C:";
const ALL_KIND_FILTER_OPTIONS = [
  { value: "RESERVATION", label: "Reserva" },
  { value: "CLASS", label: "Aula" },
  { value: "EVENT", label: "Evento" },
  { value: "TOURNAMENT", label: "Torneio" },
] as const;
const DAY_HEADER_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const DATE_TIME_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const HOUR_MINUTE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getDayHeaderFormatter(timezone: string) {
  const cached = DAY_HEADER_FORMATTER_CACHE.get(timezone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: timezone,
  });
  DAY_HEADER_FORMATTER_CACHE.set(timezone, formatter);
  return formatter;
}

function getDateTimeFormatter(timezone: string) {
  const cached = DATE_TIME_FORMATTER_CACHE.get(timezone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
  DATE_TIME_FORMATTER_CACHE.set(timezone, formatter);
  return formatter;
}

function getHourMinuteFormatter(timezone: string) {
  const cached = HOUR_MINUTE_FORMATTER_CACHE.get(timezone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
  HOUR_MINUTE_FORMATTER_CACHE.set(timezone, formatter);
  return formatter;
}

function encodeOptionId(prefix: string, id: number) {
  return `${prefix}${id}`;
}

function decodePrefixedIds(values: string[], prefix: string) {
  const deduped = new Set<number>();
  values
    .filter((value) => value.startsWith(prefix))
    .map((value) => Number(value.slice(prefix.length)))
    .filter((value) => Number.isFinite(value) && value > 0)
    .forEach((value) => deduped.add(value));
  return [...deduped].sort((a, b) => a - b);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok || json === null) {
    const message =
      typeof (json as { message?: string } | null)?.message === "string"
        ? (json as { message: string }).message
        : `Falha ao carregar dados (${res.status})`;
    throw new Error(message);
  }
  return json;
}

function parseIdList(raw: string | null): number[] {
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

function setIdListParam(params: URLSearchParams, key: string, ids: number[]) {
  if (ids.length === 0) {
    params.delete(key);
    return;
  }
  params.set(key, ids.join(","));
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function addDaysToParts(parts: { year: number; month: number; day: number }, amount: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  base.setUTCDate(base.getUTCDate() + amount);
  return { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() };
}

function buildZonedDate(parts: { year: number; month: number; day: number }, timezone: string, hour = 0, minute = 0) {
  return makeUtcDateFromLocal({ ...parts, hour, minute }, timezone);
}

function parseDateParam(raw: string | null, timezone: string): Date | null {
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

function formatDateParam(date: Date, timezone: string) {
  const parts = getDateParts(date, timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function addDays(date: Date, amount: number, timezone: string) {
  const parts = getDateParts(date, timezone);
  return buildZonedDate(addDaysToParts(parts, amount), timezone, 12, 0);
}

function getWeekStart(date: Date, timezone: string) {
  const parts = getDateParts(date, timezone);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const diff = (weekday + 6) % 7;
  return buildZonedDate(addDaysToParts(parts, -diff), timezone, 0, 0);
}

function getTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return { hour: Number(map.get("hour") || 0), minute: Number(map.get("minute") || 0) };
}

function formatRangeLabel(start: Date, timezone: string) {
  const end = addDays(start, 6, timezone);
  const formatter = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function getDayKey(date: Date, timezone: string) {
  const parts = getDateParts(date, timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function isSameDay(a: Date, b: Date, timezone: string) {
  const aa = getDateParts(a, timezone);
  const bb = getDateParts(b, timezone);
  return aa.year === bb.year && aa.month === bb.month && aa.day === bb.day;
}

function normalizeAvailability(payload: AvailabilityResponse, timezone: string): NormalizedAvailability {
  const templatesBySchedule = new Map<number, Map<number, Interval[]>>();
  const overridesByDate = new Map<string, Array<{ kind: string; intervals: Interval[] }>>();

  (payload.templates ?? []).forEach((template) => {
    if (!Number.isFinite(template.dayOfWeek) || !Number.isFinite(template.availabilityId)) return;
    const byDay = templatesBySchedule.get(template.availabilityId) ?? new Map<number, Interval[]>();
    byDay.set(template.dayOfWeek, normalizeIntervals(template.intervals));
    templatesBySchedule.set(template.availabilityId, byDay);
  });

  (payload.overrides ?? []).forEach((override) => {
    const key = getOverrideKey(override.date, timezone);
    if (!key) return;
    const existing = overridesByDate.get(key) ?? [];
    existing.push({
      kind: typeof override.kind === "string" ? override.kind.toUpperCase() : "OPEN",
      intervals: normalizeIntervals(override.intervals),
    });
    overridesByDate.set(key, existing);
  });

  return {
    schedules: (payload.schedules ?? [])
      .map((schedule) => ({
        id: schedule.id,
        startDate: new Date(schedule.startDate),
        endDate: schedule.endDate ? new Date(schedule.endDate) : null,
        createdAt: schedule.createdAt ? new Date(schedule.createdAt) : undefined,
      }))
      .filter((schedule) => Number.isFinite(schedule.id) && !Number.isNaN(schedule.startDate.getTime())),
    templatesBySchedule,
    overridesByDate,
    inheritsOrganization: Boolean(payload.inheritsOrganization),
  };
}

function resolveIntervalsForDay(normalized: NormalizedAvailability | undefined, day: Date, timezone: string) {
  const dayParts = getDateParts(day, timezone);
  const dayOfWeek = new Date(Date.UTC(dayParts.year, dayParts.month - 1, dayParts.day)).getUTCDay();
  if (!normalized) return [];
  const schedule = resolveScheduleForDate(normalized.schedules, day, timezone);
  const templatesByDay = schedule ? normalized.templatesBySchedule.get(schedule.id) ?? new Map() : new Map();
  const overrides = normalized.overridesByDate.get(getDayKey(day, timezone)) ?? [];
  const resolved = resolveIntervalsForDate({
    dayOfWeek,
    templatesByDay,
    overrides,
    fallbackToDefault: false,
  });
  return resolved;
}

function invertIntervals(intervals: Interval[]) {
  if (intervals.length === 0) return [{ startMinute: 0, endMinute: 24 * 60 }];
  const sorted = [...intervals].sort((a, b) => a.startMinute - b.startMinute);
  const outside: Interval[] = [];
  let cursor = 0;
  sorted.forEach((interval) => {
    if (interval.startMinute > cursor) {
      outside.push({ startMinute: cursor, endMinute: interval.startMinute });
    }
    cursor = Math.max(cursor, interval.endMinute);
  });
  if (cursor < 24 * 60) {
    outside.push({ startMinute: cursor, endMinute: 24 * 60 });
  }
  return outside;
}

function buildAgendaPositions(params: {
  items: AgendaItem[];
  day: Date;
  timezone: string;
}) {
  const dayStart = buildZonedDate(getDateParts(params.day, params.timezone), params.timezone, 0, 0);
  const dayEndExclusive = addDays(dayStart, 1, params.timezone);
  const projected = params.items
    .map((item) => {
      const rawStart = new Date(item.startsAt);
      const rawEnd = new Date(item.endsAt);
      if (Number.isNaN(rawStart.getTime()) || Number.isNaN(rawEnd.getTime())) return null;
      if (rawEnd.getTime() <= dayStart.getTime() || rawStart.getTime() >= dayEndExclusive.getTime()) return null;
      const start = new Date(Math.max(rawStart.getTime(), dayStart.getTime()));
      const end = new Date(Math.min(rawEnd.getTime(), dayEndExclusive.getTime()));
      const startParts = getTimeParts(start, params.timezone);
      const endParts = getTimeParts(end, params.timezone);
      const startMinute = startParts.hour * 60 + startParts.minute;
      const endMinute = endParts.hour * 60 + endParts.minute;
      if (endMinute <= startMinute) return null;
      return { item, start, end, startMinute, endMinute };
    })
    .filter(Boolean) as ProjectedAgendaItem[];
  return projected.sort((a, b) => {
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return a.endMinute - b.endMinute;
  });
}

function resolveStatusLabel(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "CONFIRMED") return "Confirmado";
  if (normalized === "COMPLETED") return "Concluído";
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION") return "Pendente";
  if (normalized === "NO_SHOW") return "No-show";
  if (normalized.startsWith("CANCELLED")) return "Cancelado";
  return status;
}

function resolveKindLabel(kind: AgendaItem["kind"]) {
  if (kind === "RESERVATION") return "Reserva";
  if (kind === "CLASS") return "Aula";
  if (kind === "TOURNAMENT") return "Torneio";
  return "Evento";
}

function resolveCardTone(item: AgendaItem) {
  return resolveEventToneClass({ status: item.status, kind: item.kind });
}

function resolveAggregateTone(items: ProjectedAgendaItem[]) {
  return resolveAggregateItemsToneClass(items.map((entry) => entry.item));
}

function formatDateTime(dateRaw: string, timezone: string) {
  const date = new Date(dateRaw);
  return getDateTimeFormatter(timezone).format(date);
}

function formatHourMinute(date: Date, timezone: string) {
  return getHourMinuteFormatter(timezone).format(date);
}

function getAgendaItemIdentity(item: AgendaItem) {
  if (item.kind === "RESERVATION" && Number.isFinite(item.reservationId) && Number(item.reservationId) > 0) {
    return `RESERVATION-${Number(item.reservationId)}`;
  }
  if (item.kind === "EVENT" && Number.isFinite(item.eventId) && Number(item.eventId) > 0) {
    return `EVENT-${Number(item.eventId)}`;
  }
  if (item.kind === "TOURNAMENT" && Number.isFinite(item.tournamentId) && Number(item.tournamentId) > 0) {
    return `TOURNAMENT-${Number(item.tournamentId)}`;
  }
  if (item.kind === "CLASS" && Number.isFinite(item.classSessionId) && Number(item.classSessionId) > 0) {
    return `CLASS-${Number(item.classSessionId)}`;
  }
  return [
    item.kind,
    item.title,
    item.startsAt,
    item.endsAt,
    item.status,
    item.resourceId ?? "no-resource",
    item.courtId ?? "no-court",
    item.professionalId ?? "no-professional",
  ].join("-");
}

function getProjectedEntryKey(entry: ProjectedAgendaItem, occurrenceIndex: number) {
  return [
    getAgendaItemIdentity(entry.item),
    entry.start.toISOString(),
    entry.end.toISOString(),
    occurrenceIndex,
  ].join("-");
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return element.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export default function WeekCalendarReadClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const [selectedAggregateKey, setSelectedAggregateKey] = useState<string | null>(null);
  const [visibleKinds, setVisibleKinds] = useState<Array<(typeof ALL_KIND_FILTER_OPTIONS)[number]["value"]>>(
    ALL_KIND_FILTER_OPTIONS.map((option) => option.value),
  );
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);
  const hourHeight = DEFAULT_HOUR_HEIGHT;
  const timezone = useMemo(
    () => normalizeCalendarTimezone(searchParams.get("tz")),
    [searchParams],
  );
  const gridScrollRef = useRef<HTMLDivElement | null>(null);

  const selectedResourceIds = useMemo(() => parseIdList(searchParams.get("resources")), [searchParams]);
  const selectedCourtIds = useMemo(() => parseIdList(searchParams.get("courts")), [searchParams]);
  const selectedProfessionalIds = useMemo(
    () => parseIdList(searchParams.get("professionals")),
    [searchParams],
  );
  const selectedScopesCountRaw = selectedProfessionalIds.length + selectedResourceIds.length + selectedCourtIds.length;
  const anchorDate = useMemo(
    () => parseDateParam(searchParams.get("date"), timezone) ?? new Date(),
    [searchParams, timezone],
  );

  const replaceState = (input: {
    nextDate?: Date;
    nextResources?: number[];
    nextCourts?: number[];
    nextProfessionals?: number[];
    nextTimezone?: string;
    nextShowAvailabilityOverlay?: boolean;
  }) => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    setIdListParam(nextParams, "resources", input.nextResources ?? selectedResourceIds);
    setIdListParam(nextParams, "courts", input.nextCourts ?? selectedCourtIds);
    setIdListParam(nextParams, "professionals", input.nextProfessionals ?? selectedProfessionalIds);
    const rawOverlay = searchParams.get("showAvailabilityOverlay");
    const currentOverlay = rawOverlay === "1" ? true : rawOverlay === "0" ? false : true;
    const nextOverlay =
      typeof input.nextShowAvailabilityOverlay === "boolean"
        ? input.nextShowAvailabilityOverlay
        : currentOverlay;
    nextParams.set("showAvailabilityOverlay", nextOverlay ? "1" : "0");
    const nextTimezone = normalizeCalendarTimezone(input.nextTimezone ?? timezone);
    nextParams.set("tz", nextTimezone);
    const nextDate =
      input.nextDate ??
      (input.nextTimezone
        ? buildZonedDate(getDateParts(anchorDate, timezone), nextTimezone, 12, 0)
        : anchorDate);
    nextParams.set("date", formatDateParam(nextDate, nextTimezone));
    nextParams.set("view", "week");
    nextParams.delete("scopeMode");
    const nextPath = buildOrgHref(organizationId, "/calendar");
    const search = nextParams.toString();
    router.replace(search ? `${nextPath}?${search}` : nextPath, { scroll: false });
  };

  const shiftRange = (direction: -1 | 1) => {
    replaceState({ nextDate: addDays(anchorDate, direction * 7, timezone) });
  };

  const setToday = () => {
    replaceState({ nextDate: new Date() });
  };

  const setSelectedResourcesAndCourts = (optionIds: string[]) => {
    replaceState({
      nextResources: decodePrefixedIds(optionIds, RESOURCE_OPTION_PREFIX),
      nextCourts: decodePrefixedIds(optionIds, COURT_OPTION_PREFIX),
    });
  };
  const setSelectedProfessionals = (optionIds: string[]) => {
    replaceState({
      nextProfessionals: decodePrefixedIds(optionIds, PROFESSIONAL_OPTION_PREFIX),
    });
  };
  const clearSelections = () => {
    replaceState({ nextResources: [], nextCourts: [], nextProfessionals: [] });
  };
  const toggleVisibleKind = (kind: (typeof ALL_KIND_FILTER_OPTIONS)[number]["value"]) => {
    setVisibleKinds((current) => {
      if (current.includes(kind)) {
        const next = current.filter((item) => item !== kind);
        return next.length > 0 ? next : current;
      }
      return [...current, kind];
    });
  };

  const range = useMemo(() => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return null;
    const from = getWeekStart(anchorDate, timezone);
    const days = Array.from({ length: 7 }, (_, idx) => addDays(from, idx, timezone));
    const to = buildZonedDate(getDateParts(days[6], timezone), timezone, 23, 59);
    return {
      from,
      to,
      days,
      label: formatRangeLabel(from, timezone),
    };
  }, [anchorDate, organizationId, timezone]);

  const apiUrl = useMemo(() => {
    if (!range) return null;
    const query = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
    return `/api/org/${organizationId}/agenda?${query.toString()}`;
  }, [organizationId, range]);

  const { data, error, isLoading } = useSWR<AgendaResponse>(apiUrl, fetchJson);
  const agendaCapabilities = data?.capabilities ?? null;
  const operationalMode = data?.operationalMode ?? null;
  const reservationsCapability = agendaCapabilities?.reservas;
  const reservationsEnabled = reservationsCapability === true;
  const scopeSelectionEnabled = reservationsCapability !== false;
  const resourcesUrl =
    reservationsEnabled && Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/reservas/recursos?${new URLSearchParams({
          includeCourts: "1",
        }).toString()}`
      : null;
  const professionalsUrl =
    reservationsEnabled && Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/reservas/profissionais`
      : null;

  const { data: resourcesData } = useSWR<CollectionResponse<ResourceItem>>(resourcesUrl, fetchJson);
  const { data: professionalsData } = useSWR<CollectionResponse<ProfessionalItem>>(professionalsUrl, fetchJson);

  const activeResources = useMemo(
    () => (resourcesData?.items ?? []).filter((item) => item.isActive && (item.sourceType ?? "RESOURCE") === "RESOURCE"),
    [resourcesData?.items],
  );
  const activeCourts = useMemo(
    () => (resourcesData?.items ?? []).filter((item) => item.isActive && item.sourceType === "COURT"),
    [resourcesData?.items],
  );
  const activeProfessionals = useMemo(
    () => (professionalsData?.items ?? []).filter((item) => item.isActive),
    [professionalsData?.items],
  );
  const availableKindOptions = useMemo(() => {
    if (!agendaCapabilities) return ALL_KIND_FILTER_OPTIONS;
    return ALL_KIND_FILTER_OPTIONS.filter((option) => {
      if (option.value === "RESERVATION" || option.value === "CLASS") return agendaCapabilities.reservas;
      if (option.value === "EVENT") return agendaCapabilities.eventos;
      if (option.value === "TOURNAMENT") return agendaCapabilities.torneios;
      return false;
    });
  }, [agendaCapabilities]);

  useEffect(() => {
    const allowed = new Set(availableKindOptions.map((option) => option.value));
    setVisibleKinds((current) => {
      const next = current.filter((kind) => allowed.has(kind));
      if (next.length > 0) return next;
      if (availableKindOptions.length > 0) return [availableKindOptions[0].value];
      return current;
    });
  }, [availableKindOptions]);
  const resourcesById = useMemo(
    () => new Map(activeResources.map((resource) => [resource.id, resource])),
    [activeResources],
  );
  const courtsById = useMemo(() => new Map(activeCourts.map((court) => [court.id, court])), [activeCourts]);
  const professionalsById = useMemo(
    () => new Map(activeProfessionals.map((professional) => [professional.id, professional])),
    [activeProfessionals],
  );
  const professionalOptions = useMemo<SearchableEntityOption[]>(
    () =>
      activeProfessionals.map((professional) => ({
        id: encodeOptionId(PROFESSIONAL_OPTION_PREFIX, professional.id),
        label: professional.name,
        subtitle: professional.roleTitle,
      })),
    [activeProfessionals],
  );
  const resourceOptions = useMemo<SearchableEntityOption[]>(
    () => [
      ...activeResources.map((resource) => ({
        id: encodeOptionId(RESOURCE_OPTION_PREFIX, resource.id),
        label: resource.label,
        subtitle: `Recurso · capacidade ${resource.capacity}`,
      })),
      ...activeCourts.map((court) => ({
        id: encodeOptionId(COURT_OPTION_PREFIX, court.id),
        label: court.label,
        subtitle: court.clubName ? `Campo · ${court.clubName}` : "Campo de padel",
      })),
    ],
    [activeCourts, activeResources],
  );
  const selectedProfessionalOptionIds = useMemo(
    () => selectedProfessionalIds.map((id) => encodeOptionId(PROFESSIONAL_OPTION_PREFIX, id)),
    [selectedProfessionalIds],
  );
  const selectedResourceOptionIds = useMemo(
    () => [
      ...selectedResourceIds.map((id) => encodeOptionId(RESOURCE_OPTION_PREFIX, id)),
      ...selectedCourtIds.map((id) => encodeOptionId(COURT_OPTION_PREFIX, id)),
    ],
    [selectedCourtIds, selectedResourceIds],
  );
  const hasActiveSelection = scopeSelectionEnabled && selectedScopesCountRaw > 0;
  const selectedScopesCount = scopeSelectionEnabled ? selectedScopesCountRaw : 0;
  const hasSingleScopeSelection = scopeSelectionEnabled && selectedScopesCount === 1;
  const { showAvailabilityOverlay, overlayMode, renderAvailabilityOverlay } =
    resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: searchParams.get("showAvailabilityOverlay"),
      hasSingleScopeSelection,
    });
  const selectedScopesLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedProfessionalIds.length > 0) {
      parts.push(`${selectedProfessionalIds.length} profissional${selectedProfessionalIds.length > 1 ? "s" : ""}`);
    }
    if (selectedResourceIds.length > 0) {
      parts.push(`${selectedResourceIds.length} recurso${selectedResourceIds.length > 1 ? "s" : ""}`);
    }
    if (selectedCourtIds.length > 0) {
      parts.push(`${selectedCourtIds.length} campo${selectedCourtIds.length > 1 ? "s" : ""}`);
    }
    return parts.join(" · ");
  }, [selectedCourtIds.length, selectedProfessionalIds.length, selectedResourceIds.length]);
  const dayViewHref = useMemo(() => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return "#";
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", formatDateParam(anchorDate, timezone));
    nextParams.set("tz", timezone);
    nextParams.set("view", "day");
    nextParams.delete("scopeMode");
    const nextPath = buildOrgHref(organizationId, "/calendar");
    const search = nextParams.toString();
    return search ? `${nextPath}?${search}` : nextPath;
  }, [anchorDate, organizationId, searchParams, timezone]);
  const monthViewHref = useMemo(() => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return "#";
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", formatDateParam(anchorDate, timezone));
    nextParams.set("tz", timezone);
    nextParams.set("view", "month");
    nextParams.delete("scopeMode");
    const nextPath = buildOrgHref(organizationId, "/calendar");
    const search = nextParams.toString();
    return search ? `${nextPath}?${search}` : nextPath;
  }, [anchorDate, organizationId, searchParams, timezone]);
  const setView = (nextView: CalendarView) => {
    if (nextView === "day") {
      router.push(dayViewHref, { scroll: false });
      return;
    }
    if (nextView === "month") {
      router.push(monthViewHref, { scroll: false });
      return;
    }
    replaceState({});
  };

  const items = data?.items ?? [];
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!visibleKinds.includes(item.kind)) return false;
      const matchesResource = Boolean(item.resourceId && selectedResourceIds.includes(item.resourceId));
      const matchesCourt = Boolean(item.courtId && selectedCourtIds.includes(item.courtId));
      const matchesProfessional = Boolean(
        item.professionalId && selectedProfessionalIds.includes(item.professionalId),
      );
      const hasAnySelection =
        scopeSelectionEnabled &&
        (selectedProfessionalIds.length > 0 || selectedResourceIds.length > 0 || selectedCourtIds.length > 0);
      if (!hasAnySelection) return true;
      return matchesProfessional || matchesResource || matchesCourt;
    });
  }, [items, scopeSelectionEnabled, selectedCourtIds, selectedProfessionalIds, selectedResourceIds, visibleKinds]);

  const minuteHeight = hourHeight / 60;
  const viewportHeight = hourHeight * VISIBLE_HOURS;
  const gridHeight = (HOUR_END - HOUR_START) * hourHeight;
  const days = range?.days ?? [];
  const aggregateByDay = useMemo(() => {
    const map = new Map<string, AggregateAgendaItem[]>();
    days.forEach((day) => {
      const dayKey = getDayKey(day, timezone);
      const positions = buildAgendaPositions({
        items: filteredItems,
        day,
        timezone,
      });
      map.set(
        dayKey,
        buildAggregateAgendaItems({
          positions,
          dayKey,
          minuteHeight,
        }),
      );
    });
    return map;
  }, [days, filteredItems, minuteHeight, timezone]);
  const aggregatesByKey = useMemo(() => {
    const map = new Map<string, AggregateAgendaItem>();
    aggregateByDay.forEach((entries) => {
      entries.forEach((aggregate) => {
        map.set(getAggregateKey(aggregate.dayKey, aggregate.startMinute, aggregate.endMinute), aggregate);
      });
    });
    return map;
  }, [aggregateByDay]);
  const selectedAggregate = selectedAggregateKey ? aggregatesByKey.get(selectedAggregateKey) ?? null : null;
  const singleScopeSelection = useMemo(() => {
    if (!hasSingleScopeSelection) return null;
    if (
      selectedProfessionalIds.length === 1 &&
      selectedResourceIds.length === 0 &&
      selectedCourtIds.length === 0
    ) {
      return {
        scopeType: "PROFESSIONAL" as const,
        scopeId: selectedProfessionalIds[0],
      };
    }
    if (
      selectedResourceIds.length === 1 &&
      selectedProfessionalIds.length === 0 &&
      selectedCourtIds.length === 0
    ) {
      return {
        scopeType: "RESOURCE" as const,
        scopeId: selectedResourceIds[0],
      };
    }
    if (
      selectedCourtIds.length === 1 &&
      selectedProfessionalIds.length === 0 &&
      selectedResourceIds.length === 0
    ) {
      const court = courtsById.get(selectedCourtIds[0]);
      const scopeId = court?.availabilityScopeId ?? court?.courtId ?? court?.id ?? null;
      if (!scopeId || !Number.isFinite(scopeId) || scopeId <= 0) return null;
      return {
        scopeType: "RESOURCE" as const,
        scopeId,
      };
    }
    return null;
  }, [
    courtsById,
    hasSingleScopeSelection,
    selectedCourtIds,
    selectedProfessionalIds,
    selectedResourceIds,
  ]);

  const selectedScopeAvailabilityKey =
    reservationsEnabled &&
    Number.isFinite(organizationId) &&
    organizationId > 0 &&
    singleScopeSelection &&
    Number.isFinite(singleScopeSelection.scopeId) &&
    singleScopeSelection.scopeId > 0
      ? `scope-availability:${organizationId}:${singleScopeSelection.scopeType}:${singleScopeSelection.scopeId}`
      : null;
  const { data: selectedScopeAvailability } = useSWR<NormalizedAvailability | undefined>(
    selectedScopeAvailabilityKey,
    async () => {
      if (!singleScopeSelection) return undefined;
      const query = new URLSearchParams({
        scopeType: singleScopeSelection.scopeType,
        scopeId: String(singleScopeSelection.scopeId),
      });
      query.set("includeTemplates", "all");
      const url = `/api/org/${organizationId}/reservas/disponibilidade?${query.toString()}`;
      try {
        const payload = await fetchJson<AvailabilityResponse>(url);
        if (!payload?.ok) return undefined;
        return normalizeAvailability(payload, timezone);
      } catch {
        return undefined;
      }
    },
  );
  const organizationAvailabilityKey =
    reservationsEnabled && Number.isFinite(organizationId) && organizationId > 0
      ? `org-availability:${organizationId}`
      : null;
  const { data: organizationAvailability } = useSWR<NormalizedAvailability | undefined>(
    organizationAvailabilityKey,
    async () => {
      const url = `/api/org/${organizationId}/reservas/disponibilidade?scopeType=ORGANIZATION&includeTemplates=all`;
      try {
        const payload = await fetchJson<AvailabilityResponse>(url);
        if (!payload?.ok) return undefined;
        return normalizeAvailability(payload, timezone);
      } catch {
        return undefined;
      }
    },
  );
  const availabilityOverlayByDay = useMemo(() => {
    const map = new Map<string, Interval[]>();
    const source =
      overlayMode === "scope" && singleScopeSelection
        ? selectedScopeAvailability
        : overlayMode === "general"
          ? organizationAvailability
          : undefined;
    days.forEach((day) => {
      map.set(getDayKey(day, timezone), resolveIntervalsForDay(source, day, timezone));
    });
    return map;
  }, [days, organizationAvailability, overlayMode, selectedScopeAvailability, singleScopeSelection, timezone]);
  const availabilityOverlayHint = resolveAvailabilityOverlayHint({ overlayMode, hasActiveSelection });

  const now = new Date();
  const isTodayInRange = days.some((day) => isSameDay(day, now, timezone));
  const nowTimeParts = getTimeParts(now, timezone);
  const nowTop = (nowTimeParts.hour * 60 + nowTimeParts.minute) * minuteHeight;
  const dateInputValue = formatDateParam(anchorDate, timezone);
  const visibleCountLabel = `${filteredItems.length} ${filteredItems.length === 1 ? "item visível" : "itens visíveis"}`;
  const statusSummary = useMemo(() => summarizeAgendaItemsByStatus(filteredItems), [filteredItems]);
  const operationalGuidance = useMemo(
    () =>
      buildCalendarOperationalGuidance({
        organizationId,
        operationalMode,
        capabilities: agendaCapabilities,
      }),
    [agendaCapabilities, operationalMode, organizationId],
  );
  const commandBarHint = hasActiveSelection
    ? `Escopo ativo (${selectedScopesCount}): ${selectedScopesLabel}.`
    : operationalGuidance.selectionHint;
  const commandBarActions = operationalGuidance.actions.slice(0, 2).map((action) => ({
    ...action,
    tone: action.tone === "primary" ? ("primary" as const) : ("neutral" as const),
  }));
  const hasCachedAgendaItems = (data?.items?.length ?? 0) > 0;
  const showSoftAgendaError = Boolean(error) && hasCachedAgendaItems;
  const dayHeaderFormatter = useMemo(() => getDayHeaderFormatter(timezone), [timezone]);
  const scrollWeekToMinute = (minute: number) => {
    const node = gridScrollRef.current;
    if (!node) return;
    const top = Math.max(0, minute * minuteHeight - hourHeight * 2);
    node.scrollTo({ top, behavior: "smooth" });
  };
  const jumpTimes = [8, 12, 16, 20];

  useEffect(() => {
    setSelectedAggregateKey(null);
  }, [dateInputValue, selectedCourtIds, selectedProfessionalIds, selectedResourceIds]);
  useEffect(() => {
    if (selectedAggregateKey && !aggregatesByKey.has(selectedAggregateKey)) {
      setSelectedAggregateKey(null);
    }
  }, [aggregatesByKey, selectedAggregateKey]);

  useEffect(() => {
    const node = gridScrollRef.current;
    if (!node) return;
    const nowLocal = new Date();
    const targetMinute = isTodayInRange
      ? (() => {
          const parts = getTimeParts(nowLocal, timezone);
          return parts.hour * 60 + parts.minute;
        })()
      : 8 * 60;
    const top = Math.max(0, targetMinute * minuteHeight - hourHeight * 2);
    node.scrollTo({ top, behavior: "auto" });
  }, [dateInputValue, hourHeight, isTodayInRange, minuteHeight, timezone]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "arrowleft") {
        event.preventDefault();
        shiftRange(-1);
        return;
      }
      if (key === "arrowright") {
        event.preventDefault();
        shiftRange(1);
        return;
      }
      if (key === "t") {
        event.preventDefault();
        setToday();
        return;
      }
      if (key === "g") {
        event.preventDefault();
        replaceState({ nextResources: [], nextCourts: [], nextProfessionals: [] });
        return;
      }
      if (key === "d" && dayViewHref !== "#") {
        event.preventDefault();
        router.push(dayViewHref, { scroll: false });
        return;
      }
      if (key === "m" && monthViewHref !== "#") {
        event.preventDefault();
        router.push(monthViewHref, { scroll: false });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dayViewHref, monthViewHref, router, setToday, shiftRange]);

  if (!range) {
    return <div className="p-6 text-sm text-white/70">Organização inválida.</div>;
  }

  return (
    <div className="space-y-3 p-3 md:p-4">
      <CalendarCommandBar
        view="week"
        onViewChange={setView}
        rangeLabel={range.label}
        onPrevious={() => shiftRange(-1)}
        onNext={() => shiftRange(1)}
        onToday={setToday}
        dateControl={
          <OryaDateField
            value={dateInputValue}
            onChange={(nextDateRaw) => {
              const nextDate = parseDateParam(nextDateRaw, timezone);
              if (!nextDate) return;
              replaceState({ nextDate });
            }}
            buttonClassName="rounded-full px-3 py-1 text-xs"
          />
        }
        timezoneControl={
          <label className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 text-xs text-white/80">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/55">Fuso</span>
            <select
              value={timezone}
              onChange={(event) => replaceState({ nextTimezone: event.target.value })}
              className="bg-transparent text-xs text-white/90 outline-none"
              aria-label="Selecionar fuso horário"
            >
              {CALENDAR_TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        }
        scopeControl={
          scopeSelectionEnabled ? (
            <div className="inline-flex items-center gap-2">
              <SearchableEntitySelect
                label="Treinador"
                placeholder="Treinador"
                options={professionalOptions}
                selectedIds={selectedProfessionalOptionIds}
                onChange={setSelectedProfessionals}
              />
              <SearchableEntitySelect
                label="Campo"
                placeholder="Campo/recurso"
                options={resourceOptions}
                selectedIds={selectedResourceOptionIds}
                onChange={setSelectedResourcesAndCourts}
              />
              <button
                type="button"
                onClick={clearSelections}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3 text-xs transition",
                  hasActiveSelection
                    ? "border-white/20 bg-black/35 text-white/75 hover:border-white/35 hover:text-white"
                    : "border-cyan-300/45 bg-cyan-400/14 text-cyan-100",
                )}
              >
                Geral
              </button>
            </div>
          ) : null
        }
        filterControl={
          <button
            type="button"
            onClick={() => setQuickPanelOpen((current) => !current)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3 text-xs transition",
              quickPanelOpen
                ? "border-cyan-300/45 bg-cyan-400/14 text-cyan-100"
                : "border-white/20 bg-black/35 text-white/80 hover:border-white/35 hover:text-white",
            )}
          >
            Tipos e resumo
          </button>
        }
        overlayControl={
          <button
            type="button"
            onClick={() => replaceState({ nextShowAvailabilityOverlay: !showAvailabilityOverlay })}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3 text-xs transition",
              showAvailabilityOverlay
                ? "border-cyan-300/45 bg-cyan-400/14 text-cyan-100 hover:border-cyan-300/75"
                : "border-white/20 bg-black/35 text-white/75 hover:border-white/35 hover:text-white",
            )}
          >
            Disponibilidade {showAvailabilityOverlay ? "ON" : "OFF"}
          </button>
        }
        actions={commandBarActions}
        hint={commandBarHint}
      />

      {quickPanelOpen ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-white/55">Tipo</span>
            {availableKindOptions.map((option) => {
              const isActive = visibleKinds.includes(option.value);
              return (
                <button
                  key={`week-kind-${option.value}`}
                  type="button"
                  onClick={() => toggleVisibleKind(option.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    isActive
                      ? "border-cyan-300/45 bg-cyan-400/12 text-cyan-100"
                      : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-white/55">{availabilityOverlayHint}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]" aria-live="polite">
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/75">
              Total {statusSummary.total}
            </span>
            {statusSummary.confirmed > 0 ? (
              <span className="rounded-full border border-sky-300/45 bg-sky-400/12 px-2 py-0.5 text-sky-100">
                Confirmado {statusSummary.confirmed}
              </span>
            ) : null}
            {statusSummary.pending > 0 ? (
              <span className="rounded-full border border-amber-300/45 bg-amber-400/12 px-2 py-0.5 text-amber-100">
                Pendente {statusSummary.pending}
              </span>
            ) : null}
            {statusSummary.cancelled > 0 ? (
              <span className="rounded-full border border-rose-300/45 bg-rose-400/12 px-2 py-0.5 text-rose-100">
                Cancelado/No-show {statusSummary.cancelled}
              </span>
            ) : null}
            {statusSummary.disputed > 0 ? (
              <span className="rounded-full border border-fuchsia-300/45 bg-fuchsia-400/12 px-2 py-0.5 text-fuchsia-100">
                Disputa {statusSummary.disputed}
              </span>
            ) : null}
            <span className="text-[11px] text-white/50">{visibleCountLabel}</span>
          </div>
        </section>
      ) : null}

      {showSoftAgendaError ? (
        <p className="rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          A mostrar dados anteriores da agenda enquanto a sincronização falha.
        </p>
      ) : null}

      <div className="grid gap-3">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-[0_24px_80px_rgba(3,8,20,0.45)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm font-semibold text-white">Agenda em grelha</h2>
              <p className="text-xs text-white/55">{visibleCountLabel}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {jumpTimes.map((hour) => (
                <button
                  key={`week-jump-${hour}`}
                  type="button"
                  onClick={() => scrollWeekToMinute(hour * 60)}
                  className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  {pad2(hour)}:00
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const parts = getTimeParts(new Date(), timezone);
                  scrollWeekToMinute(parts.hour * 60 + parts.minute);
                }}
                className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
              >
                Ir para agora
              </button>
              {reservationsEnabled ? (
                <Link
                  href={buildOrgHref(organizationId, "/calendar/availability")}
                  className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs text-cyan-100 transition hover:border-cyan-300/75"
                >
                  Gerir disponibilidade
                </Link>
              ) : null}
            </div>
          </div>
          <p className="mb-3 px-1 text-[11px] text-white/52">{availabilityOverlayHint}</p>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[rgba(5,10,22,0.82)]">
            <div className="overflow-x-auto">
              <div className="min-w-[880px]">
                <div
                  className="grid gap-1 border-b border-white/10 bg-[rgba(5,10,22,0.9)]"
                  style={{ gridTemplateColumns: "76px minmax(0,1fr)" }}
                >
                  <div className="h-11 border-r border-white/10" />
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((day) => {
                      const isToday = isSameDay(day, now, timezone);
                      const label = dayHeaderFormatter.format(day);
                      return (
                        <div
                          key={`calendar-header-${getDayKey(day, timezone)}`}
                          className={cn(
                            "flex h-11 items-center justify-center border border-white/10 border-b-0 bg-white/[0.06] px-2 text-[11px] font-semibold text-white/75",
                            isToday &&
                              "border-cyan-300/30 bg-[linear-gradient(145deg,rgba(34,211,238,0.22),rgba(106,123,255,0.14))] text-white",
                          )}
                        >
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  ref={gridScrollRef}
                  className="overflow-y-auto orya-scrollbar-hide"
                  style={{ height: viewportHeight, maxHeight: "calc(100dvh - 210px)" }}
                >
                  <div className="grid gap-1" style={{ gridTemplateColumns: "76px minmax(0,1fr)" }}>
                    <div
                      className="relative border-r border-white/10 bg-[rgba(7,12,25,0.65)]"
                      style={{
                        height: gridHeight,
                        backgroundImage:
                          "linear-gradient(to bottom, rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
                        backgroundSize: `100% ${hourHeight / 4}px, 100% ${hourHeight}px`,
                      }}
                    >
                      {Array.from({ length: HOUR_END - HOUR_START }, (_, index) => {
                        const hour = HOUR_START + index;
                        const top = (hour - HOUR_START) * hourHeight;
                        return (
                          <div
                            key={`hour-${hour}`}
                            className={cn(
                              "absolute right-2 text-[11px] tabular-nums text-white/52",
                              hour === HOUR_START ? "top-0" : "-translate-y-1/2",
                            )}
                            style={{ top }}
                          >
                            {pad2(hour)}:00
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {days.map((day) => {
                        const key = getDayKey(day, timezone);
                        const dayItems = aggregateByDay.get(key) ?? [];
                        const dayAvailability = availabilityOverlayByDay.get(key) ?? [];
                        const outsideIntervals = renderAvailabilityOverlay ? invertIntervals(dayAvailability) : [];
                        const isToday = isSameDay(day, now, timezone);
                        return (
                          <div
                            key={`calendar-day-${key}`}
                            className={cn(
                              "relative border border-white/10 border-t-0 bg-[rgba(8,13,24,0.86)]",
                              isToday && "ring-1 ring-inset ring-cyan-300/25",
                            )}
                            style={{
                              height: gridHeight,
                              backgroundImage:
                                "linear-gradient(to bottom, rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
                              backgroundSize: `100% ${hourHeight / 4}px, 100% ${hourHeight}px`,
                            }}
                          >
                            {outsideIntervals.map((interval) => (
                              <div
                                key={`${key}-outside-${interval.startMinute}-${interval.endMinute}`}
                                className="pointer-events-none absolute left-0 right-0 bg-[repeating-linear-gradient(135deg,rgba(2,6,14,0.18),rgba(2,6,14,0.18)_10px,rgba(255,255,255,0.02)_10px,rgba(255,255,255,0.02)_20px)]"
                                style={{
                                  top: interval.startMinute * minuteHeight,
                                  height: (interval.endMinute - interval.startMinute) * minuteHeight,
                                }}
                              />
                            ))}
                            {isToday && (
                              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(106,123,255,0.03),rgba(106,123,255,0.01))]" />
                            )}
                            {isToday && isTodayInRange && nowTop >= 0 && nowTop <= gridHeight && (
                              <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center gap-2" style={{ top: nowTop }}>
                                <span className="h-[1px] flex-1 bg-red-400/75" />
                                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">Agora</span>
                              </div>
                            )}
                            {dayItems.map((aggregate) => {
                              const summaryTitle = aggregate.items
                                .map((entry) => `${formatHourMinute(entry.start, timezone)} ${entry.item.title}`)
                                .join("\n");
                              const aggregateKey = getAggregateKey(
                                aggregate.dayKey,
                                aggregate.startMinute,
                                aggregate.endMinute,
                              );
                              const isSelected = selectedAggregateKey === aggregateKey;
                              return (
                                <article
                                  key={`${aggregate.dayKey}-${aggregate.startMinute}-${aggregate.endMinute}`}
                                  role="button"
                                  tabIndex={0}
                                  title={summaryTitle}
                                  className={cn(
                                    "absolute cursor-pointer rounded-xl border px-3 py-2 text-left text-[11px] text-white shadow-[0_20px_44px_rgba(0,0,0,0.52)] backdrop-blur-2xl",
                                    resolveAggregateTone(aggregate.items),
                                    isSelected && "ring-1 ring-cyan-200/80",
                                  )}
                                  style={{
                                    top: aggregate.top,
                                    height: aggregate.height,
                                    left: 4,
                                    width: "calc(100% - 8px)",
                                  }}
                                  onClick={() =>
                                    setSelectedAggregateKey((current) => (current === aggregateKey ? null : aggregateKey))
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      setSelectedAggregateKey((current) => (current === aggregateKey ? null : aggregateKey));
                                    }
                                  }}
                                >
                                  <p className="truncate text-[11px] font-semibold leading-tight text-white">
                                    {formatHourMinute(aggregate.start, timezone)} - {formatHourMinute(aggregate.end, timezone)} ·{" "}
                                    {aggregate.items.length} {aggregate.items.length === 1 ? "ocupação" : "ocupações"}
                                  </p>
                                  {aggregate.items.slice(0, 2).map((entry, index) => (
                                    <p
                                      key={getProjectedEntryKey(entry, index)}
                                      className="mt-0.5 truncate text-[11px] text-white/78"
                                    >
                                      {formatHourMinute(entry.start, timezone)} {entry.item.title}
                                    </p>
                                  ))}
                                  {aggregate.items.length > 2 ? (
                                    <p className="mt-0.5 text-[11px] text-white/62">+{aggregate.items.length - 2} adicionais</p>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {isLoading && (
            <p role="status" className="mt-3 text-sm text-white/70">
              A carregar agenda...
            </p>
          )}
          {error && !showSoftAgendaError && (
            <p role="alert" className="mt-3 text-sm text-red-200">
              Falha ao carregar agenda: {error.message}
            </p>
          )}
          {!isLoading && !error && filteredItems.length === 0 && (
            <p className="mt-3 text-sm text-white/55">Sem ocupação para os filtros e intervalo selecionados.</p>
          )}
        </section>
      </div>

      <ContextDrawer
        open={Boolean(selectedAggregate)}
        onClose={() => setSelectedAggregateKey(null)}
        eyebrow="Agenda semanal"
        title="Detalhe da ocupação"
        widthClassName="max-w-xl"
      >
        {selectedAggregate ? (
          <div className="space-y-3">
            <p className="text-xs text-white/70">
              {formatDateTime(selectedAggregate.start.toISOString(), timezone)} -{" "}
              {formatDateTime(selectedAggregate.end.toISOString(), timezone)}
            </p>
            <p className="text-sm text-white/75">
              {selectedAggregate.items.length} {selectedAggregate.items.length === 1 ? "ocupação" : "ocupações"}
            </p>
            <div className="space-y-2">
              {selectedAggregate.items.map((entry, index) => {
                const resourceLabel = entry.item.resourceId ? resourcesById.get(entry.item.resourceId)?.label ?? null : null;
                const courtLabel = entry.item.courtId ? courtsById.get(entry.item.courtId)?.label ?? null : null;
                const professionalLabel = entry.item.professionalId
                  ? professionalsById.get(entry.item.professionalId)?.name ?? null
                  : null;
                return (
                  <article key={getProjectedEntryKey(entry, index)} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="truncate text-sm text-white">
                      {formatHourMinute(entry.start, timezone)} {entry.item.title}
                    </p>
                    <p className="mt-1 truncate text-[11px] uppercase tracking-[0.08em] text-white/65">
                      {resolveKindLabel(entry.item.kind)} · {resolveStatusLabel(entry.item.status)}
                    </p>
                    {(resourceLabel || courtLabel || professionalLabel) && (
                      <p className="mt-1 truncate text-[11px] text-white/65">
                        {[resourceLabel, courtLabel, professionalLabel].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </ContextDrawer>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/60">
        <p>{operationalGuidance.footerHint}</p>
      </div>
    </div>
  );
}
