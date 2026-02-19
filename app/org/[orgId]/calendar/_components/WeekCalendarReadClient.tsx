"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { ContextDrawer } from "@/components/ui/context-drawer";
import { OryaDateField } from "@/components/ui/datetime";
import { SearchableEntitySelect, type SearchableEntityOption } from "./day/SearchableEntitySelect";
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

type AgendaItem = {
  kind: "EVENT" | "TOURNAMENT" | "RESERVATION";
  eventId?: number | null;
  tournamentId?: number | null;
  reservationId?: number | null;
  courtId?: number | null;
  resourceId?: number | null;
  professionalId?: number | null;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

type AgendaResponse = {
  ok: boolean;
  items: AgendaItem[];
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

const CHIP_BASE =
  "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[12px] text-white/70 transition hover:border-white/25 hover:bg-white/10 hover:text-white";
const CHIP_ACTIVE =
  "border-white/40 bg-white/18 text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)]";
const DEFAULT_HOUR_HEIGHT = 56;
const VISIBLE_HOURS = 10;
const HOUR_START = 0;
const HOUR_END = 24;
const PROFESSIONAL_OPTION_PREFIX = "P:";
const RESOURCE_OPTION_PREFIX = "R:";
const COURT_OPTION_PREFIX = "C:";
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
  if (kind === "TOURNAMENT") return "Torneio";
  return "Evento";
}

function resolveCardTone(item: AgendaItem) {
  const status = item.status.trim().toUpperCase();
  if (status.startsWith("CANCELLED") || status === "NO_SHOW") {
    return "border-rose-300/60 bg-[linear-gradient(135deg,rgba(244,63,94,0.24),rgba(244,63,94,0.08))]";
  }
  if (status === "PENDING" || status === "PENDING_CONFIRMATION") {
    return "border-amber-200/60 bg-[linear-gradient(135deg,rgba(251,191,36,0.26),rgba(251,191,36,0.09))]";
  }
  if (item.kind === "TOURNAMENT") {
    return "border-cyan-200/55 bg-[linear-gradient(135deg,rgba(34,211,238,0.26),rgba(14,116,144,0.12))]";
  }
  if (item.kind === "EVENT") {
    return "border-fuchsia-200/55 bg-[linear-gradient(135deg,rgba(217,70,239,0.24),rgba(126,34,206,0.1))]";
  }
  return "border-emerald-300/55 bg-[linear-gradient(135deg,rgba(16,185,129,0.3),rgba(16,185,129,0.12))]";
}

function resolveAggregateTone(items: ProjectedAgendaItem[]) {
  if (items.length === 0) {
    return "border-white/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))]";
  }
  const cancelled = items.find((entry) => {
    const status = entry.item.status.trim().toUpperCase();
    return status.startsWith("CANCELLED") || status === "NO_SHOW";
  });
  if (cancelled) return resolveCardTone(cancelled.item);
  const pending = items.find((entry) => {
    const status = entry.item.status.trim().toUpperCase();
    return status === "PENDING" || status === "PENDING_CONFIRMATION";
  });
  if (pending) return resolveCardTone(pending.item);
  return resolveCardTone(items[0].item);
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
  const [hoveredAggregateKey, setHoveredAggregateKey] = useState<string | null>(null);
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
  }) => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    setIdListParam(nextParams, "resources", input.nextResources ?? selectedResourceIds);
    setIdListParam(nextParams, "courts", input.nextCourts ?? selectedCourtIds);
    setIdListParam(nextParams, "professionals", input.nextProfessionals ?? selectedProfessionalIds);
    const nextTimezone = normalizeCalendarTimezone(input.nextTimezone ?? timezone);
    nextParams.set("tz", nextTimezone);
    const nextDate =
      input.nextDate ??
      (input.nextTimezone
        ? buildZonedDate(getDateParts(anchorDate, timezone), nextTimezone, 12, 0)
        : anchorDate);
    nextParams.set("date", formatDateParam(nextDate, nextTimezone));
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

  const resourcesUrl = Number.isFinite(organizationId) && organizationId > 0
    ? `/api/org/${organizationId}/reservas/recursos?${new URLSearchParams({
        includeCourts: "1",
      }).toString()}`
    : null;
  const professionalsUrl = Number.isFinite(organizationId) && organizationId > 0
    ? `/api/org/${organizationId}/reservas/profissionais`
    : null;

  const { data, error, isLoading } = useSWR<AgendaResponse>(apiUrl, fetchJson);
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
  const hasActiveSelection =
    selectedProfessionalIds.length > 0 || selectedResourceIds.length > 0 || selectedCourtIds.length > 0;
  const selectedScopesCount =
    selectedProfessionalIds.length + selectedResourceIds.length + selectedCourtIds.length;
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
    nextParams.delete("scopeMode");
    const nextPath = buildOrgHref(organizationId, "/calendar/day");
    const search = nextParams.toString();
    return search ? `${nextPath}?${search}` : nextPath;
  }, [anchorDate, organizationId, searchParams, timezone]);

  const items = data?.items ?? [];
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesResource = Boolean(item.resourceId && selectedResourceIds.includes(item.resourceId));
      const matchesCourt = Boolean(item.courtId && selectedCourtIds.includes(item.courtId));
      const matchesProfessional = Boolean(
        item.professionalId && selectedProfessionalIds.includes(item.professionalId),
      );
      const hasAnySelection =
        selectedProfessionalIds.length > 0 || selectedResourceIds.length > 0 || selectedCourtIds.length > 0;
      if (!hasAnySelection) return true;
      return matchesProfessional || matchesResource || matchesCourt;
    });
  }, [items, selectedCourtIds, selectedProfessionalIds, selectedResourceIds]);

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
  const hoveredAggregate = hoveredAggregateKey ? aggregatesByKey.get(hoveredAggregateKey) ?? null : null;

  const organizationAvailabilityKey =
    Number.isFinite(organizationId) && organizationId > 0 ? `org-availability:${organizationId}` : null;
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
  const organizationAvailabilityByDay = useMemo(() => {
    const map = new Map<string, Interval[]>();
    days.forEach((day) => {
      map.set(getDayKey(day, timezone), resolveIntervalsForDay(organizationAvailability, day, timezone));
    });
    return map;
  }, [days, organizationAvailability, timezone]);

  const now = new Date();
  const isTodayInRange = days.some((day) => isSameDay(day, now, timezone));
  const nowTimeParts = getTimeParts(now, timezone);
  const nowTop = (nowTimeParts.hour * 60 + nowTimeParts.minute) * minuteHeight;
  const dateInputValue = formatDateParam(anchorDate, timezone);
  const visibleCountLabel = `${filteredItems.length} ${filteredItems.length === 1 ? "item visível" : "itens visíveis"}`;
  const statusSummary = useMemo(() => summarizeAgendaItemsByStatus(filteredItems), [filteredItems]);
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
    setHoveredAggregateKey(null);
  }, [dateInputValue, selectedCourtIds, selectedProfessionalIds, selectedResourceIds]);
  useEffect(() => {
    if (selectedAggregateKey && !aggregatesByKey.has(selectedAggregateKey)) {
      setSelectedAggregateKey(null);
    }
    if (hoveredAggregateKey && !aggregatesByKey.has(hoveredAggregateKey)) {
      setHoveredAggregateKey(null);
    }
  }, [aggregatesByKey, hoveredAggregateKey, selectedAggregateKey]);

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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dayViewHref, router, setToday, shiftRange]);

  if (!range) {
    return <div className="p-6 text-sm text-white/70">Organização inválida.</div>;
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-2xl border border-white/10 bg-[linear-gradient(150deg,rgba(107,255,255,0.14),rgba(16,24,39,0.82))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">Calendar</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Calendário operacional</h1>
        <p className="mt-2 text-sm text-white/70">
          Vista operacional read-first com grelha real, navegação por data, e filtros múltiplos por recurso e profissional.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => shiftRange(-1)}
              className={CHIP_BASE}
              title="Anterior"
              aria-label="Intervalo anterior"
            >
              ←
            </button>
            <button type="button" onClick={setToday} className={CHIP_BASE}>
              Hoje
            </button>
            <button
              type="button"
              onClick={() => shiftRange(1)}
              className={CHIP_BASE}
              title="Seguinte"
              aria-label="Intervalo seguinte"
            >
              →
            </button>
            <OryaDateField
              value={dateInputValue}
              onChange={(nextDateRaw) => {
                const nextDate = parseDateParam(nextDateRaw, timezone);
                if (!nextDate) return;
                replaceState({ nextDate });
              }}
              buttonClassName="rounded-full px-3 py-1 text-xs"
            />
            <span className="text-sm font-medium text-white">{range.label}</span>
            <label className="flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs text-white/80">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/55">Fuso</span>
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
          </div>

        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SearchableEntitySelect
            label="Equipa ou profissional"
            placeholder="Equipa/profissional"
            options={professionalOptions}
            selectedIds={selectedProfessionalOptionIds}
            onChange={setSelectedProfessionals}
          />
          <SearchableEntitySelect
            label="Recurso"
            placeholder="Recurso"
            options={resourceOptions}
            selectedIds={selectedResourceOptionIds}
            onChange={setSelectedResourcesAndCourts}
          />
          <button
            type="button"
            onClick={clearSelections}
            className={cn(CHIP_BASE, !hasActiveSelection && CHIP_ACTIVE)}
          >
            Geral
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-white/58">
            {hasActiveSelection
              ? `Seleção ativa (${selectedScopesCount}): ${selectedScopesLabel}.`
              : "Sem seleção ativa: modo geral consolidado."}
          </p>
          <div className="flex items-center gap-2">
            {hasActiveSelection ? (
              <button
                type="button"
                onClick={clearSelections}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 transition hover:border-white/35 hover:text-white"
              >
                Limpar seleção
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-[0_24px_80px_rgba(3,8,20,0.45)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm font-semibold text-white">Agenda em grelha</h2>
              <p className="text-xs text-white/55">{visibleCountLabel}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]" aria-live="polite">
                <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-white/75">
                  Total {statusSummary.total}
                </span>
                {statusSummary.confirmed > 0 ? (
                  <span className="rounded-full border border-emerald-300/45 bg-emerald-400/12 px-2 py-0.5 text-emerald-100">
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
              </div>
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
              <Link
                href={buildOrgHref(organizationId, "/bookings/availability")}
                className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs text-cyan-100 transition hover:border-cyan-300/75"
              >
                Gerir disponibilidade em Bookings
              </Link>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 px-1 text-[10px] text-white/65">
            <span className="rounded-full border border-emerald-300/45 bg-emerald-400/12 px-2 py-0.5 text-emerald-100">Confirmado</span>
            <span className="rounded-full border border-amber-300/45 bg-amber-400/12 px-2 py-0.5 text-amber-100">Pendente</span>
            <span className="rounded-full border border-rose-300/45 bg-rose-400/12 px-2 py-0.5 text-rose-100">Cancelado/No-show</span>
            <span className="rounded-full border border-fuchsia-300/45 bg-fuchsia-400/12 px-2 py-0.5 text-fuchsia-100">Disputa</span>
            <span className="text-white/45">Click fixa detalhe · hover pré-visualiza</span>
          </div>
          {hoveredAggregate && !selectedAggregate && (
            <article className="mb-3 rounded-xl border border-cyan-300/25 bg-cyan-400/8 p-3">
              <p className="text-xs font-semibold text-cyan-100">
                Pré-visualização: {formatHourMinute(hoveredAggregate.start, timezone)} -{" "}
                {formatHourMinute(hoveredAggregate.end, timezone)}
              </p>
              <p className="mt-1 text-[11px] text-cyan-50/80">
                {hoveredAggregate.items.length} {hoveredAggregate.items.length === 1 ? "ocupação" : "ocupações"}
              </p>
              {hoveredAggregate.items.slice(0, 2).map((entry, index) => (
                <p key={getProjectedEntryKey(entry, index)} className="truncate text-[11px] text-cyan-50/75">
                  {formatHourMinute(entry.start, timezone)} {entry.item.title}
                </p>
              ))}
            </article>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[rgba(5,10,22,0.82)]">
            <div className="overflow-x-auto">
              <div className="min-w-[880px]">
                <div
                  className="grid gap-1 border-b border-white/10 bg-[rgba(5,10,22,0.9)]"
                  style={{ gridTemplateColumns: "72px minmax(0,1fr)" }}
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
                              "border-cyan-300/30 bg-[linear-gradient(145deg,rgba(107,255,255,0.22),rgba(106,123,255,0.14))] text-white",
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
                  style={{ height: viewportHeight, maxHeight: "calc(100vh - 320px)" }}
                >
                  <div className="grid gap-1" style={{ gridTemplateColumns: "72px minmax(0,1fr)" }}>
                    <div
                      className="relative border-r border-white/10 bg-[rgba(7,12,25,0.65)]"
                      style={{
                        height: gridHeight,
                        backgroundImage:
                          "linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
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
                              "absolute right-2 text-[10px] font-mono tracking-[0.1em] text-white/42",
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
                        const dayAvailability = organizationAvailabilityByDay.get(key) ?? [];
                        const outsideIntervals = invertIntervals(dayAvailability);
                        const isToday = isSameDay(day, now, timezone);
                        return (
                          <div
                            key={`calendar-day-${key}`}
                            className={cn(
                              "relative border border-white/10 border-t-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))]",
                              isToday && "ring-1 ring-inset ring-cyan-300/25",
                            )}
                            style={{
                              height: gridHeight,
                              backgroundImage:
                                "linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
                              backgroundSize: `100% ${hourHeight / 4}px, 100% ${hourHeight}px`,
                            }}
                          >
                            {outsideIntervals.map((interval) => (
                              <div
                                key={`${key}-outside-${interval.startMinute}-${interval.endMinute}`}
                                className="pointer-events-none absolute left-0 right-0 border-y border-white/5 bg-[repeating-linear-gradient(135deg,rgba(4,8,16,0.7),rgba(4,8,16,0.7)_8px,rgba(255,255,255,0.06)_8px,rgba(255,255,255,0.06)_16px)]"
                                style={{
                                  top: interval.startMinute * minuteHeight,
                                  height: (interval.endMinute - interval.startMinute) * minuteHeight,
                                }}
                              />
                            ))}
                            {isToday && (
                              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(107,255,255,0.08),rgba(106,123,255,0.03),rgba(106,123,255,0.01))]" />
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
                                  onMouseEnter={() => setHoveredAggregateKey(aggregateKey)}
                                  onMouseLeave={() =>
                                    setHoveredAggregateKey((current) => (current === aggregateKey ? null : current))
                                  }
                                  onClick={() =>
                                    setSelectedAggregateKey((current) => (current === aggregateKey ? null : aggregateKey))
                                  }
                                  onFocus={() => setHoveredAggregateKey(aggregateKey)}
                                  onBlur={() =>
                                    setHoveredAggregateKey((current) => (current === aggregateKey ? null : current))
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
                                  {aggregate.items.slice(0, 3).map((entry, index) => (
                                    <p
                                      key={getProjectedEntryKey(entry, index)}
                                      className="mt-0.5 truncate text-[10px] text-white/80"
                                    >
                                      {formatHourMinute(entry.start, timezone)} {entry.item.title}
                                    </p>
                                  ))}
                                  {aggregate.items.length > 3 ? (
                                    <p className="mt-0.5 text-[10px] text-white/65">+{aggregate.items.length - 3} adicionais</p>
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
          {error && (
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
        <p>
          Escrita operacional continua em <strong>Bookings</strong>. O calendário é a leitura consolidada com foco em operação diária e semanal.
        </p>
      </div>
    </div>
  );
}
