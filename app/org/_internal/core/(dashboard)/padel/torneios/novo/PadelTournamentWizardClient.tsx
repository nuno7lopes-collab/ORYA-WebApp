"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { trackEvent } from "@/lib/analytics";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";
import type { Prisma } from "@prisma/client";
import { CTA_GHOST, CTA_PRIMARY } from "@/app/org/_internal/core/dashboardUi";
import {
  CreateWizardActionBar,
  CreateWizardAlert,
  CreateWizardChecklist,
  CreateWizardHeader,
  CreateWizardSectionCard,
  CreateWizardShell,
} from "@/app/org/_internal/core/(dashboard)/_components/create-wizard";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type PadelClub = {
  id: number;
  name: string;
  isActive: boolean;
  addressId?: string | null;
  locationSource?: "APPLE_MAPS" | null;
  locationProviderId?: string | null;
  locationFormattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  addressRef?: {
    formattedAddress?: string | null;
    canonical?: Prisma.JsonValue | null;
    latitude?: number | null;
    longitude?: number | null;
    sourceProvider?: string | null;
    sourceProviderPlaceId?: string | null;
  } | null;
};

type PadelCategory = {
  id: number;
  label: string;
  genderRestriction?: string | null;
  minLevel?: string | null;
  maxLevel?: string | null;
  isActive: boolean;
};

type PadelRuleSet = {
  id: number;
  name: string;
  season?: string | null;
  year?: number | null;
};

type Court = {
  id: number;
  name: string;
  indoor?: boolean | null;
  displayOrder?: number | null;
  isActive: boolean;
};

type StaffMember = {
  id: number;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  inheritToEvents?: boolean | null;
  isActive?: boolean;
};

type CategoryDraft = {
  selected: boolean;
  price: string;
  capacityTeams: string;
  format: string;
};

type PlannerCategoryResult = {
  key: string;
  categoryId: number | null;
  label: string;
  format: string;
  teams: number;
  minTeams: number;
  matchesNeeded: number;
  allocatedSlots: number;
  recommendedMaxTeams: number;
  hardCapMax: number | null;
  queueEstimatedRounds: number | null;
  feasible: boolean;
  warnings: string[];
};

type PlannerResult = {
  feasible: boolean;
  windowMinutes: number;
  courtsUsed: number;
  slotMinutes: number;
  totalSlots: number;
  matchesNeeded: number;
  unscheduledMatches: number;
  categories: PlannerCategoryResult[];
  warnings: string[];
  blockingReasons: string[];
  alternatives: Array<{ type: string; summary: string }>;
};

const PADEL_FORMATS = [
  { value: "TODOS_CONTRA_TODOS", label: "Todos contra todos" },
  { value: "GRUPOS_ELIMINATORIAS", label: "Grupos + eliminatórias" },
  { value: "QUADRO_ELIMINATORIO", label: "Quadro eliminatório" },
  { value: "QUADRO_AB", label: "Quadro A/B" },
  { value: "DUPLA_ELIMINACAO", label: "Dupla eliminação" },
  { value: "CAMPEONATO_LIGA", label: "Campeonato liga" },
  { value: "NON_STOP", label: "Non-stop" },
  { value: "AMERICANO", label: "Americano" },
  { value: "MEXICANO", label: "Mexicano" },
];
const PADEL_FORMAT_LABEL_BY_VALUE = Object.fromEntries(PADEL_FORMATS.map((item) => [item.value, item.label])) as Record<
  string,
  string
>;
const resolveFormatLabel = (value: string) => PADEL_FORMAT_LABEL_BY_VALUE[value] ?? value;

const ELIGIBILITY_OPTIONS = [
  { value: "OPEN", label: "Aberto" },
  { value: "MALE_ONLY", label: "Masculino" },
  { value: "FEMALE_ONLY", label: "Feminino" },
  { value: "MIXED", label: "Mistos" },
];

const TIMEZONE_OPTIONS = [
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Mexico_City",
  "Africa/Maputo",
];

const asNumber = (value: string) => {
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatDateTimeLocal = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;
};

const parseDateTimeLocal = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoFromLocalInput = (value: string) => {
  const date = parseDateTimeLocal(value);
  return date ? date.toISOString() : null;
};

const shiftDateTimeLocal = (value: string, minutes: number) => {
  const date = parseDateTimeLocal(value);
  if (!date) return "";
  const shifted = new Date(date.getTime() + minutes * 60 * 1000);
  return formatDateTimeLocal(shifted);
};

function resolveClubLocation(club: PadelClub | null) {
  if (!club) {
    return {
      formatted: "",
      addressId: null,
    };
  }
  const formatted =
    club.addressRef?.formattedAddress ||
    club.locationFormattedAddress ||
    "";
  return {
    formatted,
    addressId: club.addressId ?? null,
  };
}

