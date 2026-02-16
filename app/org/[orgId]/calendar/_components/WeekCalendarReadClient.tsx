"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import {
  getDateParts,
  makeUtcDateFromLocal,
  normalizeIntervals,
  resolveIntervalsForDate,
} from "@/lib/reservas/availability";

type CalendarView = "week" | "day";
type CalendarScopeMode = "exclusive" | "hybrid";
const HYBRID_MATCH_STRATEGY: "OR" | "AND" = "OR";

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
  dayOfWeek: number;
  intervals: unknown;
};

type AvailabilityOverride = {
  date: string;
  kind: string;
  intervals: unknown;
};

type AvailabilityResponse = {
  ok: boolean;
  templates?: AvailabilityTemplate[];
  overrides?: AvailabilityOverride[];
  inheritsOrganization?: boolean;
  errorCode?: string;
  message?: string;
};

type AvailabilityTarget = {
  scopeType: "RESOURCE" | "PROFESSIONAL" | "COURT";
  id: number;
  label: string;
  meta: string | null;
};

type Interval = { startMinute: number; endMinute: number };

type NormalizedAvailability = {
  templatesByDay: Map<number, Interval[]>;
  overridesByDate: Map<string, Array<{ kind: string; intervals: Interval[] }>>;
  inheritsOrganization: boolean;
};

type AvailabilityEntry = {
  target: AvailabilityTarget;
  normalized?: NormalizedAvailability;
  error?: string;
};

type PositionedAgendaItem = {
  item: AgendaItem;
  start: Date;
  end: Date;
  top: number;
  height: number;
  lane: number;
  laneCount: number;
};

const CHIP_BASE =
  "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[12px] text-white/70 transition hover:border-white/25 hover:bg-white/10 hover:text-white";
const CHIP_ACTIVE =
  "border-white/40 bg-white/18 text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)]";
const MIN_HOUR_HEIGHT = 40;
const MAX_HOUR_HEIGHT = 84;
const DEFAULT_HOUR_HEIGHT = 56;
const VISIBLE_HOURS = 10;
const HOUR_START = 0;
const HOUR_END = 24;

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

