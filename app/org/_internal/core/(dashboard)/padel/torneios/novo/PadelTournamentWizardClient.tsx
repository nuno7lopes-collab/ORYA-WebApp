"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";
import type { Prisma } from "@prisma/client";
import { PADEL_FORMAT_OPTIONS_PT } from "@/domain/padel/formatPresentation";
import {
  DEFAULT_PADEL_SCORE_RULES,
  type PadelDeuceMode,
} from "@/domain/padel/score";
import {
  PADEL_DEUCE_MODE_OPTIONS,
  PADEL_SCORE_RULE_PRESETS,
  buildScoreRulesFromPreset,
  type PadelScoreRulesPresetId,
} from "@/domain/padel/scorePresets";
import { CTA_PRIMARY } from "@/app/org/_internal/core/dashboardUi";
import {
  OryaDateField,
  OryaDateTimeField,
  OryaTimeField,
} from "@/components/ui/datetime";
import { EventCoverLibraryPicker } from "@/app/org/_internal/core/(dashboard)/eventos/_components/EventCoverLibraryPicker";
import { TournamentFormSurface } from "@/app/org/_internal/core/(dashboard)/padel/_components/TournamentFormSurface";
const fetcher = (url: string) => fetch(url).then((res) => res.json());
type PadelClub = {
  id: number;
  name: string;
  isActive: boolean;
  kind?: "OWN" | "PARTNER" | null;
  sourceClubId?: number | null;
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
  format?: string;
  amMxMode?: "INDIVIDUAL_ROTATION" | "FIXED_PAIR";
  amMxProgressionMode?: "ROUND_BY_ROUND";
  nonStopMode?: "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST";
  nonStopRounds?: string;
  scoreRulesOverride?: boolean;
  scoreRulesPresetId?: PadelScoreRulesPresetId;
  deuceMode?: PadelDeuceMode;
};
type DailyWindowDraft = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
};
type OrganizationMeResponse = {
  organization?: { timezone?: string | null } | null;
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
type WizardFormatProfile = {
  format: string;
  amMxMode?: "INDIVIDUAL_ROTATION" | "FIXED_PAIR";
  amMxProgressionMode?: "ROUND_BY_ROUND";
  nonStopMode?: "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST";
  nonStopRounds?: number;
};
const PADEL_FORMATS = [...PADEL_FORMAT_OPTIONS_PT];
const PADEL_FORMAT_LABEL_BY_VALUE = Object.fromEntries(
  PADEL_FORMATS.map((item) => [item.value, item.label]),
) as Record<string, string>;
const resolveFormatLabel = (value: string) =>
  PADEL_FORMAT_LABEL_BY_VALUE[value] ?? value;
const isAmMxFormat = (value: string) =>
  value === "AMERICANO" || value === "MEXICANO";
const isNonStopFormat = (value: string) => value === "NON_STOP";
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
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
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
const makeWindowId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `window-${Math.random().toString(36).slice(2, 10)}`;
const combineDateAndTime = (date: string, time: string) => {
  if (!date || !time) return "";
  return `${date}T${time}`;
};
const createDailyWindowFromDate = (
  date: Date,
  durationMinutes = 60,
): DailyWindowDraft => {
  const startHour = Math.max(8, Math.min(22, date.getHours() || 9));
  const start = `${pad2(startHour)}:00`;
  const endDate = new Date(date.getTime());
  endDate.setHours(startHour, 0, 0, 0);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  const end = `${pad2(endDate.getHours())}:${pad2(endDate.getMinutes())}`;
  return {
    id: makeWindowId(),
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    startTime: start,
    endTime: end,
  };
};
const formatDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const resolveDailyWindowDurationMinutes = (windowItem: DailyWindowDraft) => {
  const start = parseDateTimeLocal(
    combineDateAndTime(windowItem.date, windowItem.startTime),
  );
  const end = parseDateTimeLocal(
    combineDateAndTime(windowItem.date, windowItem.endTime),
  );
  if (!start || !end || end <= start) return null;
  return Math.round((end.getTime() - start.getTime()) / (60 * 1000));
};
const normalizeDailyWindows = (windows: DailyWindowDraft[]) =>
  windows
    .map((windowItem) => ({
      date: windowItem.date,
      startTime: windowItem.startTime,
      endTime: windowItem.endTime,
      start: parseDateTimeLocal(
        combineDateAndTime(windowItem.date, windowItem.startTime),
      ),
      end: parseDateTimeLocal(
        combineDateAndTime(windowItem.date, windowItem.endTime),
      ),
    }))
    .filter(
      (
        item,
      ): item is {
        date: string;
        startTime: string;
        endTime: string;
        start: Date;
        end: Date;
      } => Boolean(item.start && item.end && item.end > item.start),
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());
const deriveBoundsFromDailyWindows = (windows: DailyWindowDraft[]) => {
  const normalized = normalizeDailyWindows(windows);
  if (normalized.length === 0) return null;
  const start = normalized[0]?.start ?? null;
  const end = normalized[normalized.length - 1]?.end ?? null;
  if (!start || !end) return null;
  return {
    startsAt: formatDateTimeLocal(start),
    endsAt: formatDateTimeLocal(end),
  };
};
function resolveClubLocation(club: PadelClub | null) {
  if (!club) {
    return { formatted: "", addressId: null };
  }
  const formatted =
    club.addressRef?.formattedAddress || club.locationFormattedAddress || "";
  return { formatted, addressId: club.addressId ?? null };
}
export default function PadelTournamentWizardClient({
  organizationId,
}: {
  organizationId: number;
}) {
  const router = useRouter();
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("Torneio Padel");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState("Europe/Lisbon");
  const [registrationStartsAt, setRegistrationStartsAt] = useState("");
  const [registrationEndsAt, setRegistrationEndsAt] = useState("");
  const [dailyWindows, setDailyWindows] = useState<DailyWindowDraft[]>([]);
  const [durationMinutes, setDurationMinutes] = useState("60");
  const slotMinutes = "15";
  const [bufferMinutes, setBufferMinutes] = useState("0");
  const [minRestMinutes, setMinRestMinutes] = useState("10");
  const [schedulePriority, setSchedulePriority] = useState<
    "GROUPS_FIRST" | "KNOCKOUT_FIRST"
  >("GROUPS_FIRST");
  const [showAdvancedPolicies, setShowAdvancedPolicies] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [format, setFormat] = useState<string>(
    PADEL_FORMATS[0]?.value ?? "TODOS_CONTRA_TODOS",
  );
  const [globalAmMxMode, setGlobalAmMxMode] = useState<
    "INDIVIDUAL_ROTATION" | "FIXED_PAIR"
  >("INDIVIDUAL_ROTATION");
  const globalAmMxProgressionMode = "ROUND_BY_ROUND" as const;
  const [globalNonStopMode, setGlobalNonStopMode] = useState<
    "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST"
  >("ACTIVE_QUEUE");
  const [globalNonStopRounds, setGlobalNonStopRounds] = useState("6");
  const [eligibility, setEligibility] = useState<string>("OPEN");
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [ruleSetId, setRuleSetId] = useState<string>("");
  const [globalScorePresetId, setGlobalScorePresetId] =
    useState<PadelScoreRulesPresetId>("STANDARD");
  const [globalDeuceMode, setGlobalDeuceMode] = useState<PadelDeuceMode>(
    DEFAULT_PADEL_SCORE_RULES.deuceMode,
  );
  const [resultValidationMode, setResultValidationMode] = useState<
    "IMMEDIATE_OFFICIAL" | "IMMEDIATE_PENDING_THEN_OFFICIAL"
  >("IMMEDIATE_OFFICIAL");
  const [
    pendingConfirmationWindowMinutes,
    setPendingConfirmationWindowMinutes,
  ] = useState("15");
  const [playerResultSubmissionEnabled, setPlayerResultSubmissionEnabled] =
    useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<number, CategoryDraft>
  >({});
  const [useAllCourts, setUseAllCourts] = useState(true);
  const [selectedCourtIds, setSelectedCourtIds] = useState<number[]>([]);
  const [courtPriorityOrder, setCourtPriorityOrder] = useState<number[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacityPlan, setCapacityPlan] = useState<PlannerResult | null>(null);
  const [capacityPlanLoading, setCapacityPlanLoading] = useState(false);
  const [capacityPlanError, setCapacityPlanError] = useState<string | null>(
    null,
  );
  const [plannerMode, setPlannerMode] = useState<"capacity" | "minimum">(
    "capacity",
  );
  const saving = isSubmitting;
  const { data: clubsRes } = useSWR<{ ok?: boolean; items?: PadelClub[] }>(
    organizationId
      ? `/api/padel/clubs?organizationId=${organizationId}&includeInactive=0`
      : null,
    fetcher,
  );
  const { data: categoriesRes } = useSWR<{
    ok?: boolean;
    items?: PadelCategory[];
  }>(
    organizationId
      ? `/api/padel/categories/my?organizationId=${organizationId}&includeInactive=0`
      : null,
    fetcher,
  );
  const { data: rulesetsRes } = useSWR<{
    ok?: boolean;
    items?: PadelRuleSet[];
  }>(
    organizationId
      ? `/api/padel/rulesets?organizationId=${organizationId}`
      : null,
    fetcher,
  );
  const { data: organizationMe } = useSWR<OrganizationMeResponse>(
    organizationId ? `/api/org/${organizationId}/me` : null,
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
  const clubs = useMemo(
    () => (Array.isArray(clubsRes?.items) ? (clubsRes?.items ?? []) : []),
    [clubsRes?.items],
  );
  const selectableClubs = useMemo(
    () => clubs.filter((club) => club.kind !== "PARTNER"),
    [clubs],
  );
  const categories = useMemo(
    () =>
      Array.isArray(categoriesRes?.items) ? (categoriesRes?.items ?? []) : [],
    [categoriesRes?.items],
  );
  const rulesets = useMemo(
    () => (Array.isArray(rulesetsRes?.items) ? (rulesetsRes?.items ?? []) : []),
    [rulesetsRes?.items],
  );
  const courts = useMemo(
    () => (Array.isArray(courtsRes?.items) ? (courtsRes?.items ?? []) : []),
    [courtsRes?.items],
  );
  const staffMembers = useMemo(
    () =>
      (Array.isArray(staffRes?.items) ? (staffRes?.items ?? []) : []).filter(
        (staff) => staff.isActive !== false,
      ),
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
    setCourtPriorityOrder([]);
    setUseAllCourts(true);
  }, [selectedClubId]);
  useEffect(() => {
    const activeStaffIds = new Set(staffMembers.map((staff) => staff.id));
    const inherited = staffMembers
      .filter((staff) => staff.inheritToEvents)
      .map((staff) => staff.id);
    setSelectedStaffIds((prev) => {
      if (staffMembers.length === 0) return prev.length > 0 ? [] : prev;
      const validPrev = prev.filter((id) => activeStaffIds.has(id));
      if (validPrev.length > 0) {
        const unchanged =
          validPrev.length === prev.length &&
          validPrev.every((id, idx) => id === prev[idx]);
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
        const current = next[cat.id];
        if (!current) {
          next[cat.id] = {
            selected: false,
            price: "0",
            capacityTeams: "",
            scoreRulesOverride: false,
            scoreRulesPresetId: "STANDARD",
            deuceMode: globalDeuceMode,
          };
          return;
        }
        next[cat.id] = current;
      });
      Object.keys(next).forEach((key) => {
        const id = Number(key);
        if (!categories.find((cat) => cat.id === id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [categories, globalDeuceMode]);
  useEffect(() => {
    const organizationTimezone = organizationMe?.organization?.timezone?.trim();
    if (organizationTimezone) {
      setTimezone((prev) =>
        prev === "Europe/Lisbon" ? organizationTimezone : prev,
      );
    }
  }, [organizationMe?.organization?.timezone]);
  useEffect(() => {
    if (!registrationStartsAt) {
      const now = formatDateTimeLocal(new Date());
      if (now) setRegistrationStartsAt(now);
    }
  }, []);
  useEffect(() => {
    if (dailyWindows.length > 0) return;
    const baseDate = parseDateTimeLocal(startsAt) ?? new Date();
    setDailyWindows([
      createDailyWindowFromDate(baseDate, asNumber(durationMinutes) ?? 60),
    ]);
  }, [dailyWindows.length, startsAt, durationMinutes]);
  useEffect(() => {
    const bounds = deriveBoundsFromDailyWindows(dailyWindows);
    if (!bounds) {
      setStartsAt("");
      setEndsAt("");
      return;
    }
    if (startsAt !== bounds.startsAt) setStartsAt(bounds.startsAt);
    if (endsAt !== bounds.endsAt) setEndsAt(bounds.endsAt);
  }, [dailyWindows, endsAt, startsAt]);
  useEffect(() => {
    if (!startsAt) return;
    if (!registrationEndsAt) {
      const shifted = shiftDateTimeLocal(startsAt, -24 * 60);
      if (shifted) setRegistrationEndsAt(shifted);
    }
  }, [startsAt, registrationEndsAt]);
  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === Number(selectedClubId)) ?? null,
    [clubs, selectedClubId],
  );
  const location = useMemo(
    () => resolveClubLocation(selectedClub),
    [selectedClub],
  );
  const selectedCategories = useMemo(
    () => categories.filter((cat) => categoryDrafts[cat.id]?.selected),
    [categories, categoryDrafts],
  );
  const normalizedDailyWindows = useMemo(
    () => normalizeDailyWindows(dailyWindows),
    [dailyWindows],
  );
  const scheduleWindowStart = useMemo(() => {
    if (normalizedDailyWindows.length === 0) return "";
    return formatDateTimeLocal(normalizedDailyWindows[0]!.start);
  }, [normalizedDailyWindows]);
  const scheduleWindowEnd = useMemo(() => {
    if (normalizedDailyWindows.length === 0) return "";
    return formatDateTimeLocal(
      normalizedDailyWindows[normalizedDailyWindows.length - 1]!.end,
    );
  }, [normalizedDailyWindows]);
  const scheduleSummary = useMemo(() => {
    const totalMinutes = normalizedDailyWindows.reduce((acc, windowItem) => {
      const delta = Math.round(
        (windowItem.end.getTime() - windowItem.start.getTime()) / (60 * 1000),
      );
      return acc + Math.max(0, delta);
    }, 0);
    const invalidDays = Math.max(
      0,
      dailyWindows.length - normalizedDailyWindows.length,
    );
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      validDays: normalizedDailyWindows.length,
      invalidDays,
      totalMinutes,
      totalLabel: `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`,
    };
  }, [dailyWindows.length, normalizedDailyWindows]);
  const globalScoreRulesPreview = useMemo(
    () =>
      buildScoreRulesFromPreset(
        globalScorePresetId,
        DEFAULT_PADEL_SCORE_RULES,
        globalDeuceMode,
      ),
    [globalDeuceMode, globalScorePresetId],
  );
  const buildFormatProfile = useCallback(
    (
      formatValue: string,
      options?: {
        amMxMode?: "INDIVIDUAL_ROTATION" | "FIXED_PAIR";
        amMxProgressionMode?: "ROUND_BY_ROUND";
        nonStopMode?: "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST";
        nonStopRoundsRaw?: string | number | null;
      },
    ): WizardFormatProfile => {
      const profile: WizardFormatProfile = { format: formatValue };
      if (isAmMxFormat(formatValue)) {
        profile.amMxMode = options?.amMxMode ?? globalAmMxMode;
        profile.amMxProgressionMode =
          options?.amMxProgressionMode ?? globalAmMxProgressionMode;
      }
      if (isNonStopFormat(formatValue)) {
        profile.nonStopMode = options?.nonStopMode ?? globalNonStopMode;
        const roundsSource =
          typeof options?.nonStopRoundsRaw === "number"
            ? String(options.nonStopRoundsRaw)
            : typeof options?.nonStopRoundsRaw === "string"
              ? options.nonStopRoundsRaw
              : globalNonStopRounds;
        const roundsRaw = asNumber(roundsSource);
        profile.nonStopRounds =
          roundsRaw && roundsRaw > 0 ? Math.floor(roundsRaw) : 6;
      }
      return profile;
    },
    [
      globalAmMxMode,
      globalAmMxProgressionMode,
      globalNonStopMode,
      globalNonStopRounds,
    ],
  );
  const resolveCategoryFormatProfile = useCallback(
    (categoryId: number): WizardFormatProfile => {
      const draft = categoryDrafts[categoryId];
      const categoryFormat = draft?.format ?? format;
      return buildFormatProfile(categoryFormat, {
        amMxMode: draft?.amMxMode,
        amMxProgressionMode: draft?.amMxProgressionMode,
        nonStopMode: draft?.nonStopMode,
        nonStopRoundsRaw: draft?.nonStopRounds,
      });
    },
    [buildFormatProfile, categoryDrafts, format],
  );
  const activeCourts = useMemo(
    () =>
      courts
        .filter((court) => court.isActive)
        .sort((a, b) => {
          const orderA =
            typeof a.displayOrder === "number"
              ? a.displayOrder
              : Number.MAX_SAFE_INTEGER;
          const orderB =
            typeof b.displayOrder === "number"
              ? b.displayOrder
              : Number.MAX_SAFE_INTEGER;
          return orderA - orderB || a.id - b.id;
        }),
    [courts],
  );
  useEffect(() => {
    const activeIds = activeCourts.map((court) => court.id);
    setSelectedCourtIds((prev) =>
      prev.filter((courtId) => activeIds.includes(courtId)),
    );
    setCourtPriorityOrder((prev) => {
      const filtered = prev.filter((courtId) => activeIds.includes(courtId));
      const missing = activeIds.filter(
        (courtId) => !filtered.includes(courtId),
      );
      return [...filtered, ...missing];
    });
  }, [activeCourts]);
  const effectiveCourtIds = useMemo(() => {
    const activeIds = activeCourts.map((court) => court.id);
    if (useAllCourts) return activeIds;
    const activeSet = new Set(activeIds);
    const filtered = selectedCourtIds.filter((courtId) =>
      activeSet.has(courtId),
    );
    return Array.from(new Set(filtered));
  }, [activeCourts, selectedCourtIds, useAllCourts]);
  const prioritizedCourtIds = useMemo(() => {
    const selected = new Set(effectiveCourtIds);
    const ordered = courtPriorityOrder.filter((courtId) =>
      selected.has(courtId),
    );
    const missing = effectiveCourtIds.filter(
      (courtId) => !ordered.includes(courtId),
    );
    return [...ordered, ...missing];
  }, [courtPriorityOrder, effectiveCourtIds]);
  const resolvedCourts = useMemo(() => {
    const byId = new Map(activeCourts.map((court) => [court.id, court]));
    return prioritizedCourtIds
      .map((courtId) => byId.get(courtId))
      .filter((court): court is Court => Boolean(court));
  }, [activeCourts, prioritizedCourtIds]);
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
      warnings.push(
        "O fim das inscrições precisa de ser antes do início do torneio.",
      );
    }
    return warnings;
  }, [registrationStartsAt, registrationEndsAt, startsAt]);
  const scheduleWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (dailyWindows.length === 0) {
      warnings.push("Define pelo menos um dia com horário.");
      return warnings;
    }
    if (normalizedDailyWindows.length !== dailyWindows.length) {
      warnings.push("Existem dias com horário inválido (fim antes do início).");
    }
    const windowStart = parseDateTimeLocal(scheduleWindowStart);
    const windowEnd = parseDateTimeLocal(scheduleWindowEnd);
    if (windowStart && windowEnd && windowEnd <= windowStart) {
      warnings.push("A janela oficial do torneio está inválida.");
    }
    const byDate = new Map<string, Array<{ start: Date; end: Date }>>();
    normalizedDailyWindows.forEach((windowItem) => {
      const rows = byDate.get(windowItem.date) ?? [];
      rows.push({ start: windowItem.start, end: windowItem.end });
      byDate.set(windowItem.date, rows);
    });
    for (const [date, windows] of byDate.entries()) {
      if (windows.length < 2) continue;
      const ordered = [...windows].sort(
        (a, b) => a.start.getTime() - b.start.getTime(),
      );
      let hasOverlap = false;
      for (let idx = 1; idx < ordered.length; idx += 1) {
        const prev = ordered[idx - 1];
        const current = ordered[idx];
        if (!prev || !current) continue;
        if (current.start < prev.end) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap)
        warnings.push(`Existem janelas sobrepostas no dia ${date}.`);
    }
    return warnings;
  }, [
    dailyWindows,
    normalizedDailyWindows,
    scheduleWindowEnd,
    scheduleWindowStart,
  ]);
  useEffect(() => {
    const windowStart = toIsoFromLocalInput(scheduleWindowStart);
    const windowEnd = toIsoFromLocalInput(scheduleWindowEnd);
    const plannedCourtIds = prioritizedCourtIds;
    const duration = asNumber(durationMinutes) ?? 60;
    const buffer = asNumber(bufferMinutes) ?? 0;
    if (
      !organizationId ||
      !windowStart ||
      !windowEnd ||
      new Date(windowEnd) <= new Date(windowStart) ||
      selectedCategories.length === 0 ||
      plannedCourtIds.length === 0
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
      dailyWindows: normalizedDailyWindows.map((windowItem) => ({
        date: windowItem.date,
        startTime: windowItem.startTime,
        endTime: windowItem.endTime,
      })),
      durationMinutes: Math.max(1, Math.round(duration)),
      bufferMinutes: Math.max(0, Math.round(buffer)),
      courtIds: plannedCourtIds,
      courtPriorityOrder: plannedCourtIds,
      categoryWeights: selectedCategories.reduce<Record<string, number>>(
        (acc, category) => {
          acc[String(category.id)] = 1;
          return acc;
        },
        {},
      ),
      categories: selectedCategories.map((category) => {
        const draft = categoryDrafts[category.id];
        const profile = resolveCategoryFormatProfile(category.id);
        const categoryFormat = profile.format;
        const teams = asNumber(draft?.capacityTeams ?? "");
        const defaultTeams = categoryFormat === "GRUPOS_ELIMINATORIAS" ? 4 : 2;
        const plannedTeams =
          plannerMode === "minimum"
            ? defaultTeams
            : teams && teams > 0
              ? Math.max(defaultTeams, Math.floor(teams))
              : defaultTeams;
        return {
          categoryId: category.id,
          label: category.label,
          teams: plannedTeams,
          format: categoryFormat,
          amMxMode: profile.amMxMode,
          amMxProgressionMode: profile.amMxProgressionMode,
          nonStopMode: profile.nonStopMode,
          nonStopRounds: profile.nonStopRounds,
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
          const message = sanitizeUiErrorMessage(
            json?.error,
            "Planner de capacidade indisponível.",
          );
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
    bufferMinutes,
    categoryDrafts,
    durationMinutes,
    endsAt,
    format,
    organizationId,
    prioritizedCourtIds,
    resolveCategoryFormatProfile,
    scheduleWindowEnd,
    scheduleWindowStart,
    normalizedDailyWindows,
    selectedCategories,
    plannerMode,
  ]);
  const toggleCategory = (id: number) => {
    setCategoryDrafts((prev) => {
      const current = prev[id] ?? {
        selected: false,
        price: "0",
        capacityTeams: "",
        scoreRulesOverride: false,
        scoreRulesPresetId: "STANDARD",
        deuceMode: globalDeuceMode,
      };
      return { ...prev, [id]: { ...current, selected: !current.selected } };
    });
  };
  const patchCategoryDraft = useCallback(
    (id: number, patch: Partial<CategoryDraft>) => {
      setCategoryDrafts((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] ?? {
            selected: true,
            price: "0",
            capacityTeams: "",
            scoreRulesOverride: false,
            scoreRulesPresetId: "STANDARD",
            deuceMode: globalDeuceMode,
          }),
          ...patch,
        },
      }));
    },
    [globalDeuceMode],
  );
  const toggleCourt = (courtId: number) => {
    setSelectedCourtIds((prev) => {
      const next = prev.includes(courtId)
        ? prev.filter((id) => id !== courtId)
        : [...prev, courtId];
      return next;
    });
    setCourtPriorityOrder((prev) => {
      if (prev.includes(courtId)) return prev;
      return [...prev, courtId];
    });
  };
  const moveCourtPriority = (courtId: number, direction: -1 | 1) => {
    const selectedSet = new Set(effectiveCourtIds);
    setCourtPriorityOrder((prev) => {
      const activeIds = activeCourts.map((court) => court.id);
      const current = [
        ...prev.filter((id) => activeIds.includes(id)),
        ...activeIds.filter((id) => !prev.includes(id)),
      ];
      const selected = current.filter((id) => selectedSet.has(id));
      const currentIdx = selected.indexOf(courtId);
      if (currentIdx < 0) return current;
      const targetIdx = currentIdx + direction;
      if (targetIdx < 0 || targetIdx >= selected.length) return current;
      const nextSelected = [...selected];
      const swapValue = nextSelected[targetIdx]!;
      nextSelected[targetIdx] = nextSelected[currentIdx]!;
      nextSelected[currentIdx] = swapValue;
      const rest = current.filter((id) => !selectedSet.has(id));
      return [...nextSelected, ...rest];
    });
  };
  const handleSubmit = async () => {
    setError(null);
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
    if (selectedCategories.length === 0) {
      setError("Seleciona pelo menos uma categoria.");
      return;
    }
    if (!location.addressId) {
      setError("A morada do clube precisa de estar normalizada (Apple Maps).");
      return;
    }
    if (registrationWarnings.length > 0) {
      setError(registrationWarnings[0]);
      return;
    }
    if (scheduleWarnings.length > 0) {
      setError(scheduleWarnings[0]);
      return;
    }
    const invalidNonStopCategory = selectedCategories.find((category) => {
      const profile = resolveCategoryFormatProfile(category.id);
      return (
        isNonStopFormat(profile.format) &&
        (!profile.nonStopRounds || profile.nonStopRounds < 1)
      );
    });
    if (invalidNonStopCategory) {
      setError(
        `Define rondas válidas para NON_STOP em ${invalidNonStopCategory.label}.`,
      );
      return;
    }
    const pendingWindowRaw = asNumber(pendingConfirmationWindowMinutes);
    if (!pendingWindowRaw || pendingWindowRaw <= 0) {
      setError("Janela pendente inválida (1-240 minutos).");
      return;
    }
    const pendingWindow = Math.max(
      1,
      Math.min(240, Math.floor(pendingWindowRaw)),
    );
    const categoryConfigs = selectedCategories.map((cat) => {
      const draft = categoryDrafts[cat.id];
      const profile = resolveCategoryFormatProfile(cat.id);
      const priceValue = asNumber(draft?.price ?? "0") ?? 0;
      const capacityValue = asNumber(draft?.capacityTeams ?? "") ?? null;
      return {
        padelCategoryId: cat.id,
        pricePerPlayer: Math.max(0, priceValue),
        capacityTeams:
          capacityValue && capacityValue > 0 ? Math.floor(capacityValue) : null,
        format: profile.format,
        currency: "EUR",
      };
    });
    const hasPaid = categoryConfigs.some(
      (cfg) => (cfg.pricePerPlayer ?? 0) > 0,
    );
    const scheduleDuration = asNumber(durationMinutes) ?? 60;
    const scheduleSlot = asNumber(slotMinutes) ?? 15;
    const scheduleBuffer = asNumber(bufferMinutes) ?? 0;
    const scheduleRest = asNumber(minRestMinutes) ?? 10;
    const numberOfCourts = Math.max(1, courtsCount || 1);
    const courtIdsPayload = effectiveCourtIds;
    const courtPriorityOrderPayload = prioritizedCourtIds;
    const primaryFormat = selectedCategories[0]
      ? resolveCategoryFormatProfile(selectedCategories[0].id).format
      : format;
    const allSelectedFormats = selectedCategories.map(
      (category) => resolveCategoryFormatProfile(category.id).format,
    );
    const allFormatsNonStop =
      allSelectedFormats.length > 0 &&
      allSelectedFormats.every((value) => isNonStopFormat(value));
    const globalScoreRules = buildScoreRulesFromPreset(
      globalScorePresetId,
      DEFAULT_PADEL_SCORE_RULES,
      globalDeuceMode,
    );
    const scoreRulesByCategory = selectedCategories.reduce<
      Record<string, ReturnType<typeof buildScoreRulesFromPreset>>
    >((acc, category) => {
      const draft = categoryDrafts[category.id];
      if (draft?.scoreRulesOverride !== true) return acc;
      const presetId = draft.scoreRulesPresetId ?? "STANDARD";
      const deuceMode = draft.deuceMode ?? globalDeuceMode;
      acc[String(category.id)] = buildScoreRulesFromPreset(
        presetId,
        globalScoreRules,
        deuceMode,
      );
      return acc;
    }, {});
    const baseFormatProfile = buildFormatProfile(format);
    const formatProfilesByCategory = selectedCategories.reduce<
      Record<string, WizardFormatProfile>
    >(
      (acc, category) => {
        acc[String(category.id)] = resolveCategoryFormatProfile(category.id);
        return acc;
      },
      { global: { ...baseFormatProfile } },
    );
    const courtsFromClubs = (
      resolvedCourts.length > 0 ? resolvedCourts : activeCourts
    ).map((court, idx) => ({
      id: court.id,
      clubId: clubIdValue,
      clubName: selectedClub?.name ?? null,
      name: court.name,
      indoor: court.indoor ?? null,
      displayOrder:
        typeof court.displayOrder === "number" ? court.displayOrder : idx,
    }));
    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      coverImageUrl,
      startsAt,
      endsAt,
      status: "DRAFT",
      timezone: timezone || undefined,
      addressId: location.addressId,
      pricingMode: hasPaid ? "STANDARD" : "FREE_ONLY",
      padel: {
        clubId: clubIdValue,
        categoryIds: selectedCategories.map((cat) => cat.id),
        format: primaryFormat,
        eligibilityType: eligibility,
        ruleSetId: ruleSetId ? Number(ruleSetId) : null,
        resultValidationMode,
        pendingConfirmationWindowMinutes: pendingWindow,
        playerResultSubmissionEnabled,
        isInterclub: false,
        teamSize: null,
        categoryConfigs,
        courtIds: courtIdsPayload,
        staffIds: selectedStaffIds,
        numberOfCourts,
        padelV2Enabled: true,
        advancedSettings: {
          waitlistEnabled,
          scoreRules: globalScoreRules,
          scoreRulesByCategory,
          registrationStartsAt: toIsoFromLocalInput(registrationStartsAt),
          registrationEndsAt: toIsoFromLocalInput(registrationEndsAt),
          gameDurationMinutes: Number.isFinite(scheduleDuration)
            ? Math.max(1, Math.round(scheduleDuration))
            : null,
          scheduleDefaults: {
            windowStart: toIsoFromLocalInput(scheduleWindowStart),
            windowEnd: toIsoFromLocalInput(scheduleWindowEnd),
            dailyWindows: normalizedDailyWindows.map((windowItem) => ({
              date: windowItem.date,
              startTime: windowItem.startTime,
              endTime: windowItem.endTime,
            })),
            durationMinutes: Number.isFinite(scheduleDuration)
              ? Math.max(1, Math.round(scheduleDuration))
              : null,
            slotMinutes: Number.isFinite(scheduleSlot)
              ? Math.max(5, Math.round(scheduleSlot))
              : null,
            bufferMinutes: Number.isFinite(scheduleBuffer)
              ? Math.max(0, Math.round(scheduleBuffer))
              : null,
            minRestMinutes: Number.isFinite(scheduleRest)
              ? Math.max(0, Math.round(scheduleRest))
              : null,
            priority: allFormatsNonStop ? null : schedulePriority,
          },
          formatProfilesByCategory,
          capacityPolicy: {
            publishWarnOnly: true,
            hardBlockGenerate: true,
            hardBlockAutoSchedule: true,
          },
          categoryWeights: selectedCategories.reduce<Record<string, number>>(
            (acc, category) => {
              acc[String(category.id)] = 1;
              return acc;
            },
            {},
          ),
          courtSelectionDefaults: { useAllCourts, courtIds: courtIdsPayload },
          courtPriorityOrder: courtPriorityOrderPayload,
          rankingWeights: {
            NON_STOP: 0.7,
            AMERICANO: 0.7,
            MEXICANO: 0.7,
            byCategory: selectedCategories.reduce<
              Record<string, Record<string, number>>
            >((acc, category) => {
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
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/org/${organizationId}/tournaments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        if (
          json?.errorCode === "PADEL_CREATE_MOVED" &&
          typeof json?.details?.target === "string"
        ) {
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
        router.push(
          appendOrganizationIdToHref("/org/padel/tournaments", organizationId),
        );
        return;
      }
      router.push(
        appendOrganizationIdToHref(
          `/org/padel/tournaments/${eventId}`,
          organizationId,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? sanitizeUiErrorMessage(err.message, "Erro ao criar torneio.")
          : "Erro ao criar torneio.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const toggleStaff = (staffId: number) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId],
    );
  };
  const identityIssues = useMemo(() => {
    const issues: string[] = [];
    if (!title.trim()) issues.push("Título em falta.");
    if (!selectedClubId) issues.push("Seleciona um clube.");
    if (selectedClubId && !location.addressId)
      issues.push("Morada do clube não normalizada.");
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
      issues.push(
        "Capacidade por formato insuficiente para a janela/campos atuais.",
      );
    }
    if (capacityPlanError) {
      issues.push("Planner de capacidade indisponível.");
    }
    return issues;
  }, [
    capacityPlan,
    capacityPlanError,
    registrationStartsAt,
    registrationEndsAt,
    scheduleWindowStart,
    scheduleWindowEnd,
  ]);
  const categoriesIssues = useMemo(() => {
    const issues: string[] = [];
    if (selectedCategories.length === 0)
      issues.push("Seleciona pelo menos uma categoria.");
    return issues;
  }, [selectedCategories.length]);
  const operationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!format) issues.push("Formato em falta.");
    if (!eligibility) issues.push("Elegibilidade em falta.");
    if (courtsCount <= 0) issues.push("Sem campos operacionais selecionados.");
    const invalidNonStopCategory = selectedCategories.find((category) => {
      const profile = resolveCategoryFormatProfile(category.id);
      if (!isNonStopFormat(profile.format)) return false;
      return !profile.nonStopRounds || profile.nonStopRounds < 1;
    });
    if (invalidNonStopCategory) {
      issues.push(
        `Define rondas válidas para NON_STOP em ${invalidNonStopCategory.label}.`,
      );
    }
    return issues;
  }, [
    courtsCount,
    eligibility,
    format,
    resolveCategoryFormatProfile,
    selectedCategories,
  ]);
  const renderSectionIssues = (issues: string[]) => {
    const uniqueIssues = Array.from(new Set(issues.filter(Boolean)));
    return uniqueIssues.length > 0 ? (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100"
      >
        <p className="font-semibold">Avisos</p>
        <div className="mt-1 space-y-1">
          {uniqueIssues.slice(0, 3).map((issue, idx) => (
            <p key={`${issue}-${idx}`}>• {issue}</p>
          ))}
          {uniqueIssues.length > 3 ? (
            <p>• +{uniqueIssues.length - 3} aviso(s) adicional(is)</p>
          ) : null}
        </div>
      </div>
    ) : null;
  };
  const tabs = [
    { id: "wizard-identity", label: "Identidade", href: "#wizard-identity" },
    {
      id: "wizard-registration",
      label: "Inscrições",
      href: "#wizard-registration",
    },
    {
      id: "wizard-categories",
      label: "Categorias",
      href: "#wizard-categories",
    },
    { id: "wizard-operation", label: "Operação", href: "#wizard-operation" },
  ];
  return (
    <TournamentFormSurface
      tabs={tabs}
      leftColumn={
        <div>
          <EventCoverLibraryPicker
            value={coverImageUrl}
            onChange={setCoverImageUrl}
            organizationId={organizationId}
            templateType="PADEL"
            title="Capa"
            subtitle="Abrir biblioteca de capas"
          />
        </div>
      }
      rightColumn={
        <div className="space-y-6">
          <section
            id="wizard-identity"
            className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
          >
            <div className="space-y-1 border-b border-white/10 pb-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">
                Identidade
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Título
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                />
              </label>
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Clube
                </span>
                <select
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                >
                  <option value="">Seleciona...</option>
                  {selectableClubs.map((club) => (
                    <option key={`club-${club.id}`} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Início oficial
                </span>
                <input
                  value={startsAt ? startsAt.replace("T", "") : ""}
                  disabled
                  placeholder="Automático"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white/80 outline-none disabled:cursor-not-allowed"
                />
              </label>
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Fim oficial
                </span>
                <input
                  value={endsAt ? endsAt.replace("T", "") : ""}
                  disabled
                  placeholder="Automático"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-white/80 outline-none disabled:cursor-not-allowed"
                />
              </label>
            </div>
            <label className="space-y-1 text-sm text-white/70">
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                Descrição
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
              />
            </label>
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/30 p-5 text-sm text-white/70">
              <p className="text-[12px] uppercase tracking-[0.18em] text-white/50">
                Localização
              </p>
              {selectedClub ? (
                <div>
                  <p className="font-semibold text-white">
                    {selectedClub.name}
                  </p>
                  <p className="text-[12px] text-white/60">
                    {location.formatted || "Morada por definir"}
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-white/60">Seleciona um clube.</p>
              )}
            </div>
            {renderSectionIssues(identityIssues)}
          </section>
          <section
            id="wizard-registration"
            className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
          >
            <div className="space-y-1 border-b border-white/10 pb-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">
                Inscrições
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Fuso horário
                </span>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={`tz-${tz}`} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Inscrições abrem
                </span>
                <OryaDateTimeField
                  value={registrationStartsAt}
                  onChange={setRegistrationStartsAt}
                  className="w-full flex-col items-stretch gap-2 xl:flex-row xl:items-center"
                  dateButtonClassName="h-10 w-full min-w-0 rounded-xl xl:flex-1"
                  timeButtonClassName="h-10 w-full min-w-0 rounded-xl xl:w-[112px] xl:flex-none"
                />
              </label>
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Inscrições fecham
                </span>
                <OryaDateTimeField
                  value={registrationEndsAt}
                  onChange={setRegistrationEndsAt}
                  minDateTime={registrationStartsAt || undefined}
                  className="w-full flex-col items-stretch gap-2 xl:flex-row xl:items-center"
                  dateButtonClassName="h-10 w-full min-w-0 rounded-xl xl:flex-1"
                  timeButtonClassName="h-10 w-full min-w-0 rounded-xl xl:w-[112px] xl:flex-none"
                />
              </label>
            </div>
            {registrationWarnings.length > 0 && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100"
              >
                {registrationWarnings.map((warning) => (
                  <p key={`reg-warning-${warning}`}>{warning}</p>
                ))}
              </div>
            )}
            <div className="space-y-3 rounded-3xl border border-white/10 bg-black/30 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">
                    Dias e horários
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDailyWindows((prev) => {
                        if (prev.length === 0) {
                          return [
                            createDailyWindowFromDate(
                              parseDateTimeLocal(startsAt) ?? new Date(),
                              asNumber(durationMinutes) ?? 60,
                            ),
                          ];
                        }
                        const last = prev[prev.length - 1] ?? null;
                        const baseDate = last
                          ? parseDateTimeLocal(`${last.date}T00:00`)
                          : (parseDateTimeLocal(startsAt) ?? new Date());
                        const nextDate = baseDate
                          ? new Date(baseDate.getTime())
                          : new Date();
                        nextDate.setDate(nextDate.getDate() + 1);
                        const startTime = last?.startTime ?? "09:00";
                        const endTime = last?.endTime ?? "10:00";
                        return [
                          ...prev,
                          {
                            id: makeWindowId(),
                            date: formatDateInputValue(nextDate),
                            startTime,
                            endTime,
                          },
                        ];
                      })
                    }
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/80 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99]"
                  >
                    Adicionar dia seguinte
                  </button>
                  <button
                    type="button"
                    disabled={dailyWindows.length < 2}
                    onClick={() =>
                      setDailyWindows((prev) => {
                        const first = prev[0];
                        if (!first) return prev;
                        return prev.map((entry, idx) =>
                          idx === 0
                            ? entry
                            : {
                                ...entry,
                                startTime: first.startTime,
                                endTime: first.endTime,
                              },
                        );
                      })
                    }
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Aplicar a todos
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white/70">
                <p>
                  Dias válidos: {scheduleSummary.validDays} · Tempo útil:
                  {scheduleSummary.totalLabel}.
                </p>
                {scheduleSummary.invalidDays > 0 ? (
                  <p className="text-amber-100">
                    Existem {scheduleSummary.invalidDays} dia(s) com horário
                    inválido.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                {dailyWindows.map((windowItem, idx) => {
                  const windowDurationMinutes =
                    resolveDailyWindowDurationMinutes(windowItem);
                  return (
                    <div
                      key={windowItem.id}
                      className="grid gap-2 rounded-xl border border-white/10 bg-black/25 p-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_160px_160px_auto]"
                    >
                      <label className="space-y-1 text-[12px] text-white/70">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                          Dia {idx + 1}
                        </span>
                        <OryaDateField
                          value={windowItem.date}
                          onChange={(next) =>
                            setDailyWindows((prev) =>
                              prev.map((entry) =>
                                entry.id === windowItem.id
                                  ? { ...entry, date: next }
                                  : entry,
                              ),
                            )
                          }
                          buttonClassName="h-10 w-full min-w-0 rounded-xl justify-between"
                          className="w-full"
                        />
                        {windowDurationMinutes ? (
                          <p className="text-[10px] text-white/55">
                            Duração: {Math.floor(windowDurationMinutes / 60)}h
                            {windowDurationMinutes % 60 > 0
                              ? ` ${windowDurationMinutes % 60}m`
                              : ""}
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-100">
                            Horário inválido
                          </p>
                        )}
                      </label>
                      <label className="space-y-1 text-[12px] text-white/70">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                          Início
                        </span>
                        <OryaTimeField
                          value={windowItem.startTime}
                          onChange={(next) =>
                            setDailyWindows((prev) =>
                              prev.map((entry) =>
                                entry.id === windowItem.id
                                  ? { ...entry, startTime: next }
                                  : entry,
                              ),
                            )
                          }
                          maxTime={windowItem.endTime || undefined}
                          buttonClassName="h-10 w-full min-w-0 rounded-xl justify-between"
                          className="w-full"
                        />
                      </label>
                      <label className="space-y-1 text-[12px] text-white/70">
                        <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                          Fim
                        </span>
                        <OryaTimeField
                          value={windowItem.endTime}
                          onChange={(next) =>
                            setDailyWindows((prev) =>
                              prev.map((entry) =>
                                entry.id === windowItem.id
                                  ? { ...entry, endTime: next }
                                  : entry,
                              ),
                            )
                          }
                          minTime={windowItem.startTime || undefined}
                          buttonClassName="h-10 w-full min-w-0 rounded-xl justify-between"
                          className="w-full"
                        />
                      </label>
                      <div className="flex flex-wrap items-end justify-end gap-2 md:col-span-2 xl:col-span-1 xl:flex-col">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            setDailyWindows((prev) => {
                              const currentIdx = prev.findIndex(
                                (entry) => entry.id === windowItem.id,
                              );
                              if (currentIdx <= 0) return prev;
                              const above = prev[currentIdx - 1];
                              if (!above) return prev;
                              return prev.map((entry, entryIdx) =>
                                entryIdx === currentIdx
                                  ? {
                                      ...entry,
                                      startTime: above.startTime,
                                      endTime: above.endTime,
                                    }
                                  : entry,
                              );
                            })
                          }
                          className="rounded-lg border border-white/15 px-3 py-2 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Copiar horário
                        </button>
                        <button
                          type="button"
                          disabled={dailyWindows.length <= 1}
                          onClick={() =>
                            setDailyWindows((prev) =>
                              prev.filter(
                                (entry) => entry.id !== windowItem.id,
                              ),
                            )
                          }
                          className="rounded-lg border border-white/15 px-3 py-2 text-[12px] text-white/70 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Duração do jogo (min)
                </span>
                <input
                  type="number"
                  min={10}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                />
              </label>
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Intervalo entre jogos (min)
                </span>
                <input
                  type="number"
                  min={0}
                  value={minRestMinutes}
                  onChange={(e) => setMinRestMinutes(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                />
              </label>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/30 px-5 py-4 text-[12px] text-white/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
                    Avançado
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvancedPolicies((prev) => !prev)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-[12px] text-white/80 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99]"
                >
                  {showAdvancedPolicies ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              {showAdvancedPolicies && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm text-white/70">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                      Elegibilidade
                    </span>
                    <select
                      value={eligibility}
                      onChange={(e) => setEligibility(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                    >
                      {ELIGIBILITY_OPTIONS.map((opt) => (
                        <option key={`elig-${opt.value}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-white/70">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                      Conjunto de regras
                    </span>
                    <select
                      value={ruleSetId}
                      onChange={(e) => setRuleSetId(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                    >
                      <option value="">Padrão</option>
                      {rulesets.map((set) => (
                        <option key={`ruleset-${set.id}`} value={set.id}>
                          {set.name} {set.season ? ` · ${set.season}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!isNonStopFormat(format) && (
                    <label className="space-y-1 text-sm text-white/70">
                      <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                        Prioridade agenda
                      </span>
                      <select
                        value={schedulePriority}
                        onChange={(e) =>
                          setSchedulePriority(
                            e.target.value === "KNOCKOUT_FIRST"
                              ? "KNOCKOUT_FIRST"
                              : "GROUPS_FIRST",
                          )
                        }
                        className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                      >
                        <option value="GROUPS_FIRST">Grupos primeiro</option>
                        <option value="KNOCKOUT_FIRST">
                          Eliminatórias primeiro
                        </option>
                      </select>
                    </label>
                  )}
                  <label className="space-y-1 text-sm text-white/70">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                      Buffer técnico (min)
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={bufferMinutes}
                      onChange={(e) => setBufferMinutes(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                    />
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={waitlistEnabled}
                      onChange={(e) => setWaitlistEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#22D3EE]"
                    />
                    Lista de espera ativa
                  </label>
                  <label className="space-y-1 text-sm text-white/70">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                      Modo de planeamento
                    </span>
                    <select
                      value={plannerMode}
                      onChange={(e) =>
                        setPlannerMode(
                          e.target.value === "minimum" ? "minimum" : "capacity",
                        )
                      }
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                    >
                      <option value="capacity">Capacidade declarada</option>
                      <option value="minimum">Mínimo técnico</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
            {scheduleWarnings.length > 0 && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100"
              >
                {scheduleWarnings.map((warning) => (
                  <p key={`schedule-warning-${warning}`}>{warning}</p>
                ))}
              </div>
            )}
            {capacityPlanLoading && (
              <div className="rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-[12px] text-white/70">
                A calcular viabilidade...
              </div>
            )}
            {capacityPlanError && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100"
              >
                {capacityPlanError}
              </div>
            )}
            {capacityPlan && (
              <div
                className={`rounded-2xl border px-4 py-3 text-[12px] ${capacityPlan.feasible ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100" : "border-amber-300/40 bg-amber-500/10 text-amber-100"}`}
              >
                <p className="font-semibold">Viabilidade</p>
                <p className="text-[11px] opacity-90">
                  Slots {capacityPlan.totalSlots} · Jogos
                  {capacityPlan.matchesNeeded} · Em falta
                  {Math.max(0, capacityPlan.unscheduledMatches)} · Campos
                  {capacityPlan.courtsUsed}.
                </p>
                {(capacityPlan.warnings.length > 0 ||
                  capacityPlan.blockingReasons.length > 0) && (
                  <p className="mt-2 text-[11px] opacity-90">
                    {capacityPlan.warnings.length > 0
                      ? `Avisos: ${capacityPlan.warnings.slice(0, 2).join(" ·")}.`
                      : ""}
                    {capacityPlan.blockingReasons.length > 0
                      ? `Bloqueios técnicos: ${capacityPlan.blockingReasons.join(" ·")}.`
                      : ""}
                  </p>
                )}
              </div>
            )}
            {renderSectionIssues(registrationIssues)}
          </section>
          <section
            id="wizard-categories"
            className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
          >
            <div className="space-y-1 border-b border-white/10 pb-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">
                Categorias
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="space-y-1 text-sm text-white/70">
                <span className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Formato base
                </span>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                >
                  {PADEL_FORMATS.map((opt) => (
                    <option key={`format-${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
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
            </div>
            {(isAmMxFormat(format) || isNonStopFormat(format)) && (
              <div className="grid gap-3 rounded-3xl border border-white/10 bg-black/30 p-4 md:grid-cols-3">
                <div className="md:col-span-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
                    Parâmetros base do formato
                  </p>
                </div>
                {isAmMxFormat(format) && (
                  <label className="space-y-1 text-[12px] text-white/70">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                      Modo AM/MX
                    </span>
                    <select
                      value={globalAmMxMode}
                      onChange={(e) =>
                        setGlobalAmMxMode(
                          e.target.value === "FIXED_PAIR"
                            ? "FIXED_PAIR"
                            : "INDIVIDUAL_ROTATION",
                        )
                      }
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                    >
                      <option value="INDIVIDUAL_ROTATION">
                        Rotação individual
                      </option>
                      <option value="FIXED_PAIR">Duplas fixas</option>
                    </select>
                  </label>
                )}
                {isAmMxFormat(format) && (
                  <div className="space-y-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white/70">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                      Progressão
                    </span>
                    <p>Ronda a ronda (fixo)</p>
                  </div>
                )}
                {isNonStopFormat(format) && (
                  <label className="space-y-1 text-[12px] text-white/70">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                      Modo NON_STOP
                    </span>
                    <select
                      value={globalNonStopMode}
                      onChange={(e) =>
                        setGlobalNonStopMode(
                          e.target.value === "ACTIVE_QUEUE"
                            ? "ACTIVE_QUEUE"
                            : "HARD_CAP_WAITLIST",
                        )
                      }
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                    >
                      <option value="ACTIVE_QUEUE">Fila ativa</option>
                      <option value="HARD_CAP_WAITLIST">
                        Limite rígido + lista de espera
                      </option>
                    </select>
                  </label>
                )}
                {isNonStopFormat(format) && (
                  <label className="space-y-1 text-[12px] text-white/70">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                      Rondas base
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={globalNonStopRounds}
                      onChange={(e) => setGlobalNonStopRounds(e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                    />
                  </label>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-white/70">
                {selectedCategories.length} selecionada(s)
              </p>
            </div>
            {categories.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5 text-[12px] text-white/60">
                Ainda não tens categorias. Cria pelo menos uma antes de avançar.
              </div>
            ) : (
              <div className="grid max-h-[280px] gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-3 md:grid-cols-2">
                {categories.map((cat) => {
                  const draft = categoryDrafts[cat.id];
                  return (
                    <label
                      key={`cat-${cat.id}`}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(draft?.selected)}
                          onChange={() => toggleCategory(cat.id)}
                          className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#22D3EE]"
                        />
                        <span className="font-semibold">{cat.label}</span>
                      </span>
                      <span className="text-[11px] text-white/55">
                        {[cat.genderRestriction, cat.minLevel, cat.maxLevel]
                          .filter(Boolean)
                          .join(" ·")}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {selectedCategories.length > 0 && (
              <div className="space-y-2 rounded-3xl border border-white/10 bg-black/30 p-4">
                <p className="text-[12px] uppercase tracking-[0.16em] text-white/60">
                  Edição das selecionadas
                </p>
                {selectedCategories.map((cat) => {
                  const draft = categoryDrafts[cat.id] ?? {
                    selected: true,
                    price: "0",
                    capacityTeams: "",
                  };
                  const categoryProfile = resolveCategoryFormatProfile(cat.id);
                  const categoryFormat = categoryProfile.format;
                  const hasCustomFormat = Boolean(draft.format);
                  return (
                    <div
                      key={`selected-cat-${cat.id}`}
                      className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">
                          {cat.label}
                        </p>
                        {hasCustomFormat ? (
                          <button
                            type="button"
                            onClick={() =>
                              patchCategoryDraft(cat.id, {
                                format: undefined,
                                amMxMode: undefined,
                                amMxProgressionMode: undefined,
                                nonStopMode: undefined,
                                nonStopRounds: undefined,
                              })
                            }
                            className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99]"
                          >
                            Usar base
                          </button>
                        ) : (
                          <span className="text-[11px] text-white/55">
                            A usar base ({resolveFormatLabel(format)})
                          </span>
                        )}
                      </div>
                      <div className="grid gap-2 md:grid-cols-3">
                        <label className="space-y-1 text-[12px] text-white/70">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                            Preço / jogador (€)
                          </span>
                          <input
                            value={draft.price}
                            onChange={(e) =>
                              patchCategoryDraft(cat.id, {
                                price: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                          />
                        </label>
                        <label className="space-y-1 text-[12px] text-white/70">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                            Capacidade (equipas)
                          </span>
                          <input
                            value={draft.capacityTeams}
                            onChange={(e) =>
                              patchCategoryDraft(cat.id, {
                                capacityTeams: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                          />
                        </label>
                        <label className="space-y-1 text-[12px] text-white/70">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                            Formato da categoria
                          </span>
                          <select
                            value={draft.format ?? format}
                            onChange={(e) =>
                              patchCategoryDraft(cat.id, {
                                format: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                          >
                            {PADEL_FORMATS.map((opt) => (
                              <option
                                key={`cat-format-${cat.id}-${opt.value}`}
                                value={opt.value}
                              >
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {isAmMxFormat(categoryFormat) && (
                        <div className="grid gap-2 md:grid-cols-2">
                          <label className="space-y-1 text-[12px] text-white/70">
                            <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                              Modo AM/MX
                            </span>
                            <select
                              value={draft.amMxMode ?? globalAmMxMode}
                              onChange={(e) =>
                                patchCategoryDraft(cat.id, {
                                  amMxMode:
                                    e.target.value === "FIXED_PAIR"
                                      ? "FIXED_PAIR"
                                      : "INDIVIDUAL_ROTATION",
                                  amMxProgressionMode: "ROUND_BY_ROUND",
                                })
                              }
                              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                            >
                              <option value="INDIVIDUAL_ROTATION">
                                Rotação individual
                              </option>
                              <option value="FIXED_PAIR">Duplas fixas</option>
                            </select>
                          </label>
                          <div className="space-y-1 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[12px] text-white/70">
                            <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                              Progressão
                            </span>
                            <p>Ronda a ronda</p>
                          </div>
                        </div>
                      )}
                      {isNonStopFormat(categoryFormat) && (
                        <div className="grid gap-2 md:grid-cols-2">
                          <label className="space-y-1 text-[12px] text-white/70">
                            <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                              Modo NON_STOP
                            </span>
                            <select
                              value={draft.nonStopMode ?? globalNonStopMode}
                              onChange={(e) =>
                                patchCategoryDraft(cat.id, {
                                  nonStopMode:
                                    e.target.value === "ACTIVE_QUEUE"
                                      ? "ACTIVE_QUEUE"
                                      : "HARD_CAP_WAITLIST",
                                })
                              }
                              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                            >
                              <option value="ACTIVE_QUEUE">Fila ativa</option>
                              <option value="HARD_CAP_WAITLIST">
                                Limite rígido + lista de espera
                              </option>
                            </select>
                          </label>
                          <label className="space-y-1 text-[12px] text-white/70">
                            <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                              Rondas NON_STOP
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={draft.nonStopRounds ?? globalNonStopRounds}
                              onChange={(e) =>
                                patchCategoryDraft(cat.id, {
                                  nonStopRounds: e.target.value,
                                })
                              }
                              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                            />
                          </label>
                        </div>
                      )}
                      <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                        <label className="flex items-center gap-2 text-[12px] text-white/75">
                          <input
                            type="checkbox"
                            checked={draft.scoreRulesOverride === true}
                            onChange={(e) =>
                              patchCategoryDraft(cat.id, {
                                scoreRulesOverride: e.target.checked,
                                scoreRulesPresetId:
                                  draft.scoreRulesPresetId ?? "STANDARD",
                                deuceMode: draft.deuceMode ?? globalDeuceMode,
                              })
                            }
                            className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#22D3EE]"
                          />
                          Personalizar regras de pontuação nesta categoria
                        </label>
                        {draft.scoreRulesOverride === true && (
                          <div className="grid gap-2 md:grid-cols-2">
                            <label className="space-y-1 text-[12px] text-white/70">
                              <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                                Pré-definição de pontuação
                              </span>
                              <select
                                value={draft.scoreRulesPresetId ?? "STANDARD"}
                                onChange={(e) =>
                                  patchCategoryDraft(cat.id, {
                                    scoreRulesPresetId:
                                      (e.target
                                        .value as PadelScoreRulesPresetId) ??
                                      "STANDARD",
                                  })
                                }
                                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                              >
                                {PADEL_SCORE_RULE_PRESETS.map((preset) => (
                                  <option
                                    key={`cat-score-preset-${cat.id}-${preset.id}`}
                                    value={preset.id}
                                  >
                                    {preset.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="space-y-1 text-[12px] text-white/70">
                              <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                                Deuce
                              </span>
                              <select
                                value={draft.deuceMode ?? globalDeuceMode}
                                onChange={(e) =>
                                  patchCategoryDraft(cat.id, {
                                    deuceMode:
                                      e.target.value === "GOLDEN_POINT"
                                        ? "GOLDEN_POINT"
                                        : "ADVANTAGE",
                                  })
                                }
                                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                              >
                                {PADEL_DEUCE_MODE_OPTIONS.map((option) => (
                                  <option
                                    key={`cat-score-deuce-${cat.id}-${option.value}`}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}
                        <p className="text-[11px] text-white/60">
                          Regra efetiva:{" "}
                          {draft.scoreRulesOverride === true
                            ? buildScoreRulesFromPreset(
                                draft.scoreRulesPresetId ?? "STANDARD",
                                globalScoreRulesPreview,
                                draft.deuceMode ?? globalDeuceMode,
                              ).deuceMode === "GOLDEN_POINT"
                              ? "Ponto de ouro"
                              : "Vantagens"
                            : globalScoreRulesPreview.deuceMode ===
                                "GOLDEN_POINT"
                              ? "Ponto de ouro (global)"
                              : "Vantagens (global)"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {renderSectionIssues(categoriesIssues)}
          </section>
          <section
            id="wizard-operation"
            className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6"
          >
            <div className="space-y-1 border-b border-white/10 pb-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/60">
                Operação
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5 space-y-3">
                <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">
                  Operação em direto
                </p>
                <label className="flex items-center gap-2 text-[12px] text-white/75">
                  <input
                    type="checkbox"
                    checked={playerResultSubmissionEnabled}
                    onChange={(e) =>
                      setPlayerResultSubmissionEnabled(e.target.checked)
                    }
                    className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#22D3EE]"
                  />
                  Jogador pode submeter resultado
                </label>
                <label className="space-y-1 text-[12px] text-white/70">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                    Validação
                  </span>
                  <select
                    value={resultValidationMode}
                    onChange={(e) =>
                      setResultValidationMode(
                        e.target.value === "IMMEDIATE_PENDING_THEN_OFFICIAL"
                          ? "IMMEDIATE_PENDING_THEN_OFFICIAL"
                          : "IMMEDIATE_OFFICIAL",
                      )
                    }
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                  >
                    <option value="IMMEDIATE_OFFICIAL">
                      Staff oficial imediato
                    </option>
                    <option value="IMMEDIATE_PENDING_THEN_OFFICIAL">
                      Staff pendente + confirmação
                    </option>
                  </select>
                </label>
                <label className="space-y-1 text-[12px] text-white/70">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                    Janela pendente (min)
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={pendingConfirmationWindowMinutes}
                    onChange={(e) =>
                      setPendingConfirmationWindowMinutes(e.target.value)
                    }
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                  />
                </label>
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5 space-y-3">
                <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">
                  Regras de pontuação (global)
                </p>
                <label className="space-y-1 text-[12px] text-white/70">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                    Pré-definição
                  </span>
                  <select
                    value={globalScorePresetId}
                    onChange={(e) =>
                      setGlobalScorePresetId(
                        (e.target.value as PadelScoreRulesPresetId) ??
                          "STANDARD",
                      )
                    }
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                  >
                    {PADEL_SCORE_RULE_PRESETS.map((preset) => (
                      <option
                        key={`global-score-preset-${preset.id}`}
                        value={preset.id}
                      >
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-[12px] text-white/70">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">
                    Deuce
                  </span>
                  <select
                    value={globalDeuceMode}
                    onChange={(e) =>
                      setGlobalDeuceMode(
                        e.target.value === "GOLDEN_POINT"
                          ? "GOLDEN_POINT"
                          : "ADVANTAGE",
                      )
                    }
                    className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-[#22D3EE] focus-visible:ring-2 focus-visible:ring-[#22D3EE]/40"
                  >
                    {PADEL_DEUCE_MODE_OPTIONS.map((option) => (
                      <option
                        key={`global-score-deuce-${option.value}`}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11px] text-white/60">
                  Regra global ativa:{" "}
                  {globalScoreRulesPreview.deuceMode === "GOLDEN_POINT"
                    ? "Ponto de ouro"
                    : "Vantagens"}
                  .
                </p>
              </div>
            </div>
            {selectedClub && courts.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">
                    Campos
                  </p>
                  <label className="flex items-center gap-2 text-[12px] text-white/70">
                    <input
                      type="checkbox"
                      checked={useAllCourts}
                      onChange={() => {
                        setUseAllCourts((prev) => {
                          const next = !prev;
                          if (!next && selectedCourtIds.length === 0) {
                            setSelectedCourtIds(
                              activeCourts.map((court) => court.id),
                            );
                          }
                          return next;
                        });
                      }}
                      className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#22D3EE]"
                    />
                    Usar todos
                  </label>
                </div>
                {!useAllCourts && (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {courts.map((court) => (
                      <label
                        key={`court-${court.id}`}
                        className="flex items-center gap-2 text-sm text-white/70"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCourtIds.includes(court.id)}
                          onChange={() => toggleCourt(court.id)}
                          className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#22D3EE]"
                        />
                        {court.name}
                      </label>
                    ))}
                  </div>
                )}
                {resolvedCourts.length > 0 && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
                        Prioridade de campos
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setCourtPriorityOrder(
                            activeCourts.map((court) => court.id),
                          )
                        }
                        className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99]"
                      >
                        Repor ordem
                      </button>
                    </div>
                    <div className="space-y-2">
                      {resolvedCourts.map((court, idx) => (
                        <div
                          key={`priority-court-${court.id}`}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/75"
                        >
                          <span>
                            #{idx + 1} · {court.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveCourtPriority(court.id, -1)}
                              className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Subir
                            </button>
                            <button
                              type="button"
                              disabled={idx === resolvedCourts.length - 1}
                              onClick={() => moveCourtPriority(court.id, 1)}
                              className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-white/70 transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.99] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Descer
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {selectedClub && staffMembers.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[12px] uppercase tracking-[0.18em] text-white/60">
                    Staff operacional
                  </p>
                  <span className="text-[11px] text-white/60">
                    Selecionados: {selectedStaffIds.length}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {staffMembers.map((staff) => (
                    <label
                      key={`staff-${staff.id}`}
                      className="flex items-center gap-2 text-sm text-white/70"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStaffIds.includes(staff.id)}
                        onChange={() => toggleStaff(staff.id)}
                        className="h-4 w-4 rounded border-white/30 bg-black/40 text-[#22D3EE]"
                      />
                      <span>
                        {staff.fullName ||
                          staff.email ||
                          staff.username ||
                          `Staff #${staff.id}`}
                        {staff.role ? ` · ${staff.role}` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {renderSectionIssues(operationIssues)}
          </section>
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-300/45 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100"
            >
              {error}
            </div>
          )}
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            aria-busy={isSubmitting}
            className={`${CTA_PRIMARY} disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55`}
          >
            {isSubmitting ? "A criar torneio..." : "Criar torneio"}
          </button>
        </div>
      }
    />
  );
}
