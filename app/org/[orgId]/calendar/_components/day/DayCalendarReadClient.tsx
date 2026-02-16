"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getDateParts } from "@/lib/reservas/availability";
import { buildOrgHref } from "@/lib/organizationIdUtils";
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
import type {
  AvailabilityResponse,
  AgendaResponse,
  CalendarColumn,
  CalendarScopeMode,
  CollectionResponse,
  ProfessionalItem,
  ResourceItem,
  ReservationListResponse,
  ServiceItem,
} from "./types";

const DEFAULT_FALLBACK_COLUMNS = 2;
const HYBRID_MATCH_STRATEGY: "OR" | "AND" =
  process.env.NEXT_PUBLIC_CALENDAR_HYBRID_MATCH_STRATEGY === "OR" ? "OR" : "AND";

const PROFESSIONAL_OPTION_PREFIX = "P:";
const RESOURCE_OPTION_PREFIX = "R:";
const COURT_OPTION_PREFIX = "C:";

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

type ColumnSeed = {
  id: string;
  entityKind: "PROFESSIONAL" | "RESOURCE" | "COURT";
  entityId: number;
  label: string;
  subtitle: string | null;
  avatarUrl: string | null;
};

function parseScopeMode(raw: string | null): CalendarScopeMode {
  return raw === "hybrid" ? "hybrid" : "exclusive";
}

function buildColumnSeeds(params: {
  selectedProfessionalIds: number[];
  selectedResourceIds: number[];
  selectedCourtIds: number[];
  scopeMode: CalendarScopeMode;
  professionals: ProfessionalItem[];
  resources: ResourceItem[];
  courts: ResourceItem[];
}) {
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

  if (params.scopeMode === "exclusive") {
    if (params.selectedProfessionalIds.length > 0) {
      params.selectedProfessionalIds.forEach(pushProfessional);
      return seeds;
    }
    if (params.selectedResourceIds.length > 0) {
      params.selectedResourceIds.forEach(pushResource);
      return seeds;
    }
    if (params.selectedCourtIds.length > 0) {
      params.selectedCourtIds.forEach(pushCourt);
      return seeds;
    }
  } else {
    params.selectedProfessionalIds.forEach(pushProfessional);
    params.selectedResourceIds.forEach(pushResource);
    params.selectedCourtIds.forEach(pushCourt);
    if (seeds.length > 0) return seeds;
  }

  params.professionals.slice(0, DEFAULT_FALLBACK_COLUMNS).forEach((professional) => {
    seeds.push({
      id: `P-${professional.id}`,
      entityKind: "PROFESSIONAL",
      entityId: professional.id,
      label: professional.name,
      subtitle: professional.roleTitle ?? professional.user?.fullName ?? null,
      avatarUrl: professional.user?.avatarUrl ?? null,
    });
  });
  if (seeds.length > 0) return seeds;

  params.resources.slice(0, DEFAULT_FALLBACK_COLUMNS).forEach((resource) => {
    seeds.push({
      id: `R-${resource.id}`,
      entityKind: "RESOURCE",
      entityId: resource.id,
      label: resource.label,
      subtitle: `Capacidade ${resource.capacity}`,
      avatarUrl: null,
    });
  });
  if (seeds.length > 0) return seeds;

  params.courts.slice(0, DEFAULT_FALLBACK_COLUMNS).forEach((court) => {
    seeds.push({
      id: `C-${court.id}`,
      entityKind: "COURT",
      entityId: court.id,
      label: court.label,
      subtitle: court.clubName ? `Campo · ${court.clubName}` : "Campo de padel",
      avatarUrl: null,
    });
  });
  return seeds;
}

