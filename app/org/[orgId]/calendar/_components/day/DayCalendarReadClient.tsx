"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDateParts } from "@/lib/reservas/availability";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { cn } from "@/lib/utils";
import { ContextDrawer } from "@/components/ui/context-drawer";
import { OryaDateField } from "@/components/ui/datetime";
import { CalendarCommandBar } from "../CalendarCommandBar";
import type { CalendarView } from "../ViewSwitcher";
import { resolveAvailabilityOverlayHint, resolveAvailabilityOverlayState } from "../availabilityOverlayMode";
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
import { SearchableEntitySelect } from "./SearchableEntitySelect";
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
  availabilityScopeId?: number | null;
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
      availabilityScopeId: null,
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
      availabilityScopeId: resource.availabilityScopeId ?? resource.resourceId ?? resource.id,
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
      availabilityScopeId: court.availabilityScopeId ?? court.resourceId ?? null,
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
      availabilityScopeId: null,
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
  const selectedScopesCountRaw = selectedProfessionalIds.length + selectedResourceIds.length + selectedCourtIds.length;

  const [hourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickPanelOpen, setQuickPanelOpen] = useState(false);
  const [visibleKinds, setVisibleKinds] = useState<Array<(typeof ALL_KIND_FILTER_OPTIONS)[number]["value"]>>(
    ALL_KIND_FILTER_OPTIONS.map((option) => option.value),
  );
  const [appliedFilters, setAppliedFilters] = useState(() => emptyFilters());
  const [draftFilters, setDraftFilters] = useState(() => emptyFilters());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const replaceState = (input: {
    nextDate?: Date;
    nextProfessionals?: number[];
    nextResources?: number[];
    nextCourts?: number[];
    nextTimezone?: string;
    nextShowAvailabilityOverlay?: boolean;
    nextView?: CalendarView;
  }) => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    setIdListParam(nextParams, "professionals", input.nextProfessionals ?? selectedProfessionalIds);
    setIdListParam(nextParams, "resources", input.nextResources ?? selectedResourceIds);
    setIdListParam(nextParams, "courts", input.nextCourts ?? selectedCourtIds);
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
        ? buildZonedDate(getDateParts(selectedDate, timezone), nextTimezone, 12, 0)
        : selectedDate);
    nextParams.set("date", formatDateParam(nextDate, nextTimezone));
    nextParams.set("view", input.nextView ?? "day");
    nextParams.delete("scopeMode");
    const nextPath = buildOrgHref(organizationId, "/calendar");
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
  const setView = (nextView: CalendarView) => {
    replaceState({ nextView });
  };
  const weekViewHref = useMemo(() => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return "#";
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", formatDateParam(selectedDate, timezone));
    nextParams.set("tz", timezone);
    nextParams.set("view", "week");
    nextParams.delete("scopeMode");
    const nextPath = buildOrgHref(organizationId, "/calendar");
    const search = nextParams.toString();
    return search ? `${nextPath}?${search}` : nextPath;
  }, [organizationId, searchParams, selectedDate, timezone]);
  const monthViewHref = useMemo(() => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return "#";
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("date", formatDateParam(selectedDate, timezone));
    nextParams.set("tz", timezone);
    nextParams.set("view", "month");
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
  const hasActiveSelection = scopeSelectionEnabled && selectedScopesCountRaw > 0;
  const selectedScopesCount = scopeSelectionEnabled ? selectedScopesCountRaw : 0;
  const hasSingleScopeSelection = scopeSelectionEnabled && selectedScopesCount === 1;
  const { showAvailabilityOverlay, overlayMode, renderAvailabilityOverlay } =
    resolveAvailabilityOverlayState({
      showAvailabilityOverlayParam: searchParams.get("showAvailabilityOverlay"),
      hasSingleScopeSelection,
    });

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
          if (seed.entityKind === "GENERAL") {
            return [seed.id, undefined] as const;
          }
          const scopeType = seed.entityKind === "COURT" ? "RESOURCE" : seed.entityKind;
          const scopeId = seed.entityKind === "COURT" ? seed.availabilityScopeId : seed.entityId;
          if (!scopeId || !Number.isFinite(scopeId) || scopeId <= 0) {
            return [seed.id, undefined] as const;
          }
          const query = new URLSearchParams({
            scopeType,
            scopeId: String(scopeId),
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
          overlayMode === "general"
            ? organizationAvailability
            : seed.entityKind === "GENERAL"
              ? organizationAvailability
              : availabilityMap?.[seed.id] ?? (seed.entityKind === "COURT" ? organizationAvailability : undefined);
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
    [availabilityMap, columnSeeds, organizationAvailability, overlayMode, selectedDate, timezone],
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
  const availabilityOverlayHint = resolveAvailabilityOverlayHint({ overlayMode, hasActiveSelection });
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

  useEffect(() => {
    if (!selectedEventId) return;
    if (!filteredEventsById.has(selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [filteredEventsById, selectedEventId]);

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
      if (key === "m" && monthViewHref !== "#") {
        event.preventDefault();
        router.push(monthViewHref, { scroll: false });
        return;
      }
      if (key === "escape") {
        setSelectedEventId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appliedFilters, monthViewHref, router, setToday, shiftDay, weekViewHref]);

  const dayRangeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-PT", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: timezone,
      }).format(selectedDate),
    [selectedDate, timezone],
  );
  const dateInputValue = formatDateParam(selectedDate, timezone);
  const commandBarHint = hasActiveSelection
    ? `Escopo ativo (${selectedScopesCount}): ${selectedScopesLabel}.`
    : operationalGuidance.selectionHint;
  const commandBarActions = operationalGuidance.actions.slice(0, 2).map((action) => ({
    ...action,
    tone: action.tone === "primary" ? ("primary" as const) : ("neutral" as const),
  }));
  const hasCachedAgendaItems = (agendaData?.items?.length ?? 0) > 0;
  const showSoftAgendaError = Boolean(agendaError) && hasCachedAgendaItems;

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return <div className="p-6 text-sm text-white/70">Organização inválida.</div>;
  }

  return (
    <div className="space-y-3 p-3 md:p-4">
      <CalendarCommandBar
        view="day"
        onViewChange={setView}
        rangeLabel={dayRangeLabel}
        onPrevious={() => shiftDay(-1)}
        onNext={() => shiftDay(1)}
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
                onChange={(optionIds) => {
                  const nextProfessionalIds = decodePrefixedIds(optionIds, PROFESSIONAL_OPTION_PREFIX);
                  replaceState({ nextProfessionals: nextProfessionalIds });
                }}
              />
              <SearchableEntitySelect
                label="Campo"
                placeholder="Campo/recurso"
                options={resourceOptions}
                selectedIds={selectedResourceOptionIds}
                onChange={(optionIds) => {
                  const nextResourceIds = decodePrefixedIds(optionIds, RESOURCE_OPTION_PREFIX);
                  const nextCourtIds = decodePrefixedIds(optionIds, COURT_OPTION_PREFIX);
                  replaceState({ nextResources: nextResourceIds, nextCourts: nextCourtIds });
                }}
              />
              <button
                type="button"
                onClick={clearSelections}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-3 text-xs transition",
                  hasActiveSelection
                    ? "border-white/20 bg-black/35 text-white/75 hover:border-white/35 hover:text-white"
                    : "border-cyan-300/45 bg-cyan-400/15 text-cyan-100",
                )}
              >
                Geral
              </button>
            </div>
          ) : null
        }
        filterControl={
          <div className="inline-flex items-center gap-2">
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
            <button
              type="button"
              onClick={() => {
                setDraftFilters(cloneFilters(appliedFilters));
                setFiltersOpen(true);
              }}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 text-xs text-white/80 transition hover:border-white/35 hover:text-white"
            >
              Filtros
              {countAppliedFilters(appliedFilters) > 0 ? (
                <span className="rounded-full bg-cyan-300/20 px-1.5 text-[10px] text-cyan-100">
                  {countAppliedFilters(appliedFilters)}
                </span>
              ) : null}
            </button>
          </div>
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
                  key={`kind-${option.value}`}
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
            <span className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-white/80">
              {statusSummary.total} {statusSummary.total === 1 ? "ocupação visível" : "ocupações visíveis"}
            </span>
            {statusSummary.confirmed > 0 ? (
              <span className="rounded-full border border-sky-300/45 bg-sky-400/12 px-2 py-1 text-sky-100">
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
          {activeFilterChips.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
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
        </section>
      ) : null}

      {showSoftAgendaError ? (
        <p className="rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          A mostrar dados anteriores da agenda enquanto a sincronização falha.
        </p>
      ) : null}

      <div className="grid gap-3">
        <div>
          <DayGrid
            date={selectedDate}
            timezone={timezone}
            columns={columns}
            events={filteredEvents}
            showAvailabilityOverlay={renderAvailabilityOverlay}
            availabilityOverlayHint={availabilityOverlayHint}
            hourHeight={hourHeight}
            selectedEventId={selectedEvent?.id ?? null}
            onSelectEvent={(event) => {
              setSelectedEventId((current) => (current === event.id ? null : event.id));
            }}
          />

          {agendaLoading ? (
            <p role="status" className="mt-3 text-sm text-white/65">
              A carregar agenda...
            </p>
          ) : null}
          {agendaError && !showSoftAgendaError ? (
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
