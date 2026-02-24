"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDateParts } from "@/lib/reservas/availability";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { ContextDrawer } from "@/components/ui/context-drawer";
import { buildCalendarOperationalGuidance } from "../operationalGuidance";
import {
  addDays,
  buildActiveFilterChips,
  buildZonedDate,
  countAppliedFilters,
  enrichAgendaItems,
  fetchJson,
  filterEvents,
  formatDateParam,
  getDayKey,
  normalizeAvailability,
  parseDateParam,
  parseIdList,
  resolveIntervalsForDay,
  setIdListParam,
  DEFAULT_HOUR_HEIGHT,
} from "./helpers";
import { emptyFilters, cloneFilters } from "./filterConfig";
import { CalendarHeader } from "./CalendarHeader";
import { FiltersDrawer } from "./FiltersDrawer";
import { DayGrid } from "./DayGrid";
import { CALENDAR_TIMEZONE_OPTIONS, normalizeCalendarTimezone } from "../timezones";
import { summarizeAgendaItemsByStatus } from "../statusSummary";
import type {
  AvailabilityResponse,
  AgendaResponse,
  CalendarColumn,
  CollectionResponse,
  ProfessionalItem,
  ResourceItem,
  ReservationListResponse,
  ServiceItem,
} from "./types";