export default function PadelTournamentWizardClient({ organizationId }: { organizationId: number }) {
  const router = useRouter();
  const [title, setTitle] = useState("Torneio Padel");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState("Europe/Lisbon");
  const [registrationStartsAt, setRegistrationStartsAt] = useState("");
  const [registrationEndsAt, setRegistrationEndsAt] = useState("");
  const [scheduleWindowStart, setScheduleWindowStart] = useState("");
  const [scheduleWindowEnd, setScheduleWindowEnd] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [slotMinutes, setSlotMinutes] = useState("15");
  const [bufferMinutes, setBufferMinutes] = useState("5");
  const [minRestMinutes, setMinRestMinutes] = useState("10");
  const [schedulePriority, setSchedulePriority] = useState<"GROUPS_FIRST" | "KNOCKOUT_FIRST">("GROUPS_FIRST");
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [format, setFormat] = useState<string>(PADEL_FORMATS[0]?.value ?? "TODOS_CONTRA_TODOS");
  const [eligibility, setEligibility] = useState<string>("OPEN");
  const [splitDeadlineHours, setSplitDeadlineHours] = useState<string>("48");
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [isInterclub, setIsInterclub] = useState(false);
  const [teamSize, setTeamSize] = useState("4");
  const [ruleSetId, setRuleSetId] = useState<string>("");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, CategoryDraft>>({});
  const [defaultCategoryId, setDefaultCategoryId] = useState<number | null>(null);
  const [useAllCourts, setUseAllCourts] = useState(true);
  const [selectedCourtIds, setSelectedCourtIds] = useState<number[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [savingMode, setSavingMode] = useState<"DRAFT" | "PUBLISH" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftEventId, setDraftEventId] = useState<number | null>(null);
  const [capacityPlan, setCapacityPlan] = useState<PlannerResult | null>(null);
  const [capacityPlanLoading, setCapacityPlanLoading] = useState(false);
  const [capacityPlanError, setCapacityPlanError] = useState<string | null>(null);
  const saving = savingMode !== null;

  const { data: clubsRes } = useSWR<{ ok?: boolean; items?: PadelClub[] }>(
    organizationId ? `/api/padel/clubs?organizationId=${organizationId}&includeInactive=0` : null,
    fetcher,
  );
  const { data: categoriesRes } = useSWR<{ ok?: boolean; items?: PadelCategory[] }>(
    organizationId ? `/api/padel/categories/my?organizationId=${organizationId}&includeInactive=0` : null,
    fetcher,
  );
  const { data: rulesetsRes } = useSWR<{ ok?: boolean; items?: PadelRuleSet[] }>(
    organizationId ? `/api/padel/rulesets?organizationId=${organizationId}` : null,
    fetcher,
  );

  const clubIdNumber = Number(selectedClubId);
  const { data: courtsRes } = useSWR<{ ok?: boolean; items?: Court[] }>(
    clubIdNumber ? `/api/padel/clubs/${clubIdNumber}/courts` : null,
    fetcher,
  );
  const { data: staffRes } = useSWR<{ ok?: boolean; items?: StaffMember[] }>(
    clubIdNumber ? `/api/padel/clubs/${clubIdNumber}/staff` : null,
    fetcher,
  );

  const clubs = useMemo(() => (Array.isArray(clubsRes?.items) ? clubsRes?.items ?? [] : []), [clubsRes?.items]);
  const categories = useMemo(
    () => (Array.isArray(categoriesRes?.items) ? categoriesRes?.items ?? [] : []),
    [categoriesRes?.items],
  );
  const rulesets = useMemo(() => (Array.isArray(rulesetsRes?.items) ? rulesetsRes?.items ?? [] : []), [rulesetsRes?.items]);
  const courts = useMemo(() => (Array.isArray(courtsRes?.items) ? courtsRes?.items ?? [] : []), [courtsRes?.items]);
  const staffMembers = useMemo(
    () =>
      (Array.isArray(staffRes?.items) ? staffRes?.items ?? [] : []).filter((staff) => staff.isActive !== false),
    [staffRes?.items],
  );

  useEffect(() => {
    if (selectedClubId || clubs.length === 0) return;
    const activeClub = clubs.find((club) => club.isActive) ?? clubs[0];
    if (activeClub) setSelectedClubId(String(activeClub.id));
  }, [clubs, selectedClubId]);

  useEffect(() => {
    setSelectedCourtIds([]);
    setSelectedStaffIds([]);
    setUseAllCourts(true);
  }, [selectedClubId]);

  useEffect(() => {
    const activeStaffIds = new Set(staffMembers.map((staff) => staff.id));
    const inherited = staffMembers.filter((staff) => staff.inheritToEvents).map((staff) => staff.id);
    setSelectedStaffIds((prev) => {
      if (staffMembers.length === 0) return prev.length > 0 ? [] : prev;
      const validPrev = prev.filter((id) => activeStaffIds.has(id));
      if (validPrev.length > 0) {
        const unchanged = validPrev.length === prev.length && validPrev.every((id, idx) => id === prev[idx]);
        return unchanged ? prev : validPrev;
      }
      if (inherited.length > 0) return inherited;
      return prev.length > 0 ? [] : prev;
    });
  }, [staffMembers]);

  useEffect(() => {
    if (categories.length === 0) return;
    setCategoryDrafts((prev) => {
      const next = { ...prev };
      categories.forEach((cat) => {
        if (!next[cat.id]) {
          next[cat.id] = {
            selected: false,
            price: "0",
            capacityTeams: "",
            format,
          };
        }
      });
      Object.keys(next).forEach((key) => {
        const id = Number(key);
        if (!categories.find((cat) => cat.id === id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [categories, format]);

  useEffect(() => {
    const selectedIds = categories
      .map((cat) => cat.id)
      .filter((id) => categoryDrafts[id]?.selected);
    if (selectedIds.length === 0) {
      setDefaultCategoryId(null);
      return;
    }
    if (!defaultCategoryId || !selectedIds.includes(defaultCategoryId)) {
      setDefaultCategoryId(selectedIds[0]);
    }
  }, [categoryDrafts, categories, defaultCategoryId]);

  useEffect(() => {
    if (typeof Intl === "undefined") return;
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved && timezone === "Europe/Lisbon") {
      setTimezone(resolved);
    }
    // run once to avoid overriding manual changes
  }, []);

  useEffect(() => {
    if (!registrationStartsAt) {
      const now = formatDateTimeLocal(new Date());
      if (now) setRegistrationStartsAt(now);
    }
    // run once to preserve manual clears
  }, []);

  useEffect(() => {
    if (!startsAt) return;
    if (!endsAt) {
      const shifted = shiftDateTimeLocal(startsAt, 5 * 60);
      if (shifted) setEndsAt(shifted);
    }
    if (!registrationEndsAt) {
      const shifted = shiftDateTimeLocal(startsAt, -24 * 60);
      if (shifted) setRegistrationEndsAt(shifted);
    }
    if (!scheduleWindowStart) {
      setScheduleWindowStart(startsAt);
    }
    if (!scheduleWindowEnd) {
      setScheduleWindowEnd(endsAt || startsAt);
    }
  }, [startsAt, endsAt, registrationEndsAt, scheduleWindowStart, scheduleWindowEnd]);

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === Number(selectedClubId)) ?? null,
    [clubs, selectedClubId],
  );
  const location = useMemo(() => resolveClubLocation(selectedClub), [selectedClub]);

  const selectedCategories = useMemo(
    () => categories.filter((cat) => categoryDrafts[cat.id]?.selected),
    [categories, categoryDrafts],
  );
  const categoryFormatOverrides = useMemo(
    () =>
      selectedCategories
        .map((category) => {
          const categoryFormat = categoryDrafts[category.id]?.format || format;
          if (categoryFormat === format) return null;
          return {
            categoryId: category.id,
            label: category.label,
            format: categoryFormat,
          };
        })
        .filter(Boolean) as Array<{ categoryId: number; label: string; format: string }>,
    [categoryDrafts, format, selectedCategories],
  );
  const categoryFormatOverridesSummary = categoryFormatOverrides
    .slice(0, 3)
    .map((item) => `${item.label} (${resolveFormatLabel(item.format)})`)
    .join(" · ");

  const activeCourts = useMemo(() => courts.filter((court) => court.isActive), [courts]);
  const resolvedCourts = useMemo(() => {
    if (useAllCourts) return activeCourts;
    const selected = new Set(selectedCourtIds);
    return activeCourts.filter((court) => selected.has(court.id));
  }, [activeCourts, selectedCourtIds, useAllCourts]);
  const courtsCount = resolvedCourts.length;

  const registrationWarnings = useMemo(() => {
    const warnings: string[] = [];
    const regStart = parseDateTimeLocal(registrationStartsAt);
    const regEnd = parseDateTimeLocal(registrationEndsAt);
    const eventStart = parseDateTimeLocal(startsAt);
    if (regStart && regEnd && regStart >= regEnd) {
      warnings.push("A janela de inscrições começa depois do fim.");
    }
    if (regEnd && eventStart && regEnd >= eventStart) {
      warnings.push("O fim das inscrições precisa de ser antes do início do torneio.");
    }
    return warnings;
  }, [registrationStartsAt, registrationEndsAt, startsAt]);

  const scheduleWarnings = useMemo(() => {
    const warnings: string[] = [];
    const windowStart = parseDateTimeLocal(scheduleWindowStart || startsAt);
    const windowEnd = parseDateTimeLocal(scheduleWindowEnd || endsAt || startsAt);
    if (windowStart && windowEnd && windowStart >= windowEnd) {
      warnings.push("A janela de calendário termina antes do início.");
    }
    return warnings;
  }, [scheduleWindowStart, scheduleWindowEnd, startsAt, endsAt]);

  useEffect(() => {
    const windowStart = toIsoFromLocalInput(scheduleWindowStart || startsAt);
    const windowEnd = toIsoFromLocalInput(scheduleWindowEnd || endsAt || startsAt);
    const selectedCourtIds = (resolvedCourts.length > 0 ? resolvedCourts : activeCourts).map((court) => court.id);
    const duration = asNumber(durationMinutes) ?? 60;
    const buffer = asNumber(bufferMinutes) ?? 5;

    if (
      !organizationId ||
      !windowStart ||
      !windowEnd ||
      new Date(windowEnd) <= new Date(windowStart) ||
      selectedCategories.length === 0 ||
      selectedCourtIds.length === 0
    ) {
      setCapacityPlan(null);
      setCapacityPlanError(null);
      setCapacityPlanLoading(false);
      return;
    }

    const payload = {
      organizationId,
      format,
      windowStart,
      windowEnd,
      durationMinutes: Math.max(1, Math.round(duration)),
      bufferMinutes: Math.max(0, Math.round(buffer)),
      courtIds: selectedCourtIds,
      courtPriorityOrder: selectedCourtIds,
      categoryWeights: selectedCategories.reduce<Record<string, number>>((acc, category) => {
        acc[String(category.id)] = 1;
        return acc;
      }, {}),
      categories: selectedCategories.map((category) => {
        const draft = categoryDrafts[category.id];
        const formatValue = draft?.format || format;
        const teams = asNumber(draft?.capacityTeams ?? "");
        const defaultTeams = formatValue === "GRUPOS_ELIMINATORIAS" ? 4 : 2;
        return {
          categoryId: category.id,
          label: category.label,
          teams: teams && teams > 0 ? Math.max(defaultTeams, Math.floor(teams)) : defaultTeams,
          format: formatValue,
          amMxMode: formatValue === "AMERICANO" || formatValue === "MEXICANO" ? "INDIVIDUAL_ROTATION" : undefined,
          amMxProgressionMode:
            formatValue === "AMERICANO" || formatValue === "MEXICANO" ? "ROUND_BY_ROUND" : undefined,
          nonStopMode: formatValue === "NON_STOP" ? "ACTIVE_QUEUE" : undefined,
        };
      }),
    };

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setCapacityPlanLoading(true);
      setCapacityPlanError(null);
      try {
        const res = await fetch("/api/padel/formats/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          setCapacityPlan(null);
          const message = sanitizeUiErrorMessage(json?.error, "Planner de capacidade indisponível.");
          setCapacityPlanError(message);
          return;
        }
        const plan = json?.plan;
        if (plan && typeof plan === "object") {
          setCapacityPlan(plan as PlannerResult);
          return;
        }
        setCapacityPlan(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setCapacityPlan(null);
        setCapacityPlanError("Erro ao calcular capacidade por formato.");
      } finally {
        if (!controller.signal.aborted) setCapacityPlanLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    activeCourts,
    bufferMinutes,
    categoryDrafts,
    durationMinutes,
    endsAt,
    format,
    organizationId,
    resolvedCourts,
    scheduleWindowEnd,
    scheduleWindowStart,
    selectedCategories,
    startsAt,
  ]);

  const toggleCategory = (id: number) => {
    setCategoryDrafts((prev) => {
      const current = prev[id] ?? { selected: false, price: "0", capacityTeams: "", format };
      return {
        ...prev,
        [id]: {
          ...current,
          selected: !current.selected,
        },
      };
    });
  };
  const applyGlobalFormatToSelected = () => {
    if (selectedCategories.length === 0) return;
    setCategoryDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      selectedCategories.forEach((category) => {
        const current = next[category.id] ?? { selected: true, price: "0", capacityTeams: "", format };
        if (current.format === format) return;
        changed = true;
        next[category.id] = { ...current, format };
      });
      return changed ? next : prev;
    });
  };

  const toggleCourt = (courtId: number) => {
    setSelectedCourtIds((prev) =>
      prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId],
    );
  };

  const handleSubmit = async (mode: "DRAFT" | "PUBLISH") => {
    setError(null);
    setDraftEventId(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Indica o título do torneio.");
      return;
    }
    if (!startsAt) {
      setError("Indica a data/hora de início.");
      return;
    }
    if (!endsAt) {
      setError("Indica a data/hora de fim.");
      return;
    }
    if (startsAt && endsAt) {
      const startDate = parseDateTimeLocal(startsAt);
      const endDate = parseDateTimeLocal(endsAt);
      if (startDate && endDate && endDate <= startDate) {
        setError("A data/hora de fim tem de ser depois do início.");
        return;
      }
    }
    const clubIdValue = Number(selectedClubId);
    if (!Number.isFinite(clubIdValue) || clubIdValue <= 0) {
      setError("Seleciona um clube.");
      return;
    }
    if (mode === "PUBLISH" && selectedCategories.length === 0) {
      setError("Seleciona pelo menos uma categoria para publicar.");
      return;
    }
    if (!location.addressId) {
      setError("A morada do clube precisa de estar normalizada (Apple Maps).");
      return;
    }
    if (mode === "PUBLISH" && registrationWarnings.length > 0) {
      setError(registrationWarnings[0]);
      return;
    }
    if (mode === "PUBLISH" && scheduleWarnings.length > 0) {
      setError(scheduleWarnings[0]);
      return;
    }

    const teamSizeValue = isInterclub ? asNumber(teamSize) : null;
    if (isInterclub) {
      if (!teamSizeValue || teamSizeValue < 2) {
        setError("Define o tamanho da equipa (mínimo 2).");
        return;
      }
    }

    const categoryConfigs = selectedCategories.map((cat) => {
      const draft = categoryDrafts[cat.id];
      const priceValue = asNumber(draft?.price ?? "0") ?? 0;
      const capacityValue = asNumber(draft?.capacityTeams ?? "") ?? null;
      return {
        padelCategoryId: cat.id,
        pricePerPlayer: Math.max(0, priceValue),
        capacityTeams: capacityValue && capacityValue > 0 ? Math.floor(capacityValue) : null,
        format: draft?.format || format,
        currency: "EUR",
      };
    });

    const hasPaid = categoryConfigs.some((cfg) => (cfg.pricePerPlayer ?? 0) > 0);
    const scheduleDuration = asNumber(durationMinutes) ?? 60;
    const scheduleSlot = asNumber(slotMinutes) ?? 15;
    const scheduleBuffer = asNumber(bufferMinutes) ?? 5;
    const scheduleRest = asNumber(minRestMinutes) ?? 10;
    const numberOfCourts = Math.max(1, courtsCount || 1);
    const courtIdsPayload = useAllCourts ? activeCourts.map((court) => court.id) : selectedCourtIds;
    const courtsFromClubs = (resolvedCourts.length > 0 ? resolvedCourts : activeCourts).map((court, idx) => ({
      id: court.id,
      clubId: clubIdValue,
      clubName: selectedClub?.name ?? null,
      name: court.name,
      indoor: court.indoor ?? null,
      displayOrder: typeof court.displayOrder === "number" ? court.displayOrder : idx,
    }));

    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      startsAt,
      endsAt: endsAt || shiftDateTimeLocal(startsAt, 5 * 60) || startsAt,
      status: "DRAFT",
      timezone: timezone || undefined,
      addressId: location.addressId,
      pricingMode: hasPaid ? "STANDARD" : "FREE_ONLY",
      padel: {
        clubId: clubIdValue,
        categoryIds: selectedCategories.map((cat) => cat.id),
        defaultCategoryId,
        format,
        eligibilityType: eligibility,
        splitDeadlineHours: asNumber(splitDeadlineHours) ?? null,
        ruleSetId: ruleSetId ? Number(ruleSetId) : null,
        isInterclub,
        teamSize: isInterclub && teamSizeValue ? Math.floor(teamSizeValue) : null,
        categoryConfigs,
        courtIds: courtIdsPayload,
        staffIds: selectedStaffIds,
        numberOfCourts,
        padelV2Enabled: true,
        advancedSettings: {
          waitlistEnabled,
          registrationStartsAt: toIsoFromLocalInput(registrationStartsAt),
          registrationEndsAt: toIsoFromLocalInput(registrationEndsAt),
          gameDurationMinutes: Number.isFinite(scheduleDuration) ? Math.max(1, Math.round(scheduleDuration)) : null,
          scheduleDefaults: {
            windowStart: toIsoFromLocalInput(scheduleWindowStart),
            windowEnd: toIsoFromLocalInput(scheduleWindowEnd),
            durationMinutes: Number.isFinite(scheduleDuration) ? Math.max(1, Math.round(scheduleDuration)) : null,
            slotMinutes: Number.isFinite(scheduleSlot) ? Math.max(5, Math.round(scheduleSlot)) : null,
            bufferMinutes: Number.isFinite(scheduleBuffer) ? Math.max(0, Math.round(scheduleBuffer)) : null,
            minRestMinutes: Number.isFinite(scheduleRest) ? Math.max(0, Math.round(scheduleRest)) : null,
            priority: schedulePriority,
          },
          formatProfilesByCategory: selectedCategories.reduce<Record<string, Record<string, unknown>>>((acc, category) => {
            const draft = categoryDrafts[category.id];
            const formatValue = draft?.format || format;
            acc[String(category.id)] = {
              format: formatValue,
              amMxMode:
                formatValue === "AMERICANO" || formatValue === "MEXICANO" ? "INDIVIDUAL_ROTATION" : undefined,
              amMxProgressionMode:
                formatValue === "AMERICANO" || formatValue === "MEXICANO" ? "ROUND_BY_ROUND" : undefined,
              nonStopMode: formatValue === "NON_STOP" ? "ACTIVE_QUEUE" : undefined,
            };
            return acc;
          }, {}),
          capacityPolicy: {
            publishWarnOnly: true,
            hardBlockGenerate: true,
            hardBlockAutoSchedule: true,
          },
          categoryWeights: selectedCategories.reduce<Record<string, number>>((acc, category) => {
            acc[String(category.id)] = 1;
            return acc;
          }, {}),
          courtSelectionDefaults: {
            useAllCourts,
            courtIds: courtIdsPayload,
          },
          courtPriorityOrder: (resolvedCourts.length > 0 ? resolvedCourts : activeCourts).map((court) => court.id),
          rankingWeights: {
            NON_STOP: 0.7,
            AMERICANO: 0.7,
            MEXICANO: 0.7,
            byCategory: selectedCategories.reduce<Record<string, Record<string, number>>>((acc, category) => {
              acc[String(category.id)] = {
                NON_STOP: 0.7,
                AMERICANO: 0.7,
                MEXICANO: 0.7,
              };
              return acc;
            }, {}),
          },
          courtsFromClubs: courtsFromClubs.length > 0 ? courtsFromClubs : null,
        },
      },
    };

    const capacityPlanIssues =
      (capacityPlan?.warnings?.length ?? 0) +
      (capacityPlan?.blockingReasons?.length ?? 0) +
      (capacityPlan?.feasible === false ? 1 : 0);
    if (mode === "PUBLISH" && capacityPlan && capacityPlanIssues > 0) {
      trackEvent("padel_capacity_warning", {
        title: trimmedTitle,
        totalSlots: capacityPlan.totalSlots,
        matchesNeeded: capacityPlan.matchesNeeded,
        unscheduledMatches: capacityPlan.unscheduledMatches,
        courts: capacityPlan.courtsUsed,
        warnings: capacityPlan.warnings,
        blockingReasons: capacityPlan.blockingReasons,
        alternatives: capacityPlan.alternatives?.map((item) => item.summary) ?? [],
      });
    }

    setSavingMode(mode);
    try {
      const res = await fetch(`/api/org/${organizationId}/tournaments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        if (json?.errorCode === "PADEL_CREATE_MOVED" && typeof json?.details?.target === "string") {
          router.push(json.details.target);
          return;
        }
        const message = sanitizeUiErrorMessage(
          json?.message ?? json?.error ?? json?.errorCode,
          "Falha ao criar torneio.",
        );
        throw new Error(message);
      }
      const eventId = json?.data?.event?.id ?? json?.event?.id;
      if (!eventId) {
        router.push(appendOrganizationIdToHref("/org/padel/tournaments", organizationId));
        return;
      }

      if (mode === "PUBLISH") {
        const publishRes = await fetch("/api/padel/tournaments/lifecycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, nextStatus: "PUBLISHED" }),
        });
        const publishJson = await publishRes.json().catch(() => null);
        if (!publishRes.ok || publishJson?.ok === false) {
          const missing = Array.isArray(publishJson?.missing) ? publishJson.missing : [];
          const missingLabels: Record<string, string> = {
            PADEL_V2_DISABLED: "Padel V2 não ativo",
            FORMAT_MISSING: "Formato do torneio",
            CLUB_MISSING: "Clube",
            COURTS_MISSING: "Campos",
            CATEGORIES_MISSING: "Categorias",
            CATEGORY_PRICES_MISSING: "Preços por categoria",
            REGISTRATION_WINDOW_INVALID: "Janela de inscrições inválida",
            REGISTRATION_END_AFTER_START: "Fim das inscrições após início",
            STAFF_MISSING_FOR_PARTNER_CLUBS: "Equipa obrigatória para clubes parceiros",
            TOURNAMENT_DIRECTOR_REQUIRED: "Diretor de prova em falta",
          };
          const missingLabel = missing.length
            ? missing.map((code: string) => missingLabels[code] || code).join(", ")
            : sanitizeUiErrorMessage(publishJson?.error, "Não foi possível publicar.");
          setError(`Publicação bloqueada: ${missingLabel}.`);
          setDraftEventId(eventId);
          return;
        }
      }

      router.push(appendOrganizationIdToHref(`/org/padel/tournaments/${eventId}`, organizationId));
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeUiErrorMessage(err.message, "Erro ao criar torneio.")
          : "Erro ao criar torneio.",
      );
    } finally {
      setSavingMode(null);
    }
  };

  const readinessItems = useMemo(
    () => [
      { id: "identity", label: "Título e datas base", done: Boolean(title.trim() && startsAt && endsAt), blockedLabel: "Falta" },
      { id: "club", label: "Clube com morada normalizada", done: Boolean(selectedClubId && location.addressId), blockedLabel: "Bloqueado" },
      { id: "courts", label: "Campos operacionais válidos", done: courtsCount > 0, blockedLabel: "Sem campos" },
      { id: "categories", label: "Categorias e categoria principal", done: selectedCategories.length > 0 && Boolean(defaultCategoryId), blockedLabel: "Sem categorias" },
      {
        id: "rules",
        label: "Formato e regras operacionais",
        done: Boolean(format && eligibility && (!isInterclub || (asNumber(teamSize) ?? 0) >= 2)),
        blockedLabel: "Incompleto",
      },
      { id: "registration", label: "Janela de inscrições válida", done: registrationWarnings.length === 0, blockedLabel: "Janela inválida" },
      { id: "schedule", label: "Defaults de agenda válidos", done: scheduleWarnings.length === 0, blockedLabel: "Agenda inválida" },
    ],
    [
      title,
      startsAt,
      endsAt,
      selectedClubId,
      location.addressId,
      courtsCount,
      selectedCategories.length,
      defaultCategoryId,
      format,
      eligibility,
      isInterclub,
      teamSize,
      registrationWarnings.length,
      scheduleWarnings.length,
    ],
  );

  const toggleStaff = (staffId: number) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId],
    );
  };
  const readinessDone = readinessItems.filter((item) => item.done).length;
  const readinessPercent = readinessItems.length > 0 ? Math.round((readinessDone / readinessItems.length) * 100) : 0;
  const capacityPlanWarningsCount =
    (capacityPlan?.warnings?.length ?? 0) +
    (capacityPlan?.blockingReasons?.length ?? 0) +
    (capacityPlan?.feasible === false ? 1 : 0);
  const blockingWarningsCount = registrationWarnings.length + scheduleWarnings.length + capacityPlanWarningsCount;
  const identityIssues = useMemo(() => {
    const issues: string[] = [];
    if (!title.trim()) issues.push("Título em falta.");
    if (!selectedClubId) issues.push("Seleciona um clube.");
    if (selectedClubId && !location.addressId) issues.push("Morada do clube não normalizada.");
    if (!startsAt) issues.push("Data/hora de início em falta.");
    if (!endsAt) issues.push("Data/hora de fim em falta.");
    const startDate = parseDateTimeLocal(startsAt);
    const endDate = parseDateTimeLocal(endsAt);
    if (startDate && endDate && endDate <= startDate) {
      issues.push("Fim deve ser depois do início.");
    }
    return issues;
  }, [title, selectedClubId, location.addressId, startsAt, endsAt]);
  const registrationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!registrationStartsAt || !registrationEndsAt) {
      issues.push("Janela de inscrições incompleta.");
    }
    if (!scheduleWindowStart || !scheduleWindowEnd) {
      issues.push("Janela de calendário incompleta.");
    }
    if (capacityPlan && !capacityPlan.feasible) {
      issues.push("Capacidade por formato insuficiente para a janela/campos atuais.");
    }
    if (capacityPlanError) {
      issues.push("Planner de capacidade indisponível.");
    }
    return [...issues, ...registrationWarnings, ...scheduleWarnings];
  }, [
    capacityPlan,
    capacityPlanError,
    registrationStartsAt,
    registrationEndsAt,
    scheduleWindowStart,
    scheduleWindowEnd,
    registrationWarnings,
    scheduleWarnings,
  ]);
  const categoriesIssues = useMemo(() => {
    const issues: string[] = [];
    if (selectedCategories.length === 0) issues.push("Seleciona pelo menos uma categoria.");
    if (selectedCategories.length > 0 && !defaultCategoryId) {
      issues.push("Define a categoria principal.");
    }
    return issues;
  }, [selectedCategories.length, defaultCategoryId]);
  const operationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!format) issues.push("Formato global em falta.");
    if (!eligibility) issues.push("Elegibilidade em falta.");
    if (courtsCount <= 0) issues.push("Sem campos operacionais selecionados.");
    if (isInterclub && (asNumber(teamSize) ?? 0) < 2) {
      issues.push("Tamanho de equipa inválido para interclubes.");
    }
    return issues;
  }, [format, eligibility, courtsCount, isInterclub, teamSize]);

  const renderSectionIssues = (issues: string[]) =>
    issues.length > 0 ? (
      <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100">
        <p className="font-semibold">Rever nesta secção</p>
        <div className="mt-1 space-y-1">
          {issues.slice(0, 3).map((issue, idx) => (
            <p key={`${issue}-${idx}`}>• {issue}</p>
          ))}
          {issues.length > 3 ? <p>• +{issues.length - 3} ponto(s) adicional(is)</p> : null}
        </div>
      </div>
    ) : null;

  return (
    <CreateWizardShell>
      <CreateWizardHeader
        eyebrow="Assistente Padel"
        title="Criar torneio"
        subtitle="Fluxo dedicado: configura clube, categorias, regras operacionais e prontidão para publicação."
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Prontidão</p>
          <p className="mt-1 text-lg font-semibold text-white">{readinessPercent}%</p>
          <p className="text-[11px] text-white/60">
            {readinessDone}/{readinessItems.length} checkpoints.
          </p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Categorias ativas</p>
          <p className="mt-1 text-lg font-semibold text-white">{selectedCategories.length}</p>
          <p className="text-[11px] text-white/60">Categoria principal: {defaultCategoryId ? "definida" : "pendente"}.</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Campos em uso</p>
          <p className="mt-1 text-lg font-semibold text-white">{courtsCount || 0}</p>
          <p className="text-[11px] text-white/60">{useAllCourts ? "Modo todos os campos" : "Seleção manual ativa"}.</p>
        </div>
        <div className="rounded-2xl border border-white/12 bg-black/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Publicação</p>
          <p className="mt-1 text-lg font-semibold text-white">{savingMode === "PUBLISH" ? "A validar" : "Guardrails ativos"}</p>
          <p className="text-[11px] text-white/60">
            {capacityPlanLoading
              ? "Planner por formato a calcular capacidade..."
              : blockingWarningsCount > 0
              ? `${blockingWarningsCount} alerta(s) para rever antes de publicar.`
              : "Lifecycle valida antes de publicar."}
          </p>
        </div>
      </section>
      <div className="rounded-full border border-white/12 bg-black/30 p-1">
        <div className="h-2 rounded-full bg-white/10">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-[#58D8FF] via-[#6BFFFF] to-[#6AFFC8] transition-all"
            style={{ width: `${Math.max(8, readinessPercent)}%` }}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-[12px]">
        {[
          { id: "wizard-identity", label: "Identidade" },
          { id: "wizard-registration", label: "Inscrições" },
          { id: "wizard-categories", label: "Categorias" },
          { id: "wizard-operation", label: "Operação" },
        ].map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-full border border-white/14 bg-white/[0.04] px-3 py-1 text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            {section.label}
          </a>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">

      <CreateWizardSectionCard
        id="wizard-identity"
        title="Identidade e Datas"
        subtitle="Nome do torneio, período e localização normalizada."
        statusLabel={identityIssues.length === 0 ? "OK" : `Rever (${identityIssues.length})`}
        statusTone={identityIssues.length === 0 ? "ok" : "warn"}
      >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Título</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Clube</span>
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Seleciona...</option>
                {clubs.map((club) => (
                  <option key={`club-${club.id}`} value={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Início</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Fim (opcional)</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm text-white/70">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Descrição</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
            />
          </label>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
            <p className="text-[12px] uppercase tracking-[0.18em] text-white/50">Localização</p>
            {selectedClub ? (
              <div>
                <p className="font-semibold text-white">{selectedClub.name}</p>
                <p className="text-[12px] text-white/60">{location.formatted || "Morada por definir"}</p>
              </div>
            ) : (
              <p className="text-[12px] text-white/60">Seleciona um clube para carregar a morada.</p>
            )}
          </div>
          {renderSectionIssues(identityIssues)}
      </CreateWizardSectionCard>

      <CreateWizardSectionCard
        id="wizard-registration"
        title="Inscrições e Agenda"
        subtitle="Janela de inscrições e defaults operacionais para calendário automático."
        statusLabel={registrationIssues.length === 0 ? "OK" : `Rever (${registrationIssues.length})`}
        statusTone={registrationIssues.length === 0 ? "ok" : "warn"}
      >

          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Timezone</span>
              <input
                list="padel-timezones"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
                placeholder="Europe/Lisbon"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Inscrições abrem</span>
              <input
                type="datetime-local"
                value={registrationStartsAt}
                onChange={(e) => setRegistrationStartsAt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Inscrições fecham (T-24)</span>
              <input
                type="datetime-local"
                value={registrationEndsAt}
                onChange={(e) => setRegistrationEndsAt(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
          </div>
          <datalist id="padel-timezones">
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={`tz-${tz}`} value={tz} />
            ))}
          </datalist>

          {registrationWarnings.length > 0 && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100">
              {registrationWarnings.map((warning) => (
                <p key={`reg-warning-${warning}`}>{warning}</p>
              ))}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Janela calendário início</span>
              <input
                type="datetime-local"
                value={scheduleWindowStart}
                onChange={(e) => setScheduleWindowStart(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Janela calendário fim</span>
              <input
                type="datetime-local"
                value={scheduleWindowEnd}
                onChange={(e) => setScheduleWindowEnd(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Duração jogo (min)</span>
              <input
                type="number"
                min={10}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Slot (min)</span>
              <input
                type="number"
                min={5}
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Buffer (min)</span>
              <input
                type="number"
                min={0}
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Descanso (min)</span>
              <input
                type="number"
                min={0}
                value={minRestMinutes}
                onChange={(e) => setMinRestMinutes(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Prioridade agenda</span>
              <select
                value={schedulePriority}
                onChange={(e) =>
                  setSchedulePriority(e.target.value === "KNOCKOUT_FIRST" ? "KNOCKOUT_FIRST" : "GROUPS_FIRST")
                }
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="GROUPS_FIRST">Grupos primeiro</option>
                <option value="KNOCKOUT_FIRST">Eliminatórias primeiro</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={waitlistEnabled}
                onChange={(e) => setWaitlistEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
              />
              Lista de espera ativa (quando não há vaga)
            </label>
          </div>

          {scheduleWarnings.length > 0 && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100">
              {scheduleWarnings.map((warning) => (
                <p key={`schedule-warning-${warning}`}>{warning}</p>
              ))}
            </div>
          )}

          {capacityPlanLoading && (
            <div className="rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-[12px] text-white/70">
              A calcular viabilidade por formato/campos…
            </div>
          )}
          {capacityPlanError && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100">
              {capacityPlanError}
            </div>
          )}
          {capacityPlan && (
            <div
              className={`rounded-2xl border px-4 py-3 text-[12px] ${
                capacityPlan.feasible
                  ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
                  : "border-amber-300/40 bg-amber-500/10 text-amber-100"
              }`}
            >
              <p className="font-semibold">Planeador por formato</p>
              <p>
                Slots {capacityPlan.totalSlots} · Jogos necessários {capacityPlan.matchesNeeded} · Em falta{" "}
                {Math.max(0, capacityPlan.unscheduledMatches)} · Campos {capacityPlan.courtsUsed}.
              </p>
              <div className="mt-2 space-y-1 text-[11px]">
                {capacityPlan.categories.slice(0, 6).map((category) => (
                  <p key={`planner-cat-${category.key}`}>
                    • {category.label}: {category.teams} equipas · mínimo {category.minTeams} · jogos{" "}
                    {category.matchesNeeded}/{category.allocatedSlots}
                    {typeof category.recommendedMaxTeams === "number"
                      ? ` · recomendado ${category.recommendedMaxTeams}`
                      : ""}
                    {typeof category.hardCapMax === "number" ? ` · hard cap ${category.hardCapMax}` : ""}
                    {typeof category.queueEstimatedRounds === "number"
                      ? ` · fila ~${category.queueEstimatedRounds} ronda(s)`
                      : ""}
                  </p>
                ))}
              </div>
              {capacityPlan.alternatives.length > 0 && (
                <div className="mt-2 space-y-1 text-[11px]">
                  {capacityPlan.alternatives.slice(0, 3).map((alternative, idx) => (
                    <p key={`planner-alt-${idx}`}>• {alternative.summary}</p>
                  ))}
                </div>
              )}
              {(capacityPlan.warnings.length > 0 || capacityPlan.blockingReasons.length > 0) && (
                <p className="mt-2 text-[11px] opacity-90">
                  {capacityPlan.warnings.length > 0
                    ? `Avisos: ${capacityPlan.warnings.slice(0, 2).join(" · ")}. `
                    : ""}
                  {capacityPlan.blockingReasons.length > 0
                    ? `Bloqueios técnicos: ${capacityPlan.blockingReasons.join(" · ")}.`
                    : ""}
                </p>
              )}
              <p className="mt-2 text-[11px] opacity-80">Publicação mantém warn-only; bloqueio duro é na geração/agendamento.</p>
            </div>
          )}
          {renderSectionIssues(registrationIssues)}
      </CreateWizardSectionCard>

      <CreateWizardSectionCard
        id="wizard-categories"
        title="Categorias e Pricing"
        subtitle="Define categorias ativas, preço por jogador, capacidade e formato por categoria."
        statusLabel={categoriesIssues.length === 0 ? "OK" : `Rever (${categoriesIssues.length})`}
        statusTone={categoriesIssues.length === 0 ? "ok" : "warn"}
      >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] uppercase tracking-[0.2em] text-white/60">Categorias</p>
              <p className="text-sm text-white/70">Configura níveis e preços por categoria.</p>
            </div>
            <Link
              href={appendOrganizationIdToHref(
                "/org/padel/tournaments?section=padel-tournaments&padel=categories",
                organizationId,
              )}
              className="text-[12px] text-white/70 underline"
            >
              Gerir categorias
            </Link>
          </div>

          {categories.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-[12px] text-white/60">
              Ainda não tens categorias. Cria pelo menos uma antes de avançar.
            </div>
          ) : (
            <div className="grid gap-3">
              {categories.map((cat) => {
                const draft = categoryDrafts[cat.id];
                return (
                  <div
                    key={`cat-${cat.id}`}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={Boolean(draft?.selected)}
                          onChange={() => toggleCategory(cat.id)}
                          className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                        />
                        <span className="font-semibold">{cat.label}</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                        {cat.genderRestriction && <span>{cat.genderRestriction}</span>}
                        {cat.minLevel && <span>{cat.minLevel}</span>}
                        {cat.maxLevel && <span>{cat.maxLevel}</span>}
                      </div>
                    </div>
                    {draft?.selected && (
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <label className="space-y-1 text-[12px] text-white/70">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">Preço / jogador (€)</span>
                          <input
                            value={draft.price}
                            onChange={(e) =>
                              setCategoryDrafts((prev) => {
                                const current = prev[cat.id] ?? { selected: true, price: "0", capacityTeams: "", format };
                                return {
                                  ...prev,
                                  [cat.id]: { ...current, price: e.target.value },
                                };
                              })
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-1 text-[12px] text-white/70">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">Capacidade (equipas)</span>
                          <input
                            value={draft.capacityTeams}
                            onChange={(e) =>
                              setCategoryDrafts((prev) => {
                                const current = prev[cat.id] ?? { selected: true, price: "0", capacityTeams: "", format };
                                return {
                                  ...prev,
                                  [cat.id]: { ...current, capacityTeams: e.target.value },
                                };
                              })
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                          />
                        </label>
                        <label className="space-y-1 text-[12px] text-white/70">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">Formato da categoria</span>
                          <select
                            value={draft.format}
                            onChange={(e) =>
                              setCategoryDrafts((prev) => {
                                const current = prev[cat.id] ?? { selected: true, price: "0", capacityTeams: "", format };
                                return {
                                  ...prev,
                                  [cat.id]: { ...current, format: e.target.value },
                                };
                              })
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
                          >
                            {PADEL_FORMATS.map((opt) => (
                              <option key={`cat-format-${cat.id}-${opt.value}`} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Categoria principal</span>
              <select
                value={defaultCategoryId ?? ""}
                onChange={(e) => setDefaultCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Seleciona...</option>
                {selectedCategories.map((cat) => (
                  <option key={`default-cat-${cat.id}`} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Formato global (fallback)</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                {PADEL_FORMATS.map((opt) => (
                  <option key={`format-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-white/55">Usado por defeito no torneio e nas categorias sem override.</p>
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-[12px]">
            <p className="text-white/75">
              {categoryFormatOverrides.length > 0
                ? `${categoryFormatOverrides.length} categoria(s) com formato próprio. ${categoryFormatOverridesSummary}${
                    categoryFormatOverrides.length > 3 ? "…" : ""
                  }`
                : "Sem overrides: todas as categorias seguem o formato global."}
            </p>
            <button
              type="button"
              onClick={applyGlobalFormatToSelected}
              disabled={selectedCategories.length === 0 || categoryFormatOverrides.length === 0}
              className={CTA_GHOST}
            >
              Aplicar formato global às selecionadas
            </button>
          </div>
          {renderSectionIssues(categoriesIssues)}
      </CreateWizardSectionCard>

      <CreateWizardSectionCard
        id="wizard-operation"
        title="Formato e Operação"
        subtitle="Elegibilidade, split, ruleset, interclub e seleção de campos/equipa."
        statusLabel={operationIssues.length === 0 ? "OK" : `Rever (${operationIssues.length})`}
        statusTone={operationIssues.length === 0 ? "ok" : "warn"}
      >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Elegibilidade</span>
              <select
                value={eligibility}
                onChange={(e) => setEligibility(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                {ELIGIBILITY_OPTIONS.map((opt) => (
                  <option key={`elig-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Deadline split (h)</span>
              <input
                value={splitDeadlineHours}
                onChange={(e) => setSplitDeadlineHours(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              />
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">RuleSet</span>
              <select
                value={ruleSetId}
                onChange={(e) => setRuleSetId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF]"
              >
                <option value="">Padrão</option>
                {rulesets.map((set) => (
                  <option key={`ruleset-${set.id}`} value={set.id}>
                    {set.name}
                    {set.season ? ` · ${set.season}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70 md:grid-cols-2">
            <label className="flex items-center gap-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={isInterclub}
                onChange={(e) => setIsInterclub(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
              />
              Torneio interclubes (equipas)
            </label>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">Tamanho da equipa</span>
              <input
                type="number"
                min={2}
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                disabled={!isInterclub}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none focus:border-[#6BFFFF] disabled:opacity-60"
              />
            </label>
          </div>

          {selectedClub && courts.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">Campos</p>
                <label className="flex items-center gap-2 text-[12px] text-white/70">
                  <input
                    type="checkbox"
                    checked={useAllCourts}
                    onChange={() => setUseAllCourts((prev) => !prev)}
                    className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                  />
                  Usar todos
                </label>
              </div>
              {!useAllCourts && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {courts.map((court) => (
                    <label key={`court-${court.id}`} className="flex items-center gap-2 text-sm text-white/70">
                      <input
                        type="checkbox"
                        checked={selectedCourtIds.includes(court.id)}
                        onChange={() => toggleCourt(court.id)}
                        className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                      />
                      {court.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedClub && staffMembers.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">Equipa operacional</p>
                <span className="text-[11px] text-white/60">Selecionados: {selectedStaffIds.length}</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {staffMembers.map((staff) => (
                  <label key={`staff-${staff.id}`} className="flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={selectedStaffIds.includes(staff.id)}
                      onChange={() => toggleStaff(staff.id)}
                      className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#6BFFFF]"
                    />
                    <span>
                      {staff.fullName || staff.email || staff.username || `Staff #${staff.id}`}
                      {staff.role ? ` · ${staff.role}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {renderSectionIssues(operationIssues)}
      </CreateWizardSectionCard>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <CreateWizardChecklist title="Checklist de prontidão" items={readinessItems} />
          <div className="rounded-3xl border border-white/12 bg-black/30 p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">Resumo operacional</p>
            <div className="mt-3 space-y-2 text-[12px] text-white/75">
              <p>Clube: {selectedClub?.name ?? "Selecionar clube"}</p>
              <p>Formato global: {resolveFormatLabel(format)}</p>
              <p>Equipa operacional: {selectedStaffIds.length} membro(s)</p>
              <p>Inscrições: {registrationWarnings.length === 0 ? "Janela válida" : "Rever janela"}</p>
            </div>
          </div>
        </aside>
      </div>

      {error && <CreateWizardAlert variant="error">{error}</CreateWizardAlert>}

      {draftEventId && (
        <CreateWizardAlert variant="warning">
          Rascunho criado.{" "}
          <Link
            href={appendOrganizationIdToHref(`/org/padel/tournaments/${draftEventId}`, organizationId)}
            className="underline"
          >
            Abrir torneio
          </Link>
        </CreateWizardAlert>
      )}

      <CreateWizardActionBar>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleSubmit("DRAFT")}
            disabled={saving}
            className={`${CTA_GHOST} disabled:opacity-60`}
          >
            {savingMode === "DRAFT" ? "A guardar…" : "Guardar rascunho"}
          </button>
          <button
            type="button"
            onClick={() => handleSubmit("PUBLISH")}
            disabled={saving}
            className={`${CTA_PRIMARY} disabled:opacity-60`}
          >
            {savingMode === "PUBLISH" ? "A publicar…" : "Publicar"}
          </button>
          <span className="text-[12px] text-white/60">Criar = rascunho. Publicação é validada por lifecycle.</span>
        </div>
      </CreateWizardActionBar>
    </CreateWizardShell>
  );
}