function parseScopeMode(raw: string | null): CalendarScopeMode {
  return raw === "hybrid" ? "hybrid" : "exclusive";
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

function formatRangeLabel(view: CalendarView, start: Date, timezone: string) {
  if (view === "day") {
    return new Intl.DateTimeFormat("pt-PT", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: timezone,
    }).format(start);
  }
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

function formatMinute(minute: number) {
  const normalized = Math.max(0, Math.min(24 * 60, minute));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${pad2(hours)}:${pad2(mins)}`;
}

function formatIntervals(intervals: Interval[]) {
  if (intervals.length === 0) return "Fechado";
  return intervals.map((interval) => `${formatMinute(interval.startMinute)}-${formatMinute(interval.endMinute)}`).join(" · ");
}

function normalizeAvailability(payload: AvailabilityResponse, timezone: string): NormalizedAvailability {
  const templatesByDay = new Map<number, Interval[]>();
  const overridesByDate = new Map<string, Array<{ kind: string; intervals: Interval[] }>>();

  (payload.templates ?? []).forEach((template) => {
    if (!Number.isFinite(template.dayOfWeek)) return;
    templatesByDay.set(template.dayOfWeek, normalizeIntervals(template.intervals));
  });

  (payload.overrides ?? []).forEach((override) => {
    const rawDate = new Date(override.date);
    if (Number.isNaN(rawDate.getTime())) return;
    const key = getDayKey(rawDate, timezone);
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

function resolveIntervalsForDay(normalized: NormalizedAvailability, day: Date, timezone: string) {
  const dayParts = getDateParts(day, timezone);
  const dayOfWeek = new Date(Date.UTC(dayParts.year, dayParts.month - 1, dayParts.day)).getUTCDay();
  const overrides = normalized.overridesByDate.get(getDayKey(day, timezone)) ?? [];
  return resolveIntervalsForDate({
    dayOfWeek,
    templatesByDay: normalized.templatesByDay,
    overrides,
  });
}

function overlapsDay(item: AgendaItem, dayStart: Date, dayEndExclusive: Date) {
  const startsAt = new Date(item.startsAt);
  const endsAt = new Date(item.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return false;
  return endsAt.getTime() > dayStart.getTime() && startsAt.getTime() < dayEndExclusive.getTime();
}

function countTargetItemsForDay(
  items: AgendaItem[],
  target: AvailabilityTarget,
  day: Date,
  timezone: string,
) {
  const start = buildZonedDate(getDateParts(day, timezone), timezone, 0, 0);
  const end = addDays(start, 1, timezone);
  return items.filter((item) => {
    if (target.scopeType === "RESOURCE" && item.resourceId !== target.id) return false;
    if (target.scopeType === "COURT" && item.courtId !== target.id) return false;
    if (target.scopeType === "PROFESSIONAL" && item.professionalId !== target.id) return false;
    return overlapsDay(item, start, end);
  }).length;
}

function buildAgendaPositions(params: {
  items: AgendaItem[];
  day: Date;
  timezone: string;
  minuteHeight: number;
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
    .filter(Boolean) as Array<{
    item: AgendaItem;
    start: Date;
    end: Date;
    startMinute: number;
    endMinute: number;
  }>;

  projected.sort((a, b) => {
    if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
    return a.endMinute - b.endMinute;
  });

  const clusterLaneCount = new Map<number, number>();
  let clusterId = -1;
  let active: Array<{ endMinute: number; lane: number }> = [];
  const placed: Array<PositionedAgendaItem & { clusterId: number }> = [];

  projected.forEach((entry) => {
    active = active.filter((item) => item.endMinute > entry.startMinute);
    if (active.length === 0) clusterId += 1;
    const usedLanes = new Set(active.map((item) => item.lane));
    let lane = 0;
    while (usedLanes.has(lane)) lane += 1;
    active.push({ endMinute: entry.endMinute, lane });
    const laneCount = Math.max(clusterLaneCount.get(clusterId) ?? 0, lane + 1);
    clusterLaneCount.set(clusterId, laneCount);

    placed.push({
      clusterId,
      item: entry.item,
      start: entry.start,
      end: entry.end,
      lane,
      laneCount: 1,
      top: entry.startMinute * params.minuteHeight,
      height: Math.max((entry.endMinute - entry.startMinute) * params.minuteHeight, 28),
    });
  });

  return placed.map((entry) => ({
    ...entry,
    laneCount: clusterLaneCount.get(entry.clusterId) ?? 1,
  }));
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

function formatDateTime(dateRaw: string) {
  const date = new Date(dateRaw);
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CalendarReadClient({ view }: { view: CalendarView }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  const selectedResourceIds = useMemo(() => parseIdList(searchParams.get("resources")), [searchParams]);
  const selectedCourtIds = useMemo(() => parseIdList(searchParams.get("courts")), [searchParams]);
  const selectedProfessionalIds = useMemo(
    () => parseIdList(searchParams.get("professionals")),
    [searchParams],
  );
  const scopeMode = parseScopeMode(searchParams.get("scopeMode"));
  const anchorDate = useMemo(
    () => parseDateParam(searchParams.get("date"), timezone) ?? new Date(),
    [searchParams, timezone],
  );

  const replaceState = (input: {
    nextView?: CalendarView;
    nextDate?: Date;
    nextResources?: number[];
    nextCourts?: number[];
    nextProfessionals?: number[];
    nextScopeMode?: CalendarScopeMode;
  }) => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    setIdListParam(nextParams, "resources", input.nextResources ?? selectedResourceIds);
    setIdListParam(nextParams, "courts", input.nextCourts ?? selectedCourtIds);
    setIdListParam(nextParams, "professionals", input.nextProfessionals ?? selectedProfessionalIds);
    nextParams.set("date", formatDateParam(input.nextDate ?? anchorDate, timezone));
    nextParams.set("scopeMode", input.nextScopeMode ?? scopeMode);
    const nextView = input.nextView ?? view;
    const nextPath = buildOrgHref(organizationId, nextView === "day" ? "/calendar/day" : "/calendar");
    const search = nextParams.toString();
    router.replace(search ? `${nextPath}?${search}` : nextPath, { scroll: false });
  };

  const shiftRange = (direction: -1 | 1) => {
    const amount = view === "day" ? 1 : 7;
    replaceState({ nextDate: addDays(anchorDate, direction * amount, timezone) });
  };

  const setToday = () => {
    replaceState({ nextDate: new Date() });
  };

  const toggleResource = (id: number) => {
    const next = new Set(selectedResourceIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const nextResources = [...next].sort((a, b) => a - b);
    if (scopeMode === "exclusive") {
      replaceState({ nextResources, nextProfessionals: nextResources.length > 0 ? [] : selectedProfessionalIds });
      return;
    }
    replaceState({ nextResources });
  };

  const toggleCourt = (id: number) => {
    const next = new Set(selectedCourtIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const nextCourts = [...next].sort((a, b) => a - b);
    if (scopeMode === "exclusive") {
      replaceState({ nextCourts, nextProfessionals: nextCourts.length > 0 ? [] : selectedProfessionalIds });
      return;
    }
    replaceState({ nextCourts });
  };

  const toggleProfessional = (id: number) => {
    const next = new Set(selectedProfessionalIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const nextProfessionals = [...next].sort((a, b) => a - b);
    if (scopeMode === "exclusive") {
      replaceState({
        nextProfessionals,
        nextResources: nextProfessionals.length > 0 ? [] : selectedResourceIds,
        nextCourts: nextProfessionals.length > 0 ? [] : selectedCourtIds,
      });
      return;
    }
    replaceState({ nextProfessionals });
  };

  const range = useMemo(() => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return null;
    if (view === "day") {
      const from = buildZonedDate(getDateParts(anchorDate, timezone), timezone, 0, 0);
      const to = buildZonedDate(getDateParts(anchorDate, timezone), timezone, 23, 59);
      const days = [from];
      return {
        from,
        to,
        days,
        label: formatRangeLabel(view, from, timezone),
      };
    }

    const from = getWeekStart(anchorDate, timezone);
    const days = Array.from({ length: 7 }, (_, idx) => addDays(from, idx, timezone));
    const to = buildZonedDate(getDateParts(days[6], timezone), timezone, 23, 59);
    return {
      from,
      to,
      days,
      label: formatRangeLabel(view, from, timezone),
    };
  }, [anchorDate, organizationId, timezone, view]);

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

  const items = data?.items ?? [];
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesResource = Boolean(item.resourceId && selectedResourceIds.includes(item.resourceId));
      const matchesCourt = Boolean(item.courtId && selectedCourtIds.includes(item.courtId));
      const matchesProfessional = Boolean(
        item.professionalId && selectedProfessionalIds.includes(item.professionalId),
      );

      if (scopeMode === "exclusive") {
        if (selectedProfessionalIds.length > 0) return matchesProfessional;
        if (selectedResourceIds.length > 0 || selectedCourtIds.length > 0) return matchesResource || matchesCourt;
        return true;
      }

      const dimensionChecks: boolean[] = [];
      if (selectedProfessionalIds.length > 0) dimensionChecks.push(matchesProfessional);
      if (selectedResourceIds.length > 0 || selectedCourtIds.length > 0) dimensionChecks.push(matchesResource || matchesCourt);
      if (dimensionChecks.length === 0) return true;
      if (HYBRID_MATCH_STRATEGY === "AND") return dimensionChecks.every(Boolean);
      return dimensionChecks.some(Boolean);
    });
  }, [items, scopeMode, selectedCourtIds, selectedProfessionalIds, selectedResourceIds]);

  const minuteHeight = hourHeight / 60;
  const viewportHeight = hourHeight * VISIBLE_HOURS;
  const gridHeight = (HOUR_END - HOUR_START) * hourHeight;
  const days = range?.days ?? [];
  const positionsByDay = useMemo(() => {
    const map = new Map<string, PositionedAgendaItem[]>();
    days.forEach((day) => {
      map.set(
        getDayKey(day, timezone),
        buildAgendaPositions({
          items: filteredItems,
          day,
          timezone,
          minuteHeight,
        }),
      );
    });
    return map;
  }, [days, filteredItems, minuteHeight, timezone]);

  const availabilityTargets = useMemo(() => {
    const targets: AvailabilityTarget[] = [];
    selectedResourceIds.forEach((id) => {
      const resource = resourcesById.get(id);
      if (!resource) return;
      targets.push({
        scopeType: "RESOURCE",
        id: resource.id,
        label: resource.label,
        meta: `Capacidade ${resource.capacity}`,
      });
    });
    selectedCourtIds.forEach((id) => {
      const court = courtsById.get(id);
      if (!court) return;
      targets.push({
        scopeType: "COURT",
        id: court.id,
        label: court.label,
        meta: court.clubName ? `Campo · ${court.clubName}` : "Campo de padel",
      });
    });
    selectedProfessionalIds.forEach((id) => {
      const professional = professionalsById.get(id);
      if (!professional) return;
      targets.push({
        scopeType: "PROFESSIONAL",
        id: professional.id,
        label: professional.name,
        meta: professional.roleTitle ?? null,
      });
    });
    return targets;
  }, [courtsById, professionalsById, resourcesById, selectedCourtIds, selectedProfessionalIds, selectedResourceIds]);

  const availabilityKey =
    Number.isFinite(organizationId) && organizationId > 0 && availabilityTargets.length > 0
      ? `availability:${organizationId}:${availabilityTargets
          .map((target) => `${target.scopeType}:${target.id}`)
          .join("|")}`
      : null;

  const { data: availabilityEntries, isLoading: availabilityLoading } = useSWR<AvailabilityEntry[]>(
    availabilityKey,
    async () => {
      const entries = await Promise.all(
        availabilityTargets.map(async (target) => {
          const isCourtTarget = target.scopeType === "COURT";
          const query = new URLSearchParams({
            scopeType: isCourtTarget ? "ORGANIZATION" : target.scopeType,
            ...(isCourtTarget ? {} : { scopeId: String(target.id) }),
          });
          const url = `/api/org/${organizationId}/reservas/disponibilidade?${query.toString()}`;
          try {
            const payload = await fetchJson<AvailabilityResponse>(url);
            if (!payload.ok) {
              if (isCourtTarget) {
                return { target } satisfies AvailabilityEntry;
              }
              return {
                target,
                error: payload.message || payload.errorCode || "Sem disponibilidade",
              } satisfies AvailabilityEntry;
            }
            return {
              target,
              normalized: normalizeAvailability(payload, timezone),
            } satisfies AvailabilityEntry;
          } catch (availabilityError) {
            if (isCourtTarget) {
              return { target } satisfies AvailabilityEntry;
            }
            const message =
              availabilityError instanceof Error ? availabilityError.message : "Sem disponibilidade";
            return { target, error: message } satisfies AvailabilityEntry;
          }
        }),
      );
      return entries;
    },
  );

  const now = new Date();
  const isTodayInRange = days.some((day) => isSameDay(day, now, timezone));
  const nowTimeParts = getTimeParts(now, timezone);
  const nowTop = (nowTimeParts.hour * 60 + nowTimeParts.minute) * minuteHeight;
  const dateInputValue = formatDateParam(anchorDate, timezone);
  const visibleCountLabel = `${filteredItems.length} ${filteredItems.length === 1 ? "item visível" : "itens visíveis"}`;
  const selectedResourceOrCourtCount = selectedResourceIds.length + selectedCourtIds.length;

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
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            <input
              type="date"
              value={dateInputValue}
              onChange={(event) => {
                const nextDate = parseDateParam(event.target.value, timezone);
                if (!nextDate) return;
                replaceState({ nextDate });
              }}
              className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs text-white/85 outline-none transition focus:border-cyan-300/70"
              aria-label="Selecionar data"
            />
            <span className="text-sm font-medium text-white">{range.label}</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-white/45">Fuso: {timezone}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => replaceState({ nextView: "week" })}
              className={cn(CHIP_BASE, view === "week" && CHIP_ACTIVE)}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => replaceState({ nextView: "day" })}
              className={cn(CHIP_BASE, view === "day" && CHIP_ACTIVE)}
            >
              Dia
            </button>
            <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Zoom</span>
              <input
                type="range"
                min={MIN_HOUR_HEIGHT}
                max={MAX_HOUR_HEIGHT}
                step={2}
                value={hourHeight}
                onChange={(event) => setHourHeight(Number(event.target.value))}
                className="h-1 w-24 cursor-pointer accent-white/70"
                aria-label="Zoom do calendário"
              />
            </div>
            <button
              type="button"
              onClick={() => replaceState({ nextResources: [], nextCourts: [] })}
              className={cn(CHIP_BASE, selectedResourceOrCourtCount === 0 && CHIP_ACTIVE)}
            >
              Todos recursos/campos
            </button>
            <button
              type="button"
              onClick={() => replaceState({ nextProfessionals: [] })}
              className={cn(CHIP_BASE, selectedProfessionalIds.length === 0 && CHIP_ACTIVE)}
            >
              Todos profissionais
            </button>
            <div className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => {
                  if (selectedProfessionalIds.length > 0 && selectedResourceOrCourtCount > 0) {
                    replaceState({ nextScopeMode: "exclusive", nextResources: [], nextCourts: [] });
                    return;
                  }
                  replaceState({ nextScopeMode: "exclusive" });
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] transition",
                  scopeMode === "exclusive" ? "bg-cyan-300/25 text-cyan-100" : "text-white/60 hover:text-white/90",
                )}
              >
                Modo A
              </button>
              <button
                type="button"
                onClick={() => replaceState({ nextScopeMode: "hybrid" })}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] transition",
                  scopeMode === "hybrid" ? "bg-cyan-300/25 text-cyan-100" : "text-white/60 hover:text-white/90",
                )}
              >
                Modo B
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">Recursos</p>
            <div className="mt-2 flex max-h-[140px] flex-wrap gap-2 overflow-y-auto pr-1">
              {activeResources.length === 0 && <span className="text-xs text-white/40">Sem recursos ativos.</span>}
              {activeResources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => toggleResource(resource.id)}
                  className={cn(CHIP_BASE, selectedResourceIds.includes(resource.id) && CHIP_ACTIVE)}
                  title={`Capacidade ${resource.capacity}`}
                >
                  {resource.label} · {resource.capacity}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">Campos</p>
            <div className="mt-2 flex max-h-[140px] flex-wrap gap-2 overflow-y-auto pr-1">
              {activeCourts.length === 0 && <span className="text-xs text-white/40">Sem campos ativos.</span>}
              {activeCourts.map((court) => (
                <button
                  key={`court-${court.id}`}
                  type="button"
                  onClick={() => toggleCourt(court.id)}
                  className={cn(CHIP_BASE, selectedCourtIds.includes(court.id) && CHIP_ACTIVE)}
                  title={court.clubName ?? undefined}
                >
                  {court.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">Profissionais</p>
            <div className="mt-2 flex max-h-[140px] flex-wrap gap-2 overflow-y-auto pr-1">
              {activeProfessionals.length === 0 && <span className="text-xs text-white/40">Sem profissionais ativos.</span>}
              {activeProfessionals.map((professional) => (
                <button
                  key={professional.id}
                  type="button"
                  onClick={() => toggleProfessional(professional.id)}
                  className={cn(CHIP_BASE, selectedProfessionalIds.includes(professional.id) && CHIP_ACTIVE)}
                >
                  {professional.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 shadow-[0_24px_80px_rgba(3,8,20,0.45)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm font-semibold text-white">Agenda em grelha</h2>
              <p className="text-xs text-white/55">{visibleCountLabel}</p>
            </div>
            <Link
              href={buildOrgHref(organizationId, "/bookings/availability")}
              className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs text-cyan-100 transition hover:border-cyan-300/75"
            >
              Gerir disponibilidade em Bookings
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[rgba(5,10,22,0.82)]">
            <div className="overflow-x-auto">
              <div className={cn("min-w-[880px]", view === "day" && "min-w-[540px]")}> 
                <div
                  className="grid gap-1 border-b border-white/10 bg-[rgba(5,10,22,0.9)]"
                  style={{ gridTemplateColumns: "72px minmax(0,1fr)" }}
                >
                  <div className="h-11 border-r border-white/10" />
                  <div className={cn("grid gap-1", view === "week" ? "grid-cols-7" : "grid-cols-1")}>
                    {days.map((day) => {
                      const isToday = isSameDay(day, now, timezone);
                      const label = new Intl.DateTimeFormat("pt-PT", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        timeZone: timezone,
                      }).format(day);
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

                <div className="overflow-y-auto orya-scrollbar-hide" style={{ height: viewportHeight, maxHeight: "calc(100vh - 320px)" }}>
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

                    <div className={cn("grid gap-1", view === "week" ? "grid-cols-7" : "grid-cols-1")}>
                      {days.map((day) => {
                        const key = getDayKey(day, timezone);
                        const dayItems = positionsByDay.get(key) ?? [];
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
                            {isToday && (
                              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(107,255,255,0.08),rgba(106,123,255,0.03),rgba(106,123,255,0.01))]" />
                            )}
                            {isToday && isTodayInRange && nowTop >= 0 && nowTop <= gridHeight && (
                              <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center gap-2" style={{ top: nowTop }}>
                                <span className="h-[1px] flex-1 bg-red-400/75" />
                                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white">Agora</span>
                              </div>
                            )}
                            {dayItems.map((position) => {
                              const width = 100 / position.laneCount;
                              const left = position.lane * width;
                              const statusLabel = resolveStatusLabel(position.item.status);
                              const kindLabel = resolveKindLabel(position.item.kind);
                              const resourceLabel = position.item.resourceId
                                ? resourcesById.get(position.item.resourceId)?.label ?? null
                                : null;
                              const courtLabel = position.item.courtId
                                ? courtsById.get(position.item.courtId)?.label ?? null
                                : null;
                              const professionalLabel = position.item.professionalId
                                ? professionalsById.get(position.item.professionalId)?.name ?? null
                                : null;
                              return (
                                <article
                                  key={`${position.item.kind}-${position.item.title}-${position.start.toISOString()}-${position.end.toISOString()}-${left}`}
                                  className={cn(
                                    "absolute rounded-xl border px-3 py-2 text-left text-[11px] text-white shadow-[0_20px_44px_rgba(0,0,0,0.52)] backdrop-blur-2xl",
                                    resolveCardTone(position.item),
                                  )}
                                  style={{
                                    top: position.top,
                                    height: position.height,
                                    left: `calc(${left}% + 4px)`,
                                    width: `calc(${width}% - 8px)`,
                                  }}
                                >
                                  <p className="truncate text-[11px] font-semibold leading-tight text-white">
                                    {position.item.title}
                                  </p>
                                  <p className="mt-1 text-[10px] text-white/80">
                                    {formatDateTime(position.start.toISOString())} - {formatDateTime(position.end.toISOString())}
                                  </p>
                                  <p className="mt-1 truncate text-[10px] uppercase tracking-[0.08em] text-white/65">
                                    {kindLabel} · {statusLabel}
                                  </p>
                                  {(resourceLabel || courtLabel || professionalLabel) && (
                                    <p className="mt-1 truncate text-[10px] text-white/70">
                                      {[resourceLabel, courtLabel, professionalLabel].filter(Boolean).join(" · ")}
                                    </p>
                                  )}
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
          {isLoading && <p className="mt-3 text-sm text-white/70">A carregar agenda...</p>}
          {error && <p className="mt-3 text-sm text-red-200">Falha ao carregar agenda: {error.message}</p>}
          {!isLoading && !error && filteredItems.length === 0 && (
            <p className="mt-3 text-sm text-white/55">Sem ocupação para os filtros e intervalo selecionados.</p>
          )}
        </section>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_24px_80px_rgba(3,8,20,0.45)]">
          <h2 className="text-sm font-semibold text-white">Disponibilidade por seleção</h2>
          <p className="mt-1 text-xs text-white/60">
            Seleciona múltiplos recursos/profissionais para comparar disponibilidade por dia.
          </p>

          {availabilityTargets.length === 0 && (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/55">
              Sem seleção ativa. Escolhe recursos ou profissionais para carregar disponibilidade.
            </p>
          )}

          {availabilityLoading && (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
              A carregar disponibilidade...
            </p>
          )}

          <div className="mt-3 space-y-3">
            {(availabilityEntries ?? []).map((entry) => (
              <article key={`${entry.target.scopeType}-${entry.target.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <header className="mb-2">
                  <p className="text-xs font-semibold text-white">
                    {entry.target.label}
                    <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-white/55">
                      {entry.target.scopeType === "RESOURCE"
                        ? "Recurso"
                        : entry.target.scopeType === "COURT"
                          ? "Campo"
                          : "Profissional"}
                    </span>
                  </p>
                  {entry.target.meta && <p className="text-[11px] text-white/55">{entry.target.meta}</p>}
                  {entry.normalized?.inheritsOrganization && (
                    <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/70">
                      Herda template da organização
                    </p>
                  )}
                </header>

                {entry.error && <p className="text-xs text-red-200">{entry.error}</p>}
                {!entry.error && entry.normalized && (
                  <div className="space-y-2">
                    {days.map((day) => {
                      const intervals = resolveIntervalsForDay(entry.normalized as NormalizedAvailability, day, timezone);
                      const occupancy = countTargetItemsForDay(filteredItems, entry.target, day, timezone);
                      const dayLabel = new Intl.DateTimeFormat("pt-PT", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        timeZone: timezone,
                      }).format(day);
                      return (
                        <div key={`${entry.target.scopeType}-${entry.target.id}-${getDayKey(day, timezone)}`} className="rounded-lg border border-white/10 bg-black/20 p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-white/90">{dayLabel}</span>
                            <span className="text-[10px] text-white/55">
                              {occupancy} {occupancy === 1 ? "ocupação" : "ocupações"}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-white/70">{formatIntervals(intervals)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!entry.error && !entry.normalized && entry.target.scopeType === "COURT" && (
                  <div className="space-y-2">
                    {days.map((day) => {
                      const occupancy = countTargetItemsForDay(filteredItems, entry.target, day, timezone);
                      const dayLabel = new Intl.DateTimeFormat("pt-PT", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        timeZone: timezone,
                      }).format(day);
                      return (
                        <div
                          key={`${entry.target.scopeType}-${entry.target.id}-${getDayKey(day, timezone)}-court-summary`}
                          className="rounded-lg border border-white/10 bg-black/20 p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-white/90">{dayLabel}</span>
                            <span className="text-[10px] text-white/55">
                              {occupancy} {occupancy === 1 ? "ocupação" : "ocupações"}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-white/60">Disponibilidade herdada da organização.</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        </aside>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/60">
        <p>
          Escrita operacional continua em <strong>Bookings</strong>. O calendário é a leitura consolidada com foco em operação diária e semanal.
        </p>
      </div>
    </div>
  );
}