const PROFESSIONAL_OPTION_PREFIX = "P:";
const RESOURCE_OPTION_PREFIX = "R:";
const COURT_OPTION_PREFIX = "C:";
const ALL_KIND_FILTER_OPTIONS = [
  { value: "RESERVATION", label: "Reserva" },
  { value: "CLASS", label: "Aula" },
  { value: "EVENT", label: "Evento" },
  { value: "TOURNAMENT", label: "Torneio" },
] as const;
const DATE_TIME_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getDateTimeFormatter(timezone: string) {
  const cached = DATE_TIME_FORMATTER_CACHE.get(timezone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
  DATE_TIME_FORMATTER_CACHE.set(timezone, formatter);
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

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return element.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function formatDateTime(value: string, timezone: string) {
  const date = new Date(value);
  return getDateTimeFormatter(timezone).format(date);
}

function resolveStatusLabel(status: string) {
  const normalized = status.trim().toUpperCase();
  if (normalized === "CONFIRMED") return "Confirmado";
  if (normalized === "COMPLETED") return "Concluído";
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION") return "Pendente";
  if (normalized === "NO_SHOW") return "No-show";
  if (normalized === "DISPUTED") return "Disputa";
  if (normalized.startsWith("CANCELLED")) return "Cancelado";
  return status;
}

function resolveKindLabel(kind: "EVENT" | "TOURNAMENT" | "RESERVATION" | "CLASS") {
  if (kind === "RESERVATION") return "Reserva";
  if (kind === "CLASS") return "Aula";
  if (kind === "TOURNAMENT") return "Torneio";
  return "Evento";
}

type ColumnSeed = {
  id: string;
  entityKind: "PROFESSIONAL" | "RESOURCE" | "COURT" | "GENERAL";
  entityId: number;
  label: string;
  subtitle: string | null;
  avatarUrl: string | null;
};

function buildColumnSeeds(params: {
  selectedProfessionalIds: number[];
  selectedResourceIds: number[];
  selectedCourtIds: number[];
  professionals: ProfessionalItem[];
  resources: ResourceItem[];
  courts: ResourceItem[];
}): ColumnSeed[] {
  const professionalMap = new Map(params.professionals.map((item) => [item.id, item]));
  const resourceMap = new Map(params.resources.map((item) => [item.id, item]));
  const courtMap = new Map(params.courts.map((item) => [item.id, item]));
  const seeds: ColumnSeed[] = [];

  const pushProfessional = (id: number) => {
    const professional = professionalMap.get(id);
    if (!professional) return;
    seeds.push({
      id: `P-${professional.id}`,
      entityKind: "PROFESSIONAL",
      entityId: professional.id,
      label: professional.name,
      subtitle: professional.roleTitle ?? professional.user?.fullName ?? null,
      avatarUrl: professional.user?.avatarUrl ?? null,
    });
  };

  const pushResource = (id: number) => {
    const resource = resourceMap.get(id);
    if (!resource) return;
    seeds.push({
      id: `R-${resource.id}`,
      entityKind: "RESOURCE",
      entityId: resource.id,
      label: resource.label,
      subtitle: `Capacidade ${resource.capacity}`,
      avatarUrl: null,
    });
  };

  const pushCourt = (id: number) => {
    const court = courtMap.get(id);
    if (!court) return;
    seeds.push({
      id: `C-${court.id}`,
      entityKind: "COURT",
      entityId: court.id,
      label: court.label,
      subtitle: court.clubName ? `Campo · ${court.clubName}` : "Campo de padel",
      avatarUrl: null,
    });
  };

  params.selectedProfessionalIds.forEach(pushProfessional);
  params.selectedResourceIds.forEach(pushResource);
  params.selectedCourtIds.forEach(pushCourt);
  if (seeds.length > 0) return seeds;

  return [
    {
      id: "GENERAL",
      entityKind: "GENERAL" as const,
      entityId: 0,
      label: "Geral",
      subtitle: "Calendário consolidado",
      avatarUrl: null,
    },
  ];
}

export default function DayCalendarReadClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const timezone = useMemo(
    () => normalizeCalendarTimezone(searchParams.get("tz")),
    [searchParams],
  );

  const selectedProfessionalIds = useMemo(() => parseIdList(searchParams.get("professionals")), [searchParams]);
  const selectedResourceIds = useMemo(() => parseIdList(searchParams.get("resources")), [searchParams]);
  const selectedCourtIds = useMemo(() => parseIdList(searchParams.get("courts")), [searchParams]);
  const selectedDate = useMemo(
    () => parseDateParam(searchParams.get("date"), timezone) ?? new Date(),
    [searchParams, timezone],
  );

  const [hourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleKinds, setVisibleKinds] = useState<Array<(typeof ALL_KIND_FILTER_OPTIONS)[number]["value"]>>(
    ALL_KIND_FILTER_OPTIONS.map((option) => option.value),
  );
  const [appliedFilters, setAppliedFilters] = useState(() => emptyFilters());
  const [draftFilters, setDraftFilters] = useState(() => emptyFilters());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const hoverLeaveTimeoutRef = useRef<number | null>(null);

  const cancelHoverLeaveTimeout = () => {
    if (hoverLeaveTimeoutRef.current === null) return;
    window.clearTimeout(hoverLeaveTimeoutRef.current);
    hoverLeaveTimeoutRef.current = null;
  };

  const handleHoverEventChange = (event: { id: string } | null) => {
    if (event) {
      cancelHoverLeaveTimeout();
      setHoveredEventId((current) => (current === event.id ? current : event.id));
      return;
    }
    cancelHoverLeaveTimeout();
    hoverLeaveTimeoutRef.current = window.setTimeout(() => {
      setHoveredEventId(null);
      hoverLeaveTimeoutRef.current = null;
    }, 90);
  };

  const replaceState = (input: {
    nextDate?: Date;
    nextProfessionals?: number[];
    nextResources?: number[];
    nextCourts?: number[];
    nextTimezone?: string;
  }) => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    setIdListParam(nextParams, "professionals", input.nextProfessionals ?? selectedProfessionalIds);
    setIdListParam(nextParams, "resources", input.nextResources ?? selectedResourceIds);
    setIdListParam(nextParams, "courts", input.nextCourts ?? selectedCourtIds);
    const nextTimezone = normalizeCalendarTimezone(input.nextTimezone ?? timezone);
    nextParams.set("tz", nextTimezone);
    const nextDate =
      input.nextDate ??
      (input.nextTimezone
        ? buildZonedDate(getDateParts(selectedDate, timezone), nextTimezone, 12, 0)
        : selectedDate);
    nextParams.set("date", formatDateParam(nextDate, nextTimezone));
    nextParams.delete("scopeMode");
    const nextPath = buildOrgHref(organizationId, "/calendar/day");
    const search = nextParams.toString();
    router.replace(search ? `${nextPath}?${search}` : nextPath, { scroll: false });
  };
  const shiftDay = (direction: -1 | 1) => {
    replaceState({ nextDate: addDays(selectedDate, direction, timezone) });
  };
  const setToday = () => {
    replaceState({ nextDate: new Date() });
  };
  const clearSelections = () => {
    replaceState({ nextProfessionals: [], nextResources: [], nextCourts: [] });
  };
  const weekViewHref = useMemo(() => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return "#";
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", formatDateParam(selectedDate, timezone));
    nextParams.set("tz", timezone);
    nextParams.delete("scopeMode");
    const nextPath = buildOrgHref(organizationId, "/calendar");
    const search = nextParams.toString();
    return search ? `${nextPath}?${search}` : nextPath;
  }, [organizationId, searchParams, selectedDate, timezone]);

  const dayStart = useMemo(
    () => buildZonedDate(getDateParts(selectedDate, timezone), timezone, 0, 0),
    [selectedDate, timezone],
  );
  const dayEndExclusive = useMemo(() => addDays(dayStart, 1, timezone), [dayStart, timezone]);
  const bookingsFrom = useMemo(() => addDays(dayStart, -1, timezone), [dayStart, timezone]);
  const bookingsTo = useMemo(() => addDays(dayEndExclusive, 1, timezone), [dayEndExclusive, timezone]);

  const agendaUrl =
    Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/agenda?${new URLSearchParams({
          from: dayStart.toISOString(),
          to: dayEndExclusive.toISOString(),
        }).toString()}`
      : null;

  const { data: agendaData, error: agendaError, isLoading: agendaLoading } = useSWR<AgendaResponse>(agendaUrl, fetchJson);
  const agendaCapabilities = agendaData?.capabilities ?? null;
  const operationalMode = agendaData?.operationalMode ?? null;
  const reservationsCapability = agendaCapabilities?.reservas;
  const reservationsEnabled = reservationsCapability === true;
  const scopeSelectionEnabled = reservationsCapability !== false;

  const reservationsUrl =
    reservationsEnabled && Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/reservas?${new URLSearchParams({
          from: bookingsFrom.toISOString(),
          to: bookingsTo.toISOString(),
        }).toString()}`
      : null;
  // Estes endpoints continuam no domínio de reservas e só são usados quando a ferramenta está ativa.
  const professionalsUrl =
    reservationsEnabled && Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/reservas/profissionais`
      : null;
  const resourcesUrl =
    reservationsEnabled && Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/reservas/recursos?${new URLSearchParams({
          includeCourts: "1",
        }).toString()}`
      : null;
  const servicesUrl =
    reservationsEnabled && Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/servicos`
      : null;

  const { data: reservationsData } = useSWR<ReservationListResponse>(reservationsUrl, fetchJson);
  const { data: professionalsData } = useSWR<CollectionResponse<ProfessionalItem>>(professionalsUrl, fetchJson);
  const { data: resourcesData } = useSWR<CollectionResponse<ResourceItem>>(resourcesUrl, fetchJson);
  const { data: servicesData } = useSWR<CollectionResponse<ServiceItem>>(servicesUrl, fetchJson);

  const activeProfessionals = useMemo(
    () => (professionalsData?.items ?? []).filter((item) => item.isActive),
    [professionalsData?.items],
  );
  const activeResources = useMemo(
    () => (resourcesData?.items ?? []).filter((item) => item.isActive && (item.sourceType ?? "RESOURCE") === "RESOURCE"),
    [resourcesData?.items],
  );
  const activeCourts = useMemo(
    () => (resourcesData?.items ?? []).filter((item) => item.isActive && item.sourceType === "COURT"),
    [resourcesData?.items],
  );
  const activeServices = useMemo(
    () => (servicesData?.items ?? []).filter((item) => item.isActive),
    [servicesData?.items],
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

  const columnSeeds = useMemo(
    () =>
      buildColumnSeeds({
        selectedProfessionalIds,
        selectedResourceIds,
        selectedCourtIds,
        professionals: activeProfessionals,
        resources: activeResources,
        courts: activeCourts,
      }),
    [activeCourts, activeProfessionals, activeResources, selectedCourtIds, selectedProfessionalIds, selectedResourceIds],
  );

  const availabilityKey =
    reservationsEnabled && Number.isFinite(organizationId) && organizationId > 0 && columnSeeds.length > 0
      ? `day-availability:${organizationId}:${getDayKey(selectedDate, timezone)}:${columnSeeds
          .map((seed) => `${seed.entityKind}:${seed.entityId}`)
          .join("|")}`
      : null;

  const { data: availabilityMap } = useSWR<Record<string, ReturnType<typeof normalizeAvailability> | undefined>>(
    availabilityKey,
    async () => {
      const entries = await Promise.all(
        columnSeeds.map(async (seed) => {
          if (seed.entityKind === "COURT" || seed.entityKind === "GENERAL") {
            return [seed.id, undefined] as const;
          }
          const query = new URLSearchParams({
            scopeType: seed.entityKind,
            scopeId: String(seed.entityId),
          });
          query.set("includeTemplates", "all");
          const url = `/api/org/${organizationId}/reservas/disponibilidade?${query.toString()}`;
          try {
            const payload = await fetchJson<AvailabilityResponse>(url);
            if (!payload?.ok) return [seed.id, undefined] as const;
            return [seed.id, normalizeAvailability(payload, timezone)] as const;
          } catch {
            return [seed.id, undefined] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  );
  const organizationAvailabilityKey =
    reservationsEnabled && Number.isFinite(organizationId) && organizationId > 0
      ? `org-availability:${organizationId}`
      : null;
  const { data: organizationAvailability } = useSWR<ReturnType<typeof normalizeAvailability> | undefined>(
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

  const columns = useMemo<CalendarColumn[]>(
    () =>
      columnSeeds.map((seed) => {
        const normalized =
          seed.entityKind === "COURT" || seed.entityKind === "GENERAL"
            ? organizationAvailability
            : availabilityMap?.[seed.id];
        const intervals = resolveIntervalsForDay(normalized, selectedDate, timezone);
        return {
          id: seed.id,
          entityKind: seed.entityKind,
          entityId: seed.entityId,
          label: seed.label,
          subtitle: seed.subtitle,
          avatarUrl: seed.avatarUrl,
          workingIntervals: intervals,
        };
      }),
    [availabilityMap, columnSeeds, organizationAvailability, selectedDate, timezone],
  );

  const enrichedEvents = useMemo(
    () => enrichAgendaItems(agendaData?.items ?? [], reservationsData?.items ?? []),
    [agendaData?.items, reservationsData?.items],
  );

  const scopedEvents = useMemo(() => {
    return enrichedEvents.filter((event) => {
      const matchesProfessional = Boolean(event.professionalId && selectedProfessionalIds.includes(event.professionalId));
      const matchesResource = Boolean(event.resourceId && selectedResourceIds.includes(event.resourceId));
      const matchesCourt = Boolean(event.courtId && selectedCourtIds.includes(event.courtId));
      const hasAnySelection =
        scopeSelectionEnabled &&
        (selectedProfessionalIds.length > 0 || selectedResourceIds.length > 0 || selectedCourtIds.length > 0);
      if (!hasAnySelection) return true;
      return matchesProfessional || matchesResource || matchesCourt;
    });
  }, [enrichedEvents, scopeSelectionEnabled, selectedCourtIds, selectedProfessionalIds, selectedResourceIds]);

  const filteredEventsBase = useMemo(
    () => filterEvents(scopedEvents, appliedFilters, timezone),
    [appliedFilters, scopedEvents, timezone],
  );
  const filteredEvents = useMemo(
    () => filteredEventsBase.filter((event) => visibleKinds.includes(event.kind)),
    [filteredEventsBase, visibleKinds],
  );
  const statusSummary = useMemo(() => summarizeAgendaItemsByStatus(filteredEvents), [filteredEvents]);
  const operationalGuidance = useMemo(
    () =>
      buildCalendarOperationalGuidance({
        organizationId,
        operationalMode,
        capabilities: agendaCapabilities,
      }),
    [agendaCapabilities, operationalMode, organizationId],
  );
  const filteredEventsById = useMemo(() => new Map(filteredEvents.map((event) => [event.id, event])), [filteredEvents]);

  const professionalOptions = useMemo(
    () =>
      activeProfessionals.map((professional) => ({
        id: encodeOptionId(PROFESSIONAL_OPTION_PREFIX, professional.id),
        label: professional.name,
        subtitle: professional.roleTitle,
        avatarUrl: professional.user?.avatarUrl ?? null,
      })),
    [activeProfessionals],
  );

  const resourceOptions = useMemo(
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

  const serviceLabels = useMemo(
    () => new Map(activeServices.map((service) => [service.id, service.title])),
    [activeServices],
  );
  const professionalLabels = useMemo(
    () => new Map(activeProfessionals.map((professional) => [professional.id, professional.name])),
    [activeProfessionals],
  );
  const resourceLabels = useMemo(
    () => new Map(activeResources.map((resource) => [resource.id, resource.label])),
    [activeResources],
  );
  const courtLabels = useMemo(() => new Map(activeCourts.map((court) => [court.id, court.label])), [activeCourts]);

  const activeFilterChips = useMemo(
    () =>
      buildActiveFilterChips({
        filters: appliedFilters,
        serviceLabels,
        professionalLabels,
      }),
    [appliedFilters, professionalLabels, serviceLabels],
  );
  const removeAppliedFilterChip = (chipId: string) => {
    setAppliedFilters((current) => {
      const next = cloneFilters(current);
      if (chipId.startsWith("status-")) {
        const value = chipId.slice("status-".length);
        next.statuses = next.statuses.filter((item) => item !== value);
        return next;
      }
      if (chipId.startsWith("type-")) {
        const value = chipId.slice("type-".length);
        next.bookingTypes = next.bookingTypes.filter((item) => item !== value);
        return next;
      }
      if (chipId.startsWith("channel-")) {
        const value = chipId.slice("channel-".length);
        next.channels = next.channels.filter((item) => item !== value);
        return next;
      }
      if (chipId.startsWith("payment-")) {
        const value = chipId.slice("payment-".length);
        next.paymentStatuses = next.paymentStatuses.filter((item) => item !== value);
        return next;
      }
      if (chipId.startsWith("service-")) {
        const value = Number(chipId.slice("service-".length));
        next.serviceIds = next.serviceIds.filter((item) => item !== value);
        return next;
      }
      if (chipId === "created") {
        next.createdFrom = null;
        next.createdTo = null;
        return next;
      }
      if (chipId.startsWith("requested-")) {
        const value = Number(chipId.slice("requested-".length));
        next.requestedProfessionalIds = next.requestedProfessionalIds.filter((item) => item !== value);
        return next;
      }
      return next;
    });
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
  const hasActiveSelection =
    scopeSelectionEnabled &&
    (selectedProfessionalIds.length > 0 || selectedResourceIds.length > 0 || selectedCourtIds.length > 0);
  const selectedScopesCount =
    scopeSelectionEnabled ? selectedProfessionalIds.length + selectedResourceIds.length + selectedCourtIds.length : 0;
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
  const selectedEvent = selectedEventId ? filteredEventsById.get(selectedEventId) ?? null : null;
  const hoveredEvent = hoveredEventId ? filteredEventsById.get(hoveredEventId) ?? null : null;
  const hoverPreviewEvent = selectedEvent ? null : hoveredEvent;

  useEffect(() => {
    if (!selectedEventId) return;
    if (!filteredEventsById.has(selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [filteredEventsById, selectedEventId]);
  useEffect(() => {
    if (!hoveredEventId) return;
    if (!filteredEventsById.has(hoveredEventId)) {
      setHoveredEventId(null);
    }
  }, [filteredEventsById, hoveredEventId]);
  useEffect(() => {
    return () => {
      if (hoverLeaveTimeoutRef.current !== null) {
        window.clearTimeout(hoverLeaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "arrowleft") {
        event.preventDefault();
        shiftDay(-1);
        return;
      }
      if (key === "arrowright") {
        event.preventDefault();
        shiftDay(1);
        return;
      }
      if (key === "t") {
        event.preventDefault();
        setToday();
        return;
      }
      if (key === "f") {
        event.preventDefault();
        setDraftFilters(cloneFilters(appliedFilters));
        setFiltersOpen(true);
        return;
      }
      if (key === "g") {
        event.preventDefault();
        replaceState({ nextProfessionals: [], nextResources: [], nextCourts: [] });
        return;
      }
      if (key === "w" && weekViewHref !== "#") {
        event.preventDefault();
        router.push(weekViewHref, { scroll: false });
        return;
      }
      if (key === "escape") {
        setSelectedEventId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appliedFilters, router, setToday, shiftDay, weekViewHref]);

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return <div className="p-6 text-sm text-white/70">Organização inválida.</div>;
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <section className="rounded-2xl border border-white/10 bg-[linear-gradient(150deg,rgba(34,211,238,0.14),rgba(16,24,39,0.82))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/70">{operationalGuidance.badge}</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Calendário operacional</h1>
            <p className="mt-2 text-sm text-white/80">{operationalGuidance.description}</p>
            <p className="mt-2 text-xs text-white/60">{operationalGuidance.title}</p>
          </div>
          {operationalGuidance.actions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {operationalGuidance.actions.map((action) => (
                <Link
                  key={`day-guidance-action-${action.id}`}
                  href={action.href}
                  className={
                    action.tone === "primary"
                      ? "rounded-full border border-cyan-300/45 bg-cyan-400/12 px-3 py-1.5 text-xs text-cyan-100 transition hover:border-cyan-300/75"
                      : "rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
                  }
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-white/58">
            {hasActiveSelection
              ? `Seleção ativa (${selectedScopesCount}): ${selectedScopesLabel}.`
              : operationalGuidance.selectionHint}
          </p>
          {scopeSelectionEnabled && hasActiveSelection ? (
            <button
              type="button"
              onClick={clearSelections}
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 transition hover:border-white/35 hover:text-white"
            >
              Limpar seleção
            </button>
          ) : null}
        </div>
      </section>

      <CalendarHeader
        date={selectedDate}
        timezone={timezone}
        timezoneOptions={CALENDAR_TIMEZONE_OPTIONS}
        onTimezoneChange={(nextTimezone) => replaceState({ nextTimezone })}
        datePickerOpen={datePickerOpen}
        onDatePickerOpenChange={setDatePickerOpen}
        onSelectDate={(date) => replaceState({ nextDate: date })}
        onToday={setToday}
        onPreviousDay={() => shiftDay(-1)}
        onNextDay={() => shiftDay(1)}
        professionalOptions={professionalOptions}
        resourceOptions={resourceOptions}
        selectedProfessionalIds={selectedProfessionalOptionIds}
        selectedResourceIds={selectedResourceOptionIds}
        onSelectProfessional={(optionIds) => {
          const nextProfessionalIds = decodePrefixedIds(optionIds, PROFESSIONAL_OPTION_PREFIX);
          replaceState({ nextProfessionals: nextProfessionalIds });
        }}
        onSelectResource={(optionIds) => {
          const nextResourceIds = decodePrefixedIds(optionIds, RESOURCE_OPTION_PREFIX);
          const nextCourtIds = decodePrefixedIds(optionIds, COURT_OPTION_PREFIX);
          replaceState({ nextResources: nextResourceIds, nextCourts: nextCourtIds });
        }}
        onResetSelections={clearSelections}
        scopeSelectionEnabled={scopeSelectionEnabled}
        scopeSelectionHint={operationalGuidance.selectionHint}
        hasActiveSelection={hasActiveSelection}
        onOpenFilters={() => {
          setDraftFilters(cloneFilters(appliedFilters));
          setFiltersOpen(true);
        }}
        activeFilterCount={countAppliedFilters(appliedFilters)}
      />

      {activeFilterChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => removeAppliedFilterChip(chip.id)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:border-white/30 hover:text-white"
              aria-label={`Remover filtro ${chip.label}`}
            >
              {chip.label}
              <span className="text-[11px] text-white/55">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAppliedFilters(emptyFilters())}
            className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/75 transition hover:border-white/35 hover:text-white"
          >
            Limpar filtros
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/50">Tipo</span>
        {availableKindOptions.map((option) => {
          const isActive = visibleKinds.includes(option.value);
          return (
            <button
              key={`kind-${option.value}`}
              type="button"
              onClick={() => toggleVisibleKind(option.value)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                isActive
                  ? "border-cyan-300/45 bg-cyan-400/12 text-cyan-100"
                  : "border-white/15 bg-white/5 text-white/70 hover:border-white/30 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {!agendaLoading && !agendaError ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px]" aria-live="polite">
          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-white/80">
            {statusSummary.total} {statusSummary.total === 1 ? "ocupação visível" : "ocupações visíveis"}
          </span>
          {statusSummary.confirmed > 0 ? (
            <span className="rounded-full border border-emerald-300/45 bg-emerald-400/12 px-2 py-1 text-emerald-100">
              Confirmado {statusSummary.confirmed}
            </span>
          ) : null}
          {statusSummary.pending > 0 ? (
            <span className="rounded-full border border-amber-300/45 bg-amber-400/12 px-2 py-1 text-amber-100">
              Pendente {statusSummary.pending}
            </span>
          ) : null}
          {statusSummary.cancelled > 0 ? (
            <span className="rounded-full border border-rose-300/45 bg-rose-400/12 px-2 py-1 text-rose-100">
              Cancelado/No-show {statusSummary.cancelled}
            </span>
          ) : null}
          {statusSummary.disputed > 0 ? (
            <span className="rounded-full border border-fuchsia-300/45 bg-fuchsia-400/12 px-2 py-1 text-fuchsia-100">
              Disputa {statusSummary.disputed}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="h-[92px]">
          {hoverPreviewEvent ? (
            <article className="h-full rounded-xl border border-cyan-300/25 bg-cyan-400/8 p-3">
              <p className="truncate text-sm font-semibold text-cyan-100">{hoverPreviewEvent.title}</p>
              <p className="mt-1 truncate text-[11px] text-cyan-50/85">
                {formatDateTime(hoverPreviewEvent.startsAt, timezone)} - {formatDateTime(hoverPreviewEvent.endsAt, timezone)}
              </p>
              <p className="mt-1 truncate text-[10px] uppercase tracking-[0.08em] text-cyan-50/70">
                {resolveKindLabel(hoverPreviewEvent.kind)} · {resolveStatusLabel(hoverPreviewEvent.status)}
              </p>
            </article>
          ) : (
            <article className="h-full rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs text-white/60">
                Passa o cursor sobre uma ocupação para pré-visualizar sem abrir o detalhe.
              </p>
              <p className="mt-1 text-[11px] text-white/45">Click numa ocupação para fixar no painel lateral.</p>
            </article>
          )}
        </div>

        <div>
          <DayGrid
            date={selectedDate}
            timezone={timezone}
            columns={columns}
            events={filteredEvents}
            hourHeight={hourHeight}
            selectedEventId={selectedEvent?.id ?? null}
            onHoverEventChange={handleHoverEventChange}
            onSelectEvent={(event) => {
              setSelectedEventId((current) => (current === event.id ? null : event.id));
            }}
          />

          {agendaLoading ? (
            <p role="status" className="mt-3 text-sm text-white/65">
              A carregar agenda...
            </p>
          ) : null}
          {agendaError ? (
            <p role="alert" className="mt-3 text-sm text-rose-200">
              Falha ao carregar agenda: {agendaError.message}
            </p>
          ) : null}
          {!agendaLoading && !agendaError && filteredEvents.length === 0 ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/65">
              <p>Sem itens de agenda para os filtros e data selecionados.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={setToday}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
                >
                  Ir para hoje
                </button>
                {activeFilterChips.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setAppliedFilters(emptyFilters())}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
                  >
                    Limpar filtros
                  </button>
                ) : null}
                {hasActiveSelection ? (
                  <button
                    type="button"
                    onClick={clearSelections}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
                  >
                    Mostrar geral
                  </button>
                ) : null}
                {operationalGuidance.actions.map((action) => (
                  <Link
                    key={`day-empty-action-${action.id}`}
                    href={action.href}
                    className={
                      action.tone === "primary"
                        ? "rounded-full border border-cyan-300/45 bg-cyan-400/12 px-3 py-1 text-xs text-cyan-100 transition hover:border-cyan-300/75"
                        : "rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
                    }
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ContextDrawer
        open={Boolean(selectedEvent)}
        onClose={() => setSelectedEventId(null)}
        eyebrow="Agenda diária"
        title="Detalhe da ocupação"
        widthClassName="max-w-xl"
      >
        {selectedEvent ? (
          <article className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-semibold text-white">{selectedEvent.title}</p>
            <p className="text-[11px] text-white/75">
              {formatDateTime(selectedEvent.startsAt, timezone)} - {formatDateTime(selectedEvent.endsAt, timezone)}
            </p>
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/65">
              {resolveKindLabel(selectedEvent.kind)} · {resolveStatusLabel(selectedEvent.status)}
            </p>

            <div className="space-y-1 text-[11px] text-white/70">
              {selectedEvent.serviceTitle ? <p>Serviço: {selectedEvent.serviceTitle}</p> : null}
              {selectedEvent.professionalId ? (
                <p>Profissional: {professionalLabels.get(selectedEvent.professionalId) ?? `#${selectedEvent.professionalId}`}</p>
              ) : null}
              {selectedEvent.resourceId ? (
                <p>Recurso: {resourceLabels.get(selectedEvent.resourceId) ?? `#${selectedEvent.resourceId}`}</p>
              ) : null}
              {selectedEvent.courtId ? <p>Campo: {courtLabels.get(selectedEvent.courtId) ?? `#${selectedEvent.courtId}`}</p> : null}
            </div>
          </article>
        ) : null}
      </ContextDrawer>

      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        appliedFilters={appliedFilters}
        draftFilters={draftFilters}
        onDraftFiltersChange={setDraftFilters}
        onApply={() => setAppliedFilters(cloneFilters(draftFilters))}
        onClear={() => setDraftFilters(emptyFilters())}
        services={activeServices}
        professionals={activeProfessionals}
      />
    </div>
  );
}