export default function DayCalendarReadClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgIdRaw = Array.isArray(params?.orgId) ? params.orgId[0] : params?.orgId;
  const organizationId = Number(orgIdRaw);
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  const selectedProfessionalIds = useMemo(() => parseIdList(searchParams.get("professionals")), [searchParams]);
  const selectedResourceIds = useMemo(() => parseIdList(searchParams.get("resources")), [searchParams]);
  const selectedCourtIds = useMemo(() => parseIdList(searchParams.get("courts")), [searchParams]);
  const scopeMode = parseScopeMode(searchParams.get("scopeMode"));
  const selectedDate = useMemo(
    () => parseDateParam(searchParams.get("date"), timezone) ?? new Date(),
    [searchParams, timezone],
  );

  const [hourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(() => emptyFilters());
  const [draftFilters, setDraftFilters] = useState(() => emptyFilters());

  const replaceState = (input: {
    nextDate?: Date;
    nextProfessionals?: number[];
    nextResources?: number[];
    nextCourts?: number[];
    nextScopeMode?: CalendarScopeMode;
  }) => {
    if (!Number.isFinite(organizationId) || organizationId <= 0) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    setIdListParam(nextParams, "professionals", input.nextProfessionals ?? selectedProfessionalIds);
    setIdListParam(nextParams, "resources", input.nextResources ?? selectedResourceIds);
    setIdListParam(nextParams, "courts", input.nextCourts ?? selectedCourtIds);
    nextParams.set("date", formatDateParam(input.nextDate ?? selectedDate, timezone));
    nextParams.set("scopeMode", input.nextScopeMode ?? scopeMode);
    const nextPath = buildOrgHref(organizationId, "/calendar/day");
    const search = nextParams.toString();
    router.replace(search ? `${nextPath}?${search}` : nextPath, { scroll: false });
  };

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
  const reservationsUrl =
    Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/reservas?${new URLSearchParams({
          from: bookingsFrom.toISOString(),
          to: bookingsTo.toISOString(),
        }).toString()}`
      : null;
  // These endpoints already enforce org roles/scopes (staff sees own scope; admins can see all).
  const professionalsUrl =
    Number.isFinite(organizationId) && organizationId > 0 ? `/api/org/${organizationId}/reservas/profissionais` : null;
  const resourcesUrl =
    Number.isFinite(organizationId) && organizationId > 0
      ? `/api/org/${organizationId}/reservas/recursos?${new URLSearchParams({
          includeCourts: "1",
        }).toString()}`
      : null;
  const servicesUrl =
    Number.isFinite(organizationId) && organizationId > 0 ? `/api/org/${organizationId}/servicos` : null;

  const { data: agendaData, error: agendaError, isLoading: agendaLoading } = useSWR<AgendaResponse>(agendaUrl, fetchJson);
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

  const columnSeeds = useMemo(
    () =>
      buildColumnSeeds({
        selectedProfessionalIds,
        selectedResourceIds,
        selectedCourtIds,
        scopeMode,
        professionals: activeProfessionals,
        resources: activeResources,
        courts: activeCourts,
      }),
    [activeCourts, activeProfessionals, activeResources, scopeMode, selectedCourtIds, selectedProfessionalIds, selectedResourceIds],
  );

  const availabilityKey =
    Number.isFinite(organizationId) && organizationId > 0 && columnSeeds.length > 0
      ? `day-availability:${organizationId}:${getDayKey(selectedDate, timezone)}:${columnSeeds
          .map((seed) => `${seed.entityKind}:${seed.entityId}`)
          .join("|")}`
      : null;

  const { data: availabilityMap } = useSWR<Record<string, ReturnType<typeof normalizeAvailability> | undefined>>(
    availabilityKey,
    async () => {
      const entries = await Promise.all(
        columnSeeds.map(async (seed) => {
          if (seed.entityKind === "COURT") {
            return [seed.id, undefined] as const;
          }
          const query = new URLSearchParams({
            scopeType: seed.entityKind,
            scopeId: String(seed.entityId),
          });
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
    Number.isFinite(organizationId) && organizationId > 0 ? `org-availability:${organizationId}` : null;
  const { data: organizationAvailability } = useSWR<ReturnType<typeof normalizeAvailability> | undefined>(
    organizationAvailabilityKey,
    async () => {
      const url = `/api/org/${organizationId}/reservas/disponibilidade?scopeType=ORGANIZATION`;
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
        const normalized = seed.entityKind === "COURT" ? organizationAvailability : availabilityMap?.[seed.id];
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

      if (scopeMode === "exclusive") {
        if (selectedProfessionalIds.length > 0) {
          return matchesProfessional;
        }
        if (selectedResourceIds.length > 0 || selectedCourtIds.length > 0) {
          return matchesResource || matchesCourt;
        }
        return true;
      }

      const dimensionChecks: boolean[] = [];
      if (selectedProfessionalIds.length > 0) dimensionChecks.push(matchesProfessional);
      if (selectedResourceIds.length > 0 || selectedCourtIds.length > 0) dimensionChecks.push(matchesResource || matchesCourt);
      if (dimensionChecks.length === 0) return true;
      if (HYBRID_MATCH_STRATEGY === "AND") return dimensionChecks.every(Boolean);
      return dimensionChecks.some(Boolean);
    });
  }, [enrichedEvents, scopeMode, selectedCourtIds, selectedProfessionalIds, selectedResourceIds]);

  const filteredEvents = useMemo(
    () => filterEvents(scopedEvents, appliedFilters, timezone),
    [appliedFilters, scopedEvents, timezone],
  );

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

  const activeFilterChips = useMemo(
    () =>
      buildActiveFilterChips({
        filters: appliedFilters,
        serviceLabels,
        professionalLabels,
      }),
    [appliedFilters, professionalLabels, serviceLabels],
  );

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return <div className="p-6 text-sm text-white/70">Organização inválida.</div>;
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <CalendarHeader
        date={selectedDate}
        timezone={timezone}
        datePickerOpen={datePickerOpen}
        onDatePickerOpenChange={setDatePickerOpen}
        onSelectDate={(date) => replaceState({ nextDate: date })}
        onToday={() => replaceState({ nextDate: new Date() })}
        professionalOptions={professionalOptions}
        resourceOptions={resourceOptions}
        selectedProfessionalIds={selectedProfessionalOptionIds}
        selectedResourceIds={selectedResourceOptionIds}
        onSelectProfessional={(optionIds) => {
          const nextProfessionalIds = decodePrefixedIds(optionIds, PROFESSIONAL_OPTION_PREFIX);
          if (scopeMode === "exclusive") {
            replaceState({
              nextProfessionals: nextProfessionalIds,
              nextResources: nextProfessionalIds.length > 0 ? [] : selectedResourceIds,
              nextCourts: nextProfessionalIds.length > 0 ? [] : selectedCourtIds,
            });
            return;
          }
          replaceState({ nextProfessionals: nextProfessionalIds });
        }}
        onSelectResource={(optionIds) => {
          const nextResourceIds = decodePrefixedIds(optionIds, RESOURCE_OPTION_PREFIX);
          const nextCourtIds = decodePrefixedIds(optionIds, COURT_OPTION_PREFIX);
          if (scopeMode === "exclusive") {
            replaceState({
              nextResources: nextResourceIds,
              nextCourts: nextCourtIds,
              nextProfessionals: nextResourceIds.length > 0 || nextCourtIds.length > 0 ? [] : selectedProfessionalIds,
            });
            return;
          }
          replaceState({ nextResources: nextResourceIds, nextCourts: nextCourtIds });
        }}
        scopeMode={scopeMode}
        onScopeModeChange={(mode) => {
          if (
            mode === "exclusive" &&
            selectedProfessionalIds.length > 0 &&
            (selectedResourceIds.length > 0 || selectedCourtIds.length > 0)
          ) {
            replaceState({ nextScopeMode: mode, nextResources: [], nextCourts: [] });
            return;
          }
          replaceState({ nextScopeMode: mode });
        }}
        onOpenFilters={() => {
          setDraftFilters(cloneFilters(appliedFilters));
          setFiltersOpen(true);
        }}
        activeFilterCount={countAppliedFilters(appliedFilters)}
      />

      {activeFilterChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilterChips.map((chip) => (
            <span
              key={chip.id}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80"
            >
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}

      <DayGrid
        date={selectedDate}
        timezone={timezone}
        columns={columns}
        events={filteredEvents}
        hourHeight={hourHeight}
      />

      {agendaLoading ? <p className="text-sm text-white/65">A carregar agenda...</p> : null}
      {agendaError ? <p className="text-sm text-rose-200">Falha ao carregar agenda: {agendaError.message}</p> : null}
      {!agendaLoading && !agendaError && filteredEvents.length === 0 ? (
        <p className="text-sm text-white/55">Sem reservas para os filtros e data selecionados.</p>
      ) : null}

      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
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
