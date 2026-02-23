"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatDateTime, resolveLocale, t } from "@/lib/i18n";
import useSWR from "swr";
import { DEFAULT_PADEL_SCORE_RULES, type PadelScoreRules } from "@/domain/padel/score";
import { resolveCanonicalOrgApiPath } from "@/lib/canonicalOrgApiPath";
import { sanitizeUiErrorMessage } from "@/lib/uiErrorMessage";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { OryaDateTimeField } from "@/components/ui/datetime";
import { EventCoverLibraryPicker } from "@/app/org/_internal/core/(dashboard)/eventos/_components/EventCoverLibraryPicker";
import { TournamentFormSurface } from "@/app/org/_internal/core/(dashboard)/padel/_components/TournamentFormSurface";

type Pairing = {
  id: number;
  pairingStatus: string;
  lifecycleStatus?: string | null;
  pairingJoinMode?: string | null;
  paymentMode: string;
  categoryId?: number | null;
  slots: { id: number; slotRole: string; slotStatus: string; paymentStatus: string; playerProfile?: { displayName?: string | null; fullName?: string | null } | null }[];
  inviteToken?: string | null;
};

type Match = {
  id: number;
  status: string;
  pairingAId?: number | null;
  pairingBId?: number | null;
  pairingA?: Pairing | null;
  pairingB?: Pairing | null;
  scoreSets?: Array<{ teamA: number; teamB: number }> | null;
  score?: Record<string, unknown> | null;
  groupLabel?: string | null;
  roundType?: string | null;
  roundLabel?: string | null;
  plannedStartAt?: string | null;
  startTime?: string | null;
};

type Standings = Record<
  string,
  Array<{
    entityId: number;
    pairingId: number | null;
    playerId?: number | null;
    label?: string | null;
    points: number;
    wins: number;
    draws?: number;
    losses: number;
    setsFor: number;
    setsAgainst: number;
  }>
>;
type CategoryMeta = { name?: string; categoryId?: number | null; capacity?: number | null; registrationType?: string | null };
type PadelEventCategoryLink = {
  id: number;
  padelCategoryId: number | null;
  format?: string | null;
  capacityTeams?: number | null;
  activeTeams?: number | null;
  completeTeams?: number | null;
  confirmedTeams?: number | null;
  pendingTeams?: number | null;
  isEnabled?: boolean;
  category?: { id: number; label: string } | null;
};
type PadelRuleSetSummary = { id: number; name: string; tieBreakRules?: string[] | null; pointsTable?: Record<string, number> | null };
type PadelRuleSetsResponse = { ok: boolean; items?: PadelRuleSetSummary[] };
type OrganizationMeResponse = { membershipRole?: string | null };
type ImportErrorItem = { row: number; message: string; field?: string | null };
type ImportSummary = { totalRows: number; validRows: number; errorRows: number; errorCount: number };
type ImportPreview = { categories?: Record<string, number>; validRows?: number };
type AuditItem = {
  id: string;
  action: string;
  actorName?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown>;
};

type GenerationPlanAlternative = {
  type?: string;
  summary?: string;
};

type GenerationPlanCategory = {
  key?: string;
  label?: string;
  format?: string;
  teams?: number;
  minTeams?: number;
  matchesNeeded?: number;
  allocatedSlots?: number;
  recommendedMaxTeams?: number;
  hardCapMax?: number | null;
  queueEstimatedRounds?: number | null;
  feasible?: boolean;
};

type GenerationPlanDetails = {
  feasible?: boolean;
  totalSlots?: number;
  matchesNeeded?: number;
  unscheduledMatches?: number;
  blockingReasons?: string[];
  warnings?: string[];
  alternatives?: GenerationPlanAlternative[];
  categories?: GenerationPlanCategory[];
};

type LiveOpsFilter =
  | "ALL"
  | "ACTION_REQUIRED"
  | "PENDING_CONFIRMATION"
  | "PENDING_REVIEW_EXPIRED"
  | "DISPUTED"
  | "UNSCHEDULED";

const LIVE_ACTION_STATUSES = new Set(["RESULT_SUBMITTED", "PENDING_CONFIRMATION", "PENDING_REVIEW_EXPIRED", "DISPUTED"]);

const isMatchDisputeOpen = (match: Match) => {
  const score = (match.score || {}) as Record<string, unknown>;
  return score.disputeStatus === "OPEN";
};

const isMatchUnscheduled = (match: Match) => !match.plannedStartAt && !match.startTime;

const doesMatchPassLiveOpsFilter = (match: Match, filter: LiveOpsFilter) => {
  switch (filter) {
    case "ACTION_REQUIRED":
      return LIVE_ACTION_STATUSES.has(match.status) || isMatchDisputeOpen(match);
    case "PENDING_CONFIRMATION":
      return match.status === "PENDING_CONFIRMATION";
    case "PENDING_REVIEW_EXPIRED":
      return match.status === "PENDING_REVIEW_EXPIRED";
    case "DISPUTED":
      return match.status === "DISPUTED" || isMatchDisputeOpen(match);
    case "UNSCHEDULED":
      return isMatchUnscheduled(match);
    case "ALL":
    default:
      return true;
  }
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ScoreRulesPreset = {
  id: "STANDARD" | "STANDARD_SUPER" | "SINGLE_SET" | "NO_VALIDATION";
  label: string;
  description: string;
  rules: PadelScoreRules | null;
};

const withScoreOverrides = (overrides: Partial<PadelScoreRules>) => ({
  ...DEFAULT_PADEL_SCORE_RULES,
  ...overrides,
});

const SCORE_RULE_PRESETS: ScoreRulesPreset[] = [
  {
    id: "STANDARD",
    label: "Standard",
    description: "Melhor de 3 · 6 jogos · TB 6-6 · Sem super TB",
    rules: withScoreOverrides({ allowSuperTieBreak: false }),
  },
  {
    id: "STANDARD_SUPER",
    label: "Standard + Super TB",
    description: "Melhor de 3 · Permite 3º set super tie-break (10)",
    rules: withScoreOverrides({ allowSuperTieBreak: true }),
  },
  {
    id: "SINGLE_SET",
    label: "Jogo único",
    description: "1 set a 6 · TB 6-6",
    rules: withScoreOverrides({ setsToWin: 1, maxSets: 1, allowSuperTieBreak: false }),
  },
  {
    id: "NO_VALIDATION",
    label: "Sem validação",
    description: "Aceita qualquer score (sem validação automática)",
    rules: null,
  },
];

const SCORE_RULE_KEYS: Array<keyof PadelScoreRules> = [
  "setsToWin",
  "maxSets",
  "gamesToWinSet",
  "tieBreakAt",
  "tieBreakTo",
  "allowSuperTieBreak",
  "superTieBreakTo",
  "superTieBreakWinBy",
  "superTieBreakOnlyDecider",
  "allowExtendedGames",
];

const scoreRulesEqual = (a: PadelScoreRules, b: PadelScoreRules) =>
  SCORE_RULE_KEYS.every((key) => a[key] === b[key]);

const resolveScoreRulesPresetId = (rules: PadelScoreRules | null) => {
  if (!rules) return "NO_VALIDATION";
  const match = SCORE_RULE_PRESETS.find((preset) => preset.rules && scoreRulesEqual(preset.rules, rules));
  return match?.id ?? "CUSTOM";
};

function nameFromSlots(pairing: Pairing | null | undefined, locale: string) {
  if (!pairing) return "—";
  const names = pairing.slots
    .map((s) => s.playerProfile?.displayName || s.playerProfile?.fullName)
    .filter(Boolean) as string[];
  return names.length ? names.join(" / ") : t("pairingIncomplete", locale);
}

const resolvePairingStatusLabel = (pairing: Pairing, locale: string) => {
  if (pairing.pairingStatus === "CANCELLED") return t("pairingStatusCancelled", locale);
  if (pairing.lifecycleStatus === "CANCELLED_INCOMPLETE") return t("pairingStatusExpired", locale);
  const slots = pairing.slots || [];
  const allFilled = slots.length > 0 && slots.every((slot) => slot.slotStatus === "FILLED");
  const allPaid = slots.length > 0 && slots.every((slot) => slot.paymentStatus === "PAID");
  if (allFilled && allPaid) return t("pairingStatusConfirmed", locale);
  if (pairing.pairingJoinMode === "LOOKING_FOR_PARTNER") return t("pairingStatusMatchmaking", locale);
  return t("pairingStatusPending", locale);
};

const resolvePaymentModeLabel = (mode: string, locale: string) => {
  if (mode === "FULL") return t("paymentModeFull", locale);
  if (mode === "SPLIT") return t("paymentModeSplit", locale);
  return mode || "—";
};

const resolveWaitlistStatusLabel = (status: string, locale: string) => {
  switch (status) {
    case "PENDING":
      return t("waitlistStatusPending", locale);
    case "PROMOTED":
      return t("waitlistStatusPromoted", locale);
    case "CANCELLED":
      return t("waitlistStatusCancelled", locale);
    case "EXPIRED":
      return t("waitlistStatusExpired", locale);
    default:
      return status || "—";
  }
};

const summarizeAuditMeta = (metadata?: Record<string, unknown>) => {
  if (!metadata || typeof metadata !== "object") return "";
  const orderedKeys = [
    "matchId",
    "categoryId",
    "phase",
    "format",
    "group",
    "courtId",
    "status",
    "scheduledCount",
    "skippedCount",
    "startAt",
    "start",
  ];
  const parts: string[] = [];
  orderedKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      const value = metadata[key];
      if (value === null || typeof value === "undefined") return;
      parts.push(`${key}:${String(value)}`);
    }
  });
  if (parts.length === 0) return "";
  return parts.join(" · ");
};

const toPositiveInt = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const resolveCategoryTeamsForPlanning = (
  link: PadelEventCategoryLink | null | undefined,
  fallbackTeams: number,
  strategy: "runtime-first" | "capacity-first",
) => {
  const confirmed = toPositiveInt(link?.confirmedTeams) ?? 0;
  const complete = toPositiveInt(link?.completeTeams) ?? 0;
  const active = toPositiveInt(link?.activeTeams) ?? 0;
  const pending = toPositiveInt(link?.pendingTeams) ?? 0;
  const capacity = toPositiveInt(link?.capacityTeams) ?? 0;
  const fallback = Math.max(0, Math.floor(Number.isFinite(fallbackTeams) ? fallbackTeams : 0));

  if (strategy === "capacity-first") {
    if (capacity > 0) return capacity;
    if (fallback > 0) return fallback;
    if (active > 0) return active;
    if (complete > 0) return complete;
    if (confirmed > 0) return confirmed;
    if (pending > 0) return pending;
    return 0;
  }

  if (confirmed > 0) return confirmed;
  if (complete > 0) return complete;
  if (active > 0) return active;
  if (fallback > 0) return fallback;
  if (capacity > 0) return capacity;
  if (pending > 0) return pending;
  return 0;
};

const PADEL_FORMAT_PROFILE_OPTIONS = [
  "TODOS_CONTRA_TODOS",
  "GRUPOS_ELIMINATORIAS",
  "QUADRO_ELIMINATORIO",
  "QUADRO_AB",
  "DUPLA_ELIMINACAO",
  "CAMPEONATO_LIGA",
  "NON_STOP",
  "AMERICANO",
  "MEXICANO",
] as const;

const isAmMxFormatValue = (format: string | null | undefined) => format === "AMERICANO" || format === "MEXICANO";
const isNonStopFormatValue = (format: string | null | undefined) => format === "NON_STOP";

export default function PadelTournamentTabs({
  eventId,
  eventSlug,
  categoriesMeta,
  organizationId,
  coverImageUrl,
}: {
  eventId: number;
  eventSlug: string;
  categoriesMeta?: CategoryMeta[];
  organizationId?: number | null;
  coverImageUrl?: string | null;
}) {
  const orgApi = (suffix: string, explicitOrgId?: number | null) =>
    resolveCanonicalOrgApiPath(`/api/org/[orgId]${suffix}`, explicitOrgId ?? null);

  const searchParams = useSearchParams();
  const locale = resolveLocale(searchParams?.get("lang"));
  const [tab, setTab] = useState<"duplas" | "grupos" | "eliminatorias">("duplas");
  const [coverUrl, setCoverUrl] = useState<string | null>(coverImageUrl ?? null);
  const [coverSaving, setCoverSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"preview" | "import" | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<ImportErrorItem[]>([]);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [koEditMode, setKoEditMode] = useState(false);
  const [koEditMessage, setKoEditMessage] = useState<string | null>(null);
  const [generationPhase, setGenerationPhase] = useState<"GROUPS" | "KNOCKOUT" | null>(null);
  const [generationBusy, setGenerationBusy] = useState<"GROUPS" | "KNOCKOUT" | null>(null);
  const [seedingBusy, setSeedingBusy] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationPlanDetails, setGenerationPlanDetails] = useState<GenerationPlanDetails | null>(null);
  const [planningMode, setPlanningMode] = useState<"runtime" | "capacity">("runtime");
  const [planningPreview, setPlanningPreview] = useState<GenerationPlanDetails | null>(null);
  const [planningPreviewLoading, setPlanningPreviewLoading] = useState(false);
  const [planningPreviewError, setPlanningPreviewError] = useState<string | null>(null);
  const [liveOpsFilter, setLiveOpsFilter] = useState<LiveOpsFilter>("ALL");
  const [koEdits, setKoEdits] = useState<Record<number, { pairingAId: number | null; pairingBId: number | null }>>({});
  const [koSaving, setKoSaving] = useState<Record<number, boolean>>({});
  const [disputeBusy, setDisputeBusy] = useState<Record<number, boolean>>({});
  const [disputeError, setDisputeError] = useState<Record<number, string | null>>({});
  const [workflowBusy, setWorkflowBusy] = useState<Record<number, boolean>>({});
  const [workflowError, setWorkflowError] = useState<Record<number, string | null>>({});
  const [swapPairingAId, setSwapPairingAId] = useState<string>("");
  const [swapPairingBId, setSwapPairingBId] = useState<string>("");
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastAudience, setBroadcastAudience] = useState<"ALL" | "PLAYERS" | "WAITLIST">("ALL");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  useEffect(() => {
    setCoverUrl(coverImageUrl ?? null);
  }, [coverImageUrl]);

  const saveCoverImage = useCallback(
    async (nextCoverUrl: string | null) => {
      setCoverUrl(nextCoverUrl);
      if (!organizationId) return;
      setCoverSaving(true);
      try {
        const res = await fetch(`/api/org/${organizationId}/events/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            coverImageUrl: nextCoverUrl,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(sanitizeUiErrorMessage(json?.error, "Falha ao atualizar capa do torneio."));
        }
        setConfigMessage("Capa atualizada.");
      } catch (err) {
        setConfigMessage(
          err instanceof Error ? sanitizeUiErrorMessage(err.message, "Falha ao atualizar capa do torneio.") : "Falha ao atualizar capa do torneio.",
        );
      } finally {
        setCoverSaving(false);
      }
    },
    [eventId, organizationId],
  );

  const { data: eventCategoriesRes } = useSWR<{ ok?: boolean; items?: PadelEventCategoryLink[] }>(
    eventId ? `/api/padel/event-categories?eventId=${eventId}` : null,
    fetcher,
  );
  const eventCategoryLinks = useMemo(() => {
    if (!eventCategoriesRes?.ok || !Array.isArray(eventCategoriesRes.items)) return [];
    return eventCategoriesRes.items;
  }, [eventCategoriesRes]);
  const categoryOptions = useMemo(() => {
    const byId = new Map<number, { id: number; label: string }>();
    (categoriesMeta || [])
      .filter((c) => Number.isFinite(c.categoryId as number))
      .forEach((c) => {
        const id = c.categoryId as number;
        byId.set(id, {
          id,
          label: c.name || `Categoria ${id}`,
        });
      });
    eventCategoryLinks.forEach((link) => {
      const categoryId =
        typeof link.padelCategoryId === "number"
          ? link.padelCategoryId
          : typeof link.category?.id === "number"
            ? link.category.id
            : null;
      if (!categoryId || byId.has(categoryId)) return;
      byId.set(categoryId, {
        id: categoryId,
        label: link.category?.label || `Categoria ${categoryId}`,
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-PT"));
  }, [categoriesMeta, eventCategoryLinks]);
  const categoryLabelById = useMemo(
    () => new Map(categoryOptions.map((opt) => [String(opt.id), opt.label])),
    [categoryOptions],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [preferGlobalCategory, setPreferGlobalCategory] = useState(false);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      if (selectedCategoryId !== null) setSelectedCategoryId(null);
      return;
    }
    if (preferGlobalCategory) {
      if (selectedCategoryId !== null) setSelectedCategoryId(null);
      return;
    }
    if (selectedCategoryId && categoryOptions.some((c) => c.id === selectedCategoryId)) return;
    setSelectedCategoryId(categoryOptions[0].id ?? null);
  }, [categoryOptions, preferGlobalCategory, selectedCategoryId]);
  useEffect(() => {
    setGenerationMessage(null);
    setGenerationError(null);
    setGenerationPlanDetails(null);
    setGenerationPhase(null);
    setPlanningPreview(null);
    setPlanningPreviewError(null);
  }, [selectedCategoryId]);
  const emptyMatches = useMemo<Match[]>(() => [], []);

  const { data: pairingsRes, mutate: mutatePairings } = useSWR(
    eventId ? `/api/padel/pairings?eventId=${eventId}` : null,
    fetcher,
  );
  const categoryParam = selectedCategoryId ? `&categoryId=${selectedCategoryId}` : "";
  const { data: matchesRes, mutate: mutateMatches } = useSWR(
    eventId ? `/api/padel/matches?eventId=${eventId}${categoryParam}` : null,
    fetcher,
  );
  const { data: waitlistRes, mutate: mutateWaitlist } = useSWR(
    eventId ? orgApi(`/padel/waitlist?eventId=${eventId}${categoryParam}`) : null,
    fetcher,
  );
  const { data: standingsRes } = useSWR(
    eventId ? `/api/padel/standings?eventId=${eventId}${categoryParam}` : null,
    fetcher,
  );
  const { data: configRes, mutate: mutateConfig } = useSWR(
    eventId ? `/api/padel/tournaments/config?eventId=${eventId}` : null,
    fetcher,
  );
  const { data: ruleSetsRes } = useSWR<PadelRuleSetsResponse>(
    configRes?.config?.organizationId
      ? `/api/padel/rulesets?organizationId=${configRes.config.organizationId}`
      : null,
    fetcher,
  );
  const orgIdForMe =
    typeof configRes?.config?.organizationId === "number" ? configRes.config.organizationId : null;
  const { data: orgMeRes } = useSWR<OrganizationMeResponse>(
    orgIdForMe ? orgApi("/me", orgIdForMe) : null,
    fetcher,
  );
  const { data: auditRes } = useSWR(
    eventId ? orgApi(`/padel/audit?eventId=${eventId}&limit=25&actionPrefix=PADEL_`) : null,
    fetcher,
  );

  const pairings: Pairing[] = pairingsRes?.pairings ?? [];
  const matches: Match[] = Array.isArray(matchesRes?.items) ? (matchesRes.items as Match[]) : emptyMatches;
  const standings: Standings = standingsRes?.groups ?? standingsRes?.standings ?? {};
  const eventCategoryById = useMemo(() => {
    const byId = new Map<number, PadelEventCategoryLink>();
    eventCategoryLinks.forEach((link) => {
      const categoryId =
        typeof link.padelCategoryId === "number"
          ? link.padelCategoryId
          : typeof link.category?.id === "number"
            ? link.category.id
            : null;
      if (!categoryId || byId.has(categoryId)) return;
      byId.set(categoryId, link);
    });
    return byId;
  }, [eventCategoryLinks]);
  const pairingCountByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    pairings.forEach((pairing) => {
      const categoryId =
        typeof pairing.categoryId === "number" && Number.isFinite(pairing.categoryId)
          ? pairing.categoryId
          : null;
      if (!categoryId) return;
      counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    });
    return counts;
  }, [pairings]);
  const planningStrategy = planningMode === "capacity" ? "capacity-first" : "runtime-first";
  const pairingsById = useMemo(() => new Map(pairings.map((pairing) => [pairing.id, pairing])), [pairings]);
  const swapCandidates = useMemo(
    () =>
      pairings.filter((pairing) => {
        if (pairing.pairingStatus === "CANCELLED") return false;
        const partnerSlot = pairing.slots.find((slot) => slot.slotRole === "PARTNER");
        if (!partnerSlot) return false;
        if (partnerSlot.slotStatus !== "FILLED") return false;
        if (partnerSlot.paymentStatus === "PAID") return false;
        return true;
      }),
    [pairings],
  );
  const standingsGroups = useMemo(() => {
    const entries = Object.entries(standings);
    return entries.sort((a, b) => a[0].localeCompare(b[0], "pt-PT", { numeric: true }));
  }, [standings]);
  const waitlistItems = Array.isArray(waitlistRes?.items) ? (waitlistRes.items as Array<any>) : [];
  const advanced = (configRes?.config?.advancedSettings || {}) as Record<string, any>;
  const ruleSets = Array.isArray(ruleSetsRes?.items) ? (ruleSetsRes.items as PadelRuleSetSummary[]) : [];
  const activeRuleSet = configRes?.config?.ruleSet as PadelRuleSetSummary | undefined;
  const auditItems: AuditItem[] =
    auditRes && auditRes.ok && Array.isArray(auditRes.items) ? (auditRes.items as AuditItem[]) : [];
  const memberRole = orgMeRes?.membershipRole ?? null;
  const normalizedRole = typeof memberRole === "string" ? memberRole.toUpperCase() : null;
  const isAdminRole = normalizedRole === "OWNER" || normalizedRole === "CO_OWNER" || normalizedRole === "ADMIN";
  const isOwnerRole = normalizedRole === "OWNER" || normalizedRole === "CO_OWNER";
  const formatRequested = advanced.formatRequested as string | undefined;
  const formatEffective = advanced.formatEffective as string | undefined;
  const generationVersion = advanced.generationVersion as string | undefined;
  const koGeneratedAt = advanced.koGeneratedAt as string | undefined;
  const autoGeneratedAt = configRes?.tournament?.generatedAt as string | undefined;
  const autoGeneratedBy = configRes?.tournament?.generatedByUserId as string | null | undefined;
  const waitlistEnabled = advanced.waitlistEnabled === true;
  const registrationStartsAt = typeof advanced.registrationStartsAt === "string" ? advanced.registrationStartsAt : null;
  const registrationEndsAt = typeof advanced.registrationEndsAt === "string" ? advanced.registrationEndsAt : null;
  const allowSecondCategory = advanced.allowSecondCategory !== false;
  const maxEntriesTotal =
    typeof advanced.maxEntriesTotal === "number" && Number.isFinite(advanced.maxEntriesTotal)
      ? Math.floor(advanced.maxEntriesTotal)
      : null;
  const tvMonitor = (advanced.tvMonitor as { footerText?: string | null; sponsors?: string[] } | undefined) ?? {};
  const [tvFooterText, setTvFooterText] = useState(tvMonitor.footerText ?? "");
  const [tvSponsors, setTvSponsors] = useState((tvMonitor.sponsors ?? []).join("\n"));
  const koSeedSnapshot =
    (advanced.koSeedSnapshot as
      | Array<{
          pairingId: number;
          groupLabel: string;
          rank: number;
          points?: number;
          setDiff?: number;
          gameDiff?: number;
          setsFor?: number;
          setsAgainst?: number;
          isExtra?: boolean;
        }>
      | undefined) ?? [];
  const koOverride = advanced.koOverride === true;
  const koManual = advanced.koManual === true;
  const koManualAt = typeof advanced.koManualAt === "string" ? advanced.koManualAt : null;
  const competitionState = typeof advanced.competitionState === "string" ? advanced.competitionState : null;
  const seedRanks = (advanced.seedRanks as Record<string, number> | undefined) ?? {};
  const scoreRules = (advanced.scoreRules as PadelScoreRules | null | undefined) ?? null;
  const scoreRulesPreset = useMemo(() => resolveScoreRulesPresetId(scoreRules), [scoreRules]);
  const activeScorePreset =
    scoreRulesPreset === "CUSTOM"
      ? null
      : SCORE_RULE_PRESETS.find((preset) => preset.id === scoreRulesPreset) ?? null;
  const resultValidationMode =
    configRes?.config?.resultValidationMode === "IMMEDIATE_PENDING_THEN_OFFICIAL"
      ? "IMMEDIATE_PENDING_THEN_OFFICIAL"
      : "IMMEDIATE_OFFICIAL";
  const pendingConfirmationWindowMinutes =
    typeof configRes?.config?.pendingConfirmationWindowMinutes === "number" &&
    Number.isFinite(configRes.config.pendingConfirmationWindowMinutes)
      ? Math.max(1, Math.floor(configRes.config.pendingConfirmationWindowMinutes))
      : 15;
  const playerResultSubmissionEnabled = configRes?.config?.playerResultSubmissionEnabled === true;
  const autoGeneratedMessage =
    autoGeneratedAt && !autoGeneratedBy
      ? `Bracket gerado automaticamente em ${new Date(autoGeneratedAt).toLocaleString("pt-PT")}.`
      : null;
  const selectedCategoryLabel = selectedCategoryId
    ? categoryOptions.find((item) => item.id === selectedCategoryId)?.label ?? `Categoria #${selectedCategoryId}`
    : "Global";
  const runtimeCategoryKey = selectedCategoryId ? String(selectedCategoryId) : "global";
  const formatProfilesByCategoryRaw =
    advanced.formatProfilesByCategory && typeof advanced.formatProfilesByCategory === "object"
      ? (advanced.formatProfilesByCategory as Record<string, unknown>)
      : {};
  const formatProfilesByCategory = useMemo(
    () =>
      Object.entries(formatProfilesByCategoryRaw).reduce<Record<string, Record<string, unknown>>>((acc, [key, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return acc;
        acc[key] = value as Record<string, unknown>;
        return acc;
      }, {}),
    [formatProfilesByCategoryRaw],
  );
  const selectedCategoryProfileOwn = formatProfilesByCategory[runtimeCategoryKey] ?? null;
  const globalCategoryProfile = formatProfilesByCategory.global ?? null;
  const selectedCategoryProfile = selectedCategoryProfileOwn ?? globalCategoryProfile;
  const resolveCategoryProfile = useCallback(
    (categoryId: number | null) => {
      if (categoryId && formatProfilesByCategory[String(categoryId)]) {
        return formatProfilesByCategory[String(categoryId)];
      }
      return globalCategoryProfile;
    },
    [formatProfilesByCategory, globalCategoryProfile],
  );
  const generationFormatBase = formatRequested || formatEffective || configRes?.config?.format || "GRUPOS_ELIMINATORIAS";
  const generationFormat =
    typeof selectedCategoryProfile?.format === "string" ? selectedCategoryProfile.format : generationFormatBase;
  const selectedAmMxMode = selectedCategoryProfile?.amMxMode === "FIXED_PAIR" ? "FIXED_PAIR" : "INDIVIDUAL_ROTATION";
  const selectedNonStopMode =
    selectedCategoryProfile?.nonStopMode === "HARD_CAP_WAITLIST" ? "HARD_CAP_WAITLIST" : "ACTIVE_QUEUE";
  const selectedNonStopRounds =
    toPositiveInt(selectedCategoryProfile?.nonStopRounds) ?? toPositiveInt(selectedCategoryProfile?.roundsHint) ?? 6;
  const supportsGroups = generationFormat === "GRUPOS_ELIMINATORIAS";
  const supportsKnockout = ["GRUPOS_ELIMINATORIAS", "QUADRO_ELIMINATORIO", "QUADRO_AB", "DUPLA_ELIMINACAO"].includes(
    generationFormat,
  );
  const isKnockoutOnlyFormat = ["QUADRO_ELIMINATORIO", "QUADRO_AB", "DUPLA_ELIMINACAO"].includes(generationFormat);
  const isLeagueFormat = ["TODOS_CONTRA_TODOS", "CAMPEONATO_LIGA"].includes(generationFormat);
  const isNonStopFormat = generationFormat === "NON_STOP";
  const isAmMxFormat = generationFormat === "AMERICANO" || generationFormat === "MEXICANO";
  const scheduledMatchesCount = matches.filter((match) => Boolean(match.plannedStartAt || match.startTime)).length;
  const unscheduledMatchesCount = Math.max(0, matches.length - scheduledMatchesCount);
  const autoScheduleBaseHref =
    typeof organizationId === "number" && organizationId > 0
      ? buildOrgHref(organizationId, "/padel/tournaments", {
          section: "padel-tournaments",
          padel: "calendar",
          eventId,
        })
      : `/org/padel/tournaments?section=padel-tournaments&padel=calendar&eventId=${eventId}`;
  const autoScheduleHref = `${autoScheduleBaseHref}#auto-schedule`;
  const roundOpsHref = `${autoScheduleBaseHref}#round-ops`;
  const phaseSupportLabel = supportsGroups
    ? "Fases: grupos + eliminatórias"
    : supportsKnockout
      ? "Fases: eliminatórias"
      : isNonStopFormat
        ? "Fases: non-stop por ronda"
        : isAmMxFormat
          ? "Fases: rotação por ronda"
          : "Fases: rondas/liga";
  const scheduleCoverage = matches.length > 0 ? Math.round((scheduledMatchesCount / matches.length) * 100) : 0;
  const formatExecutionHint = supportsGroups
    ? "Fluxo recomendado: gerar grupos, gerar eliminatórias e depois auto-agendar no calendário."
    : supportsKnockout
      ? "Fluxo recomendado: gerar quadro eliminatório e depois auto-agendar no calendário."
      : isNonStopFormat
        ? "Fluxo recomendado: gerar ronda inicial NON_STOP, operar avanço de ronda e auto-agendar no calendário."
        : isAmMxFormat
          ? "Fluxo recomendado: gerar ronda inicial, avançar ronda a ronda e auto-agendar no calendário."
          : "Fluxo recomendado: gerar rondas e depois auto-agendar no calendário.";
  const calendarReadinessHint =
    matches.length === 0
      ? "Sem jogos gerados."
      : unscheduledMatchesCount === 0
        ? `Calendário completo: ${scheduledMatchesCount}/${matches.length} com horário.`
        : `Calendário pendente: ${unscheduledMatchesCount}/${matches.length} sem horário.`;
  const groupsTabLabel = supportsGroups
    ? "Grupos"
    : isNonStopFormat
      ? "Non-stop"
      : isAmMxFormat
        ? "Rondas AM/MX"
        : "Rondas";
  const showGroupsTab = !isKnockoutOnlyFormat;
  const showKnockoutTab = supportsKnockout;
  const primaryRoundMatches = useMemo(() => matches.filter((match) => match.roundType === "GROUPS"), [matches]);
  const nonStopRuntimeByCategory =
    advanced.nonStopRuntimeByCategory && typeof advanced.nonStopRuntimeByCategory === "object"
      ? (advanced.nonStopRuntimeByCategory as Record<string, unknown>)
      : {};
  const amMxRuntimeByCategory =
    advanced.amMxRuntimeByCategory && typeof advanced.amMxRuntimeByCategory === "object"
      ? (advanced.amMxRuntimeByCategory as Record<string, unknown>)
      : {};
  const selectedNonStopRuntime =
    nonStopRuntimeByCategory[runtimeCategoryKey] && typeof nonStopRuntimeByCategory[runtimeCategoryKey] === "object"
      ? (nonStopRuntimeByCategory[runtimeCategoryKey] as Record<string, unknown>)
      : nonStopRuntimeByCategory.global && typeof nonStopRuntimeByCategory.global === "object"
        ? (nonStopRuntimeByCategory.global as Record<string, unknown>)
        : null;
  const selectedAmMxRuntime =
    amMxRuntimeByCategory[runtimeCategoryKey] && typeof amMxRuntimeByCategory[runtimeCategoryKey] === "object"
      ? (amMxRuntimeByCategory[runtimeCategoryKey] as Record<string, unknown>)
      : amMxRuntimeByCategory.global && typeof amMxRuntimeByCategory.global === "object"
        ? (amMxRuntimeByCategory.global as Record<string, unknown>)
        : null;
  const nonStopRuntimeQueue = useMemo(() => {
    if (!selectedNonStopRuntime || !Array.isArray(selectedNonStopRuntime.queue)) return [];
    return selectedNonStopRuntime.queue
      .map((value) => toPositiveInt(value))
      .filter((value): value is number => Boolean(value));
  }, [selectedNonStopRuntime]);
  const nonStopRuntimeActivePairs = useMemo(() => {
    if (!selectedNonStopRuntime || !Array.isArray(selectedNonStopRuntime.activePairs)) return [];
    return selectedNonStopRuntime.activePairs
      .map((entry, idx) => {
        if (!Array.isArray(entry)) return null;
        return {
          court: idx + 1,
          pairingAId: toPositiveInt(entry[0]),
          pairingBId: toPositiveInt(entry[1]),
        };
      })
      .filter(
        (entry): entry is { court: number; pairingAId: number | null; pairingBId: number | null } => Boolean(entry),
      );
  }, [selectedNonStopRuntime]);
  const nonStopRoundCurrent = toPositiveInt(selectedNonStopRuntime?.round);
  const nonStopRoundTotal = toPositiveInt(selectedNonStopRuntime?.roundsTotal);
  const amMxRoundsGenerated = toPositiveInt(selectedAmMxRuntime?.roundsGenerated);
  const amMxRoundsTotal = toPositiveInt(selectedAmMxRuntime?.roundsTotal);
  const amMxProgressionMode =
    selectedCategoryProfile?.amMxProgressionMode === "ROUND_BY_ROUND" ? "ROUND_BY_ROUND" : null;
  const roundRuntimeHint = isNonStopFormat
    ? nonStopRoundCurrent
      ? `Ronda ${nonStopRoundCurrent}${nonStopRoundTotal ? ` / ${nonStopRoundTotal}` : ""} em execução.`
      : "Runtime NON_STOP ainda não iniciado."
    : isAmMxFormat
      ? amMxRoundsGenerated
        ? `Rondas geradas ${amMxRoundsGenerated}${amMxRoundsTotal ? ` / ${amMxRoundsTotal}` : ""}.`
        : "Runtime AM/MX ainda não iniciado."
      : null;
  const filteredPrimaryRoundMatches = useMemo(
    () => primaryRoundMatches.filter((match) => doesMatchPassLiveOpsFilter(match, liveOpsFilter)),
    [liveOpsFilter, primaryRoundMatches],
  );
  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const liveOpsCounters = useMemo(() => {
    let actionRequired = 0;
    let pendingConfirmation = 0;
    let pendingReviewExpired = 0;
    let disputed = 0;
    let unscheduled = 0;
    matches.forEach((match) => {
      if (doesMatchPassLiveOpsFilter(match, "ACTION_REQUIRED")) actionRequired += 1;
      if (doesMatchPassLiveOpsFilter(match, "PENDING_CONFIRMATION")) pendingConfirmation += 1;
      if (doesMatchPassLiveOpsFilter(match, "PENDING_REVIEW_EXPIRED")) pendingReviewExpired += 1;
      if (doesMatchPassLiveOpsFilter(match, "DISPUTED")) disputed += 1;
      if (doesMatchPassLiveOpsFilter(match, "UNSCHEDULED")) unscheduled += 1;
    });
    return {
      all: matches.length,
      actionRequired,
      pendingConfirmation,
      pendingReviewExpired,
      disputed,
      unscheduled,
    };
  }, [matches]);
  const liveOpsFilterLabel =
    liveOpsFilter === "ACTION_REQUIRED"
      ? "com ação"
      : liveOpsFilter === "PENDING_CONFIRMATION"
        ? "pendentes de confirmação"
        : liveOpsFilter === "PENDING_REVIEW_EXPIRED"
          ? "pendentes expirados"
          : liveOpsFilter === "DISPUTED"
            ? "em disputa"
            : liveOpsFilter === "UNSCHEDULED"
              ? "sem horário"
              : "todos";
  const generationPlanAlternatives = useMemo(() => {
    if (!generationPlanDetails?.alternatives || generationPlanDetails.alternatives.length === 0) return [];
    return generationPlanDetails.alternatives
      .map((alternative) => alternative?.summary?.trim())
      .filter((value): value is string => Boolean(value));
  }, [generationPlanDetails]);
  const planningPreviewAlternatives = useMemo(() => {
    if (!planningPreview?.alternatives || planningPreview.alternatives.length === 0) return [];
    return planningPreview.alternatives
      .map((alternative) => alternative?.summary?.trim())
      .filter((value): value is string => Boolean(value));
  }, [planningPreview]);

  useEffect(() => {
    if (!eventId) {
      setPlanningPreview(null);
      setPlanningPreviewError(null);
      setPlanningPreviewLoading(false);
      return;
    }

    const targetCategoryIds = selectedCategoryId ? [selectedCategoryId] : categoryOptions.map((category) => category.id);
    if (targetCategoryIds.length === 0) {
      setPlanningPreview(null);
      setPlanningPreviewError(null);
      setPlanningPreviewLoading(false);
      return;
    }

    const categoriesPayload = targetCategoryIds
      .map((categoryId) => {
        const categoryLink = eventCategoryById.get(categoryId) ?? null;
        const fallbackTeams = pairingCountByCategory.get(categoryId) ?? 0;
        const teams = resolveCategoryTeamsForPlanning(categoryLink, fallbackTeams, planningStrategy);
        if (teams <= 0) return null;
        const profile = resolveCategoryProfile(categoryId);
        const profileFormat =
          typeof profile?.format === "string" &&
          PADEL_FORMAT_PROFILE_OPTIONS.includes(profile.format as (typeof PADEL_FORMAT_PROFILE_OPTIONS)[number])
            ? profile.format
            : null;
        const linkFormat =
          typeof categoryLink?.format === "string" &&
          PADEL_FORMAT_PROFILE_OPTIONS.includes(categoryLink.format as (typeof PADEL_FORMAT_PROFILE_OPTIONS)[number])
            ? categoryLink.format
            : null;
        const formatValue = profileFormat ?? linkFormat ?? generationFormatBase;
        const amMxMode = profile?.amMxMode === "FIXED_PAIR" ? "FIXED_PAIR" : "INDIVIDUAL_ROTATION";
        const amMxProgressionMode = profile?.amMxProgressionMode === "ROUND_BY_ROUND" ? "ROUND_BY_ROUND" : undefined;
        const nonStopMode = profile?.nonStopMode === "HARD_CAP_WAITLIST" ? "HARD_CAP_WAITLIST" : "ACTIVE_QUEUE";
        const nonStopRounds = toPositiveInt(profile?.nonStopRounds) ?? toPositiveInt(profile?.roundsHint) ?? 6;
        return {
          categoryId,
          label: categoryLabelById.get(String(categoryId)) ?? categoryLink?.category?.label ?? `Categoria #${categoryId}`,
          teams,
          format: formatValue,
          amMxMode: isAmMxFormatValue(formatValue) ? amMxMode : undefined,
          amMxProgressionMode: isAmMxFormatValue(formatValue) ? amMxProgressionMode : undefined,
          nonStopMode: isNonStopFormatValue(formatValue) ? nonStopMode : undefined,
          nonStopRounds: isNonStopFormatValue(formatValue) ? nonStopRounds : undefined,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    if (categoriesPayload.length === 0) {
      setPlanningPreview(null);
      setPlanningPreviewLoading(false);
      setPlanningPreviewError(
        planningMode === "runtime"
          ? "Sem equipas reais para simular capacidade nesta categoria."
          : "Sem lotação/capacidade para simular capacidade.",
      );
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPlanningPreviewLoading(true);
      setPlanningPreviewError(null);
      try {
        const res = await fetch("/api/padel/formats/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            categories: categoriesPayload,
          }),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          if (!controller.signal.aborted) {
            setPlanningPreview(null);
            setPlanningPreviewError(sanitizeUiErrorMessage(json?.error, "Planner de formatos indisponível."));
          }
          return;
        }
        if (!controller.signal.aborted) {
          const plan = json?.plan;
          setPlanningPreview(plan && typeof plan === "object" ? (plan as GenerationPlanDetails) : null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setPlanningPreview(null);
        setPlanningPreviewError("Erro ao calcular pré-viabilidade por formato.");
      } finally {
        if (!controller.signal.aborted) setPlanningPreviewLoading(false);
      }
    }, 260);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    categoryLabelById,
    categoryOptions,
    eventCategoryById,
    eventId,
    generationFormatBase,
    pairingCountByCategory,
    planningMode,
    planningStrategy,
    resolveCategoryProfile,
    selectedCategoryId,
  ]);

  useEffect(() => {
    if (tab === "grupos" && !showGroupsTab) {
      setTab(showKnockoutTab ? "eliminatorias" : "duplas");
      return;
    }
    if (tab === "eliminatorias" && !showKnockoutTab) {
      setTab(showGroupsTab ? "grupos" : "duplas");
    }
  }, [showGroupsTab, showKnockoutTab, tab]);

  useEffect(() => {
    setTvFooterText(tvMonitor.footerText ?? "");
    setTvSponsors((tvMonitor.sponsors ?? []).join("\n"));
  }, [tvMonitor.footerText, tvMonitor.sponsors]);

  const pairingNameById = useMemo(() => {
    const map = new Map<number, string>();
    pairings.forEach((p) => map.set(p.id, nameFromSlots(p, locale)));
    return map;
  }, [pairings]);

  const filteredPairings = selectedCategoryId
    ? pairings.filter((p) => p.categoryId === selectedCategoryId)
    : pairings;
  const matchmakingQueue = filteredPairings.filter(
    (p) =>
      p.pairingJoinMode === "LOOKING_FOR_PARTNER" &&
      p.pairingStatus !== "CANCELLED" &&
      p.pairingStatus !== "COMPLETE",
  );
  const matchmakingFormed = filteredPairings.filter(
    (p) => p.pairingJoinMode === "LOOKING_FOR_PARTNER" && p.pairingStatus === "COMPLETE",
  );
  const confirmedPairings = filteredPairings.filter(
    (p) =>
      p.pairingStatus === "COMPLETE" &&
      (p.lifecycleStatus === "CONFIRMED_BOTH_PAID" || p.lifecycleStatus === "CONFIRMED_CAPTAIN_FULL"),
  );
  const koUsedByRound = useMemo(() => {
    const map = new Map<string, Set<number>>();
    matches
      .filter((m) => m.roundType === "KNOCKOUT")
      .forEach((m) => {
        const label = m.roundLabel || "KO";
        if (!map.has(label)) map.set(label, new Set());
        const bucket = map.get(label)!;
        if (m.pairingA?.id) bucket.add(m.pairingA.id);
        if (m.pairingB?.id) bucket.add(m.pairingB.id);
      });
    return map;
  }, [matches]);

  const koRounds = useMemo(() => {
    const winnerFromScore = (match: Match): "A" | "B" | null => {
      const sets = match.scoreSets ?? [];
      if (sets.length > 0) {
        let winsA = 0;
        let winsB = 0;
        sets.forEach((s) => {
          if (Number.isFinite(s.teamA) && Number.isFinite(s.teamB)) {
            if (s.teamA > s.teamB) winsA += 1;
            else if (s.teamB > s.teamA) winsB += 1;
          }
        });
        if (winsA !== winsB) return winsA > winsB ? "A" : "B";
      }
      const score = (match.score || {}) as Record<string, unknown>;
      if (score.winnerSide === "A" || score.winnerSide === "B") return score.winnerSide;
      return null;
    };

    const rounds = new Map<
      string,
      Array<{
        id: number;
        teamA: string;
        teamB: string;
        status: string;
        score: string;
        winner: "A" | "B" | null;
      }>
    >();
    matches
      .filter((m) => m.roundType === "KNOCKOUT")
      .forEach((m) => {
        const key = m.roundLabel || "KO";
        if (!rounds.has(key)) rounds.set(key, []);
        const score = formatScoreLabel(m);
        rounds.get(key)!.push({
          id: m.id,
          teamA: pairingNameById.get(m.pairingA?.id ?? 0) ?? "—",
          teamB: m.pairingB ? pairingNameById.get(m.pairingB?.id ?? 0) ?? "—" : "BYE",
          status: m.status,
          score,
          winner: winnerFromScore(m),
        });
      });
    // ordenar rounds por importância
    const parseLabel = (label: string) => {
      const prefix = label.startsWith("A ") ? "A" : label.startsWith("B ") ? "B" : "";
      const base = prefix ? label.slice(2) : label;
      let size: number | null = null;
      let order: number | null = null;
      if (/^L\\d+$/i.test(base)) {
        const parsed = Number(base.slice(1));
        order = Number.isFinite(parsed) ? parsed : null;
      } else if (/^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base)) {
        order = Number.MAX_SAFE_INTEGER;
      } else if (/^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base)) {
        order = Number.MAX_SAFE_INTEGER - 1;
      } else if (base.startsWith("R")) {
        const parsed = Number(base.slice(1));
        size = Number.isFinite(parsed) ? parsed : null;
      }
      if (size === null) {
        if (base === "QUARTERFINAL") size = 8;
        else if (base === "SEMIFINAL") size = 4;
        else if (base === "FINAL") size = 2;
      }
      return { prefix, base, size, order };
    };
    return Array.from(rounds.entries()).sort((a, b) => {
      const aMeta = parseLabel(a[0]);
      const bMeta = parseLabel(b[0]);
      const prefixOrder = (value: string) => (value === "A" ? 0 : value === "B" ? 1 : 0);
      if (prefixOrder(aMeta.prefix) !== prefixOrder(bMeta.prefix)) {
        return prefixOrder(aMeta.prefix) - prefixOrder(bMeta.prefix);
      }
      const aOrder = aMeta.order ?? (aMeta.size !== null ? -aMeta.size : Number.MAX_SAFE_INTEGER - 1);
      const bOrder = bMeta.order ?? (bMeta.size !== null ? -bMeta.size : Number.MAX_SAFE_INTEGER - 1);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return aMeta.base.localeCompare(bMeta.base);
    });
  }, [matches, pairingNameById]);

  const koVisibleMatchesCount = useMemo(() => {
    if (liveOpsFilter === "ALL") {
      return koRounds.reduce((total, [, games]) => total + games.length, 0);
    }
    return koRounds.reduce((total, [, games]) => {
      const visible = games.filter((game) => {
        const fullMatch = matchById.get(game.id);
        return fullMatch ? doesMatchPassLiveOpsFilter(fullMatch, liveOpsFilter) : false;
      });
      return total + visible.length;
    }, 0);
  }, [koRounds, liveOpsFilter, matchById]);

  const groupMatchesCount = matches.filter((m) => m.roundType === "GROUPS").length;
  const groupMatchesDone = matches.filter(
    (m) => m.roundType === "GROUPS" && ["OFFICIAL", "WALKOVER", "RETIRED"].includes(m.status),
  ).length;
  const groupMissing = Math.max(0, groupMatchesCount - groupMatchesDone);
  const canGenerateGroups = isAdminRole && supportsGroups;
  const canGeneratePrimaryRound = isAdminRole && (supportsGroups || isLeagueFormat || isNonStopFormat || isAmMxFormat);
  const canGenerateKnockout = isAdminRole && supportsKnockout && (groupMissing === 0 || isOwnerRole);

  const [resultDrafts, setResultDrafts] = useState<
    Record<
      number,
      {
        scoreMode: "SETS" | "TIMED_GAMES";
        scoreText: string;
        gamesA: string;
        gamesB: string;
        allowTimedDraw: boolean;
        endedByBuzzer: boolean;
        resultType: "NORMAL" | "WALKOVER" | "RETIREMENT" | "INJURY";
        winnerSide: "" | "A" | "B";
        photoUrl: string | null;
        saving?: boolean;
        uploading?: boolean;
        error?: string | null;
      }
    >
  >({});
  const [manualFallbackEnabled, setManualFallbackEnabled] = useState<Record<number, boolean>>({});

  const getScoreMode = (m: Match): "SETS" | "TIMED_GAMES" => {
    const score = (m.score || {}) as Record<string, unknown>;
    if (score.mode === "TIMED_GAMES") return "TIMED_GAMES";
    if (scoreRules?.scoreMode === "TIMED_GAMES") return "TIMED_GAMES";
    if (isNonStopFormat || isAmMxFormat) return "TIMED_GAMES";
    return "SETS";
  };
  const getScoreText = (m: Match) =>
    m.scoreSets?.length ? m.scoreSets.map((s) => `${s.teamA}-${s.teamB}`).join(", ") : "";
  const getTimedGames = (m: Match) => {
    const score = (m.score || {}) as Record<string, unknown>;
    const timed =
      score.timedGames && typeof score.timedGames === "object" && !Array.isArray(score.timedGames)
        ? (score.timedGames as Record<string, unknown>)
        : null;
    const gamesA = score.gamesA ?? timed?.gamesA;
    const gamesB = score.gamesB ?? timed?.gamesB;
    return {
      gamesA: typeof gamesA === "number" || typeof gamesA === "string" ? String(gamesA) : "",
      gamesB: typeof gamesB === "number" || typeof gamesB === "string" ? String(gamesB) : "",
      allowTimedDraw: typeof score.allowDraw === "boolean" ? score.allowDraw : true,
      endedByBuzzer: score.endedByBuzzer === true,
    };
  };
  const getResultType = (m: Match) => {
    const score = (m.score || {}) as Record<string, unknown>;
    if (score.resultType === "WALKOVER" || score.resultType === "RETIREMENT" || score.resultType === "INJURY") {
      return score.resultType as "WALKOVER" | "RETIREMENT" | "INJURY";
    }
    if (score.walkover === true) return "WALKOVER";
    return "NORMAL";
  };
  const getWinnerSide = (m: Match) => {
    const score = (m.score || {}) as Record<string, unknown>;
    if (score.winnerSide === "A" || score.winnerSide === "B") return score.winnerSide;
    return "";
  };
  const getPhotoUrl = (m: Match) => {
    const score = (m.score || {}) as Record<string, unknown>;
    return typeof score.photoUrl === "string" ? score.photoUrl : null;
  };

  useEffect(() => {
    setResultDrafts((prev) => {
      const next = { ...prev };
      const existingIds = new Set<number>();
      matches.forEach((m) => {
        existingIds.add(m.id);
        const shouldRefresh = !next[m.id] || (!next[m.id].saving && !next[m.id].uploading);
        if (shouldRefresh) {
          const timed = getTimedGames(m);
          next[m.id] = {
            scoreMode: getScoreMode(m),
            scoreText: getScoreText(m),
            gamesA: timed.gamesA,
            gamesB: timed.gamesB,
            allowTimedDraw: timed.allowTimedDraw,
            endedByBuzzer: timed.endedByBuzzer,
            resultType: getResultType(m),
            winnerSide: getWinnerSide(m),
            photoUrl: getPhotoUrl(m),
            saving: next[m.id]?.saving ?? false,
            uploading: next[m.id]?.uploading ?? false,
            error: next[m.id]?.error ?? null,
          };
        }
      });
      Object.keys(next).forEach((key) => {
        const id = Number(key);
        if (!existingIds.has(id)) delete next[id];
      });
      return next;
    });
  }, [isAmMxFormat, isNonStopFormat, matches, scoreRules?.scoreMode]);

  useEffect(() => {
    const existingIds = new Set(matches.map((match) => match.id));
    setManualFallbackEnabled((prev) => {
      const next: Record<number, boolean> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const matchId = Number(key);
        if (!existingIds.has(matchId) || value !== true) return;
        next[matchId] = true;
      });
      const prevKeys = Object.keys(prev).sort();
      const nextKeys = Object.keys(next).sort();
      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every((key, idx) => key === nextKeys[idx] && prev[Number(key)] === next[Number(key)])
      ) {
        return prev;
      }
      return next;
    });
  }, [matches]);

  const updateResultDraft = (
    matchId: number,
    patch: Partial<{
      scoreMode: "SETS" | "TIMED_GAMES";
      scoreText: string;
      gamesA: string;
      gamesB: string;
      allowTimedDraw: boolean;
      endedByBuzzer: boolean;
      resultType: "NORMAL" | "WALKOVER" | "RETIREMENT" | "INJURY";
      winnerSide: "" | "A" | "B";
      photoUrl: string | null;
      saving?: boolean;
      uploading?: boolean;
      error?: string | null;
    }>,
  ) => {
    setResultDrafts((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], ...patch },
    }));
  };
  const groupsConfig = (advanced.groupsConfig as Record<string, any>) || {};
  const groupMode = groupsConfig.mode === "MANUAL" ? "MANUAL" : "AUTO";
  const manualAssignments = (groupsConfig.manualAssignments as Record<string, string> | undefined) ?? {};
  const resolvedGroupCount = useMemo(() => {
    const groupCountRaw = Number(groupsConfig.groupCount);
    if (Number.isFinite(groupCountRaw) && groupCountRaw > 0) return Math.floor(groupCountRaw);
    const groupSizeRaw = Number(groupsConfig.groupSize);
    if (Number.isFinite(groupSizeRaw) && groupSizeRaw > 1) {
      return Math.max(1, Math.ceil(pairings.length / groupSizeRaw));
    }
    return Math.max(1, Math.round(Math.sqrt(Math.max(1, pairings.length))));
  }, [groupsConfig.groupCount, groupsConfig.groupSize, pairings.length]);
  const groupLabels = useMemo(
    () => Array.from({ length: Math.min(26, resolvedGroupCount) }, (_, idx) => String.fromCharCode(65 + idx)),
    [resolvedGroupCount],
  );

  const formatLabel = (value?: string | null) => {
    if (!value) return "";
    switch (value) {
      case "TODOS_CONTRA_TODOS":
        return "Todos contra todos";
      case "QUADRO_ELIMINATORIO":
        return "Quadro eliminatório";
      case "GRUPOS_ELIMINATORIAS":
        return "Grupos + eliminatórias";
      case "CAMPEONATO_LIGA":
        return "Campeonato/Liga";
      case "QUADRO_AB":
        return "Quadro A/B";
      case "DUPLA_ELIMINACAO":
        return "Dupla eliminação";
      case "NON_STOP":
        return "Non-stop";
      case "AMERICANO":
        return "Americano";
      case "MEXICANO":
        return "Mexicano";
      default:
        return value;
    }
  };

  const formatRoundLabel = (value: string) => {
    const trimmed = value.trim();
    const prefix = trimmed.startsWith("A ") ? "A " : trimmed.startsWith("B ") ? "B " : "";
    const base = prefix ? trimmed.slice(2).trim() : trimmed;
    if (/^L\\d+$/i.test(base)) {
      return `${prefix}Ronda ${base.slice(1)}`;
    }
    if (/^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base)) {
      return `${prefix}Grande Final 2`;
    }
    if (/^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base)) {
      return `${prefix}Grande Final`;
    }
    return value;
  };

  const getDisputeInfo = (match: Match) => {
    const score = (match.score || {}) as Record<string, unknown>;
    const rawStatus = typeof score.disputeStatus === "string" ? score.disputeStatus : null;
    const status = rawStatus === "OPEN" || rawStatus === "RESOLVED" ? rawStatus : null;
    const reason = typeof score.disputeReason === "string" ? score.disputeReason : null;
    const resolutionNote = typeof score.disputeResolutionNote === "string" ? score.disputeResolutionNote : null;
    return { status, reason, resolutionNote };
  };

  const getLiveWorkflowInfo = (match: Match) => {
    const score = (match.score || {}) as Record<string, unknown>;
    const workflow =
      score.liveWorkflow && typeof score.liveWorkflow === "object" && !Array.isArray(score.liveWorkflow)
        ? (score.liveWorkflow as Record<string, unknown>)
        : null;
    const pendingReviewExpiredAt =
      workflow && typeof workflow.pendingReviewExpiredAt === "string" ? workflow.pendingReviewExpiredAt : null;
    const pendingConfirmationExpiresAt =
      workflow && typeof workflow.pendingConfirmationExpiresAt === "string" ? workflow.pendingConfirmationExpiresAt : null;
    return {
      pendingReviewExpiredAt,
      pendingConfirmationExpiresAt,
    };
  };

  const formatMatchStatusLabel = (status: string) => {
    switch (status) {
      case "PENDING":
        return "Pendente";
      case "IN_PROGRESS":
        return "Em curso";
      case "RESULT_SUBMITTED":
        return "Resultado submetido";
      case "PENDING_CONFIRMATION":
        return "Pendente confirmação";
      case "PENDING_REVIEW_EXPIRED":
        return "Pendente expirado";
      case "DISPUTED":
        return "Em disputa";
      case "OFFICIAL":
        return "Oficial";
      case "WALKOVER":
        return "WO";
      case "RETIRED":
        return "Desistência";
      case "CANCELLED":
        return "Cancelado";
      default:
        return status;
    }
  };

  function formatScoreLabel(match: Match) {
    const dispute = getDisputeInfo(match);
    if (dispute.status === "OPEN") return "Em disputa";
    const score = (match.score || {}) as Record<string, unknown>;
    if (score.delayStatus === "DELAYED") return "Atrasado";
    const timed =
      score.timedGames && typeof score.timedGames === "object" && !Array.isArray(score.timedGames)
        ? (score.timedGames as Record<string, unknown>)
        : null;
    const gamesA = Number(score.gamesA ?? timed?.gamesA);
    const gamesB = Number(score.gamesB ?? timed?.gamesB);
    if (Number.isFinite(gamesA) && Number.isFinite(gamesB)) {
      return `${gamesA}-${gamesB}${score.mode === "TIMED_GAMES" ? " (tempo)" : ""}`;
    }
    if (match.scoreSets?.length) {
      return match.scoreSets.map((s) => `${s.teamA}-${s.teamB}`).join(", ");
    }
    const resultType =
      score.resultType === "WALKOVER" || score.walkover === true
        ? "WALKOVER"
        : score.resultType === "RETIREMENT"
          ? "RETIREMENT"
          : score.resultType === "INJURY"
            ? "INJURY"
            : null;
    if (resultType === "WALKOVER") return "WO";
    if (resultType === "RETIREMENT") return "Desistência";
    if (resultType === "INJURY") return "Lesão";
    return "—";
  }

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-PT");
  };

  const resolveResultSaveError = (code?: string | null) => {
    if (!code) return "Erro ao guardar resultado.";
    const normalized = code.toUpperCase();
    switch (normalized) {
      case "MATCH_DISPUTED":
        return "Jogo em disputa. Apenas ADMIN pode editar.";
      case "INVALID_SCORE":
        return "Resultado inválido. Confirma score e regras.";
      case "RESULT_REVIEW_IN_PROGRESS":
        return "Resultado bloqueado por revisão/disputa em curso.";
      case "MATCH_FINALIZED_USE_RESULT_WORKFLOW":
        return "Jogo já finalizado. Usa o workflow de override/reset.";
      case "PLAYER_SUBMISSION_DISABLED":
        return "Submissão por jogadores está desativada neste torneio.";
      case "SPECIAL_RESULT_REQUIRES_INCIDENT_ENDPOINT":
        return "WO/Desistência/Lesão devem ser registados no modo de incidente.";
      default:
        return sanitizeUiErrorMessage(code, "Erro ao guardar resultado.");
    }
  };

  const resolveGenerationError = (value?: string | null) => {
    if (!value) return "Não foi possível gerar os jogos.";
    const code = value.toUpperCase();
    switch (code) {
      case "OVERRIDE_NOT_ALLOWED":
        return "Só Dono/Co-dono pode gerar eliminatórias com grupos incompletos.";
      case "CATEGORY_NOT_AVAILABLE":
        return "Categoria indisponível para este torneio.";
      case "EVENT_NOT_FOUND":
        return "Torneio não encontrado.";
      case "NO_ORGANIZATION":
        return "Sem permissões para esta organização.";
      case "UNAUTHENTICATED":
        return "Inicia sessão para gerar jogos.";
      case "INVALID_EVENT":
        return "Torneio inválido.";
      case "INVALID_BODY":
        return "Pedido inválido para gerar jogos.";
      case "GENERATION_PLAN_INFEASIBLE":
        return "Inscrições confirmadas não cabem no plano atual de formato/calendário.";
      case "NON_STOP_REQUIRES_EVEN_TEAMS":
        return "Modo NON_STOP com hard cap exige número par de duplas ativas.";
      case "NON_STOP_MAX_TEAMS_EXCEEDED":
        return "NON_STOP hard cap: reduz duplas ativas ou muda para fila ativa.";
      case "NEED_PLAYERS_FOR_INDIVIDUAL_FORMAT":
        return "Formato individual requer pelo menos 4 jogadores válidos na categoria.";
      case "NO_COURTS_AVAILABLE":
        return "Sem campos ativos para gerar jogos.";
      case "GENERATION_FAILED":
        return "Falha ao gerar jogos. Verifica inscrições e configuração.";
      default:
        return sanitizeUiErrorMessage(value, "Não foi possível gerar os jogos.");
    }
  };

  const toLocalInputValue = (value?: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const championName = useMemo(() => {
    const isGrandFinalKey = (key: string) => {
      const trimmed = key.trim();
      const base = trimmed.startsWith("A ") || trimmed.startsWith("B ") ? trimmed.slice(2).trim() : trimmed;
      return /^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base);
    };
    const isGrandFinalResetKey = (key: string) => {
      const trimmed = key.trim();
      const base = trimmed.startsWith("A ") || trimmed.startsWith("B ") ? trimmed.slice(2).trim() : trimmed;
      return /^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base);
    };
    const resolveWinner = (round?: [string, Array<{ teamA: string; teamB: string; winner: "A" | "B" | null }>] | null) => {
      if (!round) return null;
      const [, games] = round;
      const final = games[0];
      if (!final) return null;
      if (final.winner === "A") return final.teamA;
      if (final.winner === "B") return final.teamB;
      return null;
    };
    const grandFinalReset = koRounds.find(([key]) => isGrandFinalResetKey(key));
    const gfResetWinner = resolveWinner(grandFinalReset ?? null);
    if (gfResetWinner) return gfResetWinner;
    const grandFinal = koRounds.find(([key]) => isGrandFinalKey(key));
    const gfWinner = resolveWinner(grandFinal ?? null);
    if (gfWinner) return gfWinner;
    const finalRound = koRounds.find(([key]) => key === "FINAL") || koRounds[koRounds.length - 1];
    return resolveWinner(finalRound ?? null);
  }, [koRounds]);

  async function saveGroupsConfig(
    update: Partial<{
      groupCount: number | null;
      qualifyPerGroup: number | null;
      extraQualifiers: number | null;
      seeding: "SNAKE" | "NONE";
      mode: "AUTO" | "MANUAL";
      manualAssignments: Record<string, string> | null;
    }>,
  ) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        groups: {
          ...groupsConfig,
          ...update,
        },
      }),
    });
    if (res.ok) {
      setConfigMessage("Configuração guardada.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar configuração.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function saveScoreRules(presetId: string) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    if (presetId === "CUSTOM") return;
    const preset = SCORE_RULE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        scoreRules: preset.rules,
      }),
    });
    if (res.ok) {
      setConfigMessage("Regras de score guardadas.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar regras de score.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function saveLiveWorkflowConfig(
    patch: Partial<{
      resultValidationMode: "IMMEDIATE_OFFICIAL" | "IMMEDIATE_PENDING_THEN_OFFICIAL";
      pendingConfirmationWindowMinutes: number;
      playerResultSubmissionEnabled: boolean;
    }>,
  ) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        ...patch,
      }),
    });
    if (res.ok) {
      setConfigMessage("Fluxo live guardado.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar fluxo live.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function saveFormatProfileConfig(
    patch: Partial<{
      format: string;
      amMxMode: "INDIVIDUAL_ROTATION" | "FIXED_PAIR";
      amMxProgressionMode: "ROUND_BY_ROUND";
      nonStopMode: "ACTIVE_QUEUE" | "HARD_CAP_WAITLIST";
      nonStopRounds: number | null;
    }>,
    _scope: "selected" | "global" = "selected",
  ) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    if (!isAdminRole) {
      setConfigMessage("Sem permissões para editar perfil de formato.");
      setTimeout(() => setConfigMessage(null), 2500);
      return;
    }

    const targetKey = "global";
    const nextProfiles = Object.entries(formatProfilesByCategory).reduce<Record<string, Record<string, unknown>>>(
      (acc, [key, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return acc;
        acc[key] = { ...(value as Record<string, unknown>) };
        return acc;
      },
      {},
    );
    const currentProfile = nextProfiles[targetKey] ?? {};
    const nextProfile: Record<string, unknown> = { ...currentProfile };

    const requestedFormat = typeof patch.format === "string" ? patch.format : nextProfile.format;
    const isKnownRequestedFormat =
      typeof requestedFormat === "string" &&
      (PADEL_FORMAT_PROFILE_OPTIONS as readonly string[]).includes(requestedFormat);
    const nextFormat = isKnownRequestedFormat ? requestedFormat : generationFormatBase;
    nextProfile.format = nextFormat;

    if (isAmMxFormatValue(nextFormat)) {
      nextProfile.amMxMode =
        patch.amMxMode === "FIXED_PAIR" || patch.amMxMode === "INDIVIDUAL_ROTATION"
          ? patch.amMxMode
          : nextProfile.amMxMode === "FIXED_PAIR"
            ? "FIXED_PAIR"
            : "INDIVIDUAL_ROTATION";
      nextProfile.amMxProgressionMode =
        patch.amMxProgressionMode === "ROUND_BY_ROUND" ||
        nextProfile.amMxProgressionMode === "ROUND_BY_ROUND"
          ? "ROUND_BY_ROUND"
          : "ROUND_BY_ROUND";
    } else {
      delete nextProfile.amMxMode;
      delete nextProfile.amMxProgressionMode;
    }

    if (isNonStopFormatValue(nextFormat)) {
      nextProfile.nonStopMode =
        patch.nonStopMode === "HARD_CAP_WAITLIST" || patch.nonStopMode === "ACTIVE_QUEUE"
          ? patch.nonStopMode
          : nextProfile.nonStopMode === "HARD_CAP_WAITLIST"
            ? "HARD_CAP_WAITLIST"
            : "ACTIVE_QUEUE";
      const roundsSource =
        patch.nonStopRounds !== undefined
          ? patch.nonStopRounds
          : toPositiveInt(nextProfile.nonStopRounds) ?? toPositiveInt(nextProfile.roundsHint) ?? selectedNonStopRounds;
      if (roundsSource && roundsSource > 0) {
        nextProfile.nonStopRounds = Math.floor(roundsSource);
      } else {
        delete nextProfile.nonStopRounds;
      }
    } else {
      delete nextProfile.nonStopMode;
      delete nextProfile.nonStopRounds;
      delete nextProfile.nonStopQueueRules;
    }

    nextProfiles[targetKey] = nextProfile;

    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        formatProfilesByCategory: nextProfiles,
      }),
    });
    if (res.ok) {
      setConfigMessage("Formato do torneio guardado.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar perfil por formato.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function applyTemplate(template: { id: string; label: string; groupCount: number; groupSize: number; qualifyPerGroup: number }) {
    const organizationId = configRes?.config?.organizationId;
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format: "GRUPOS_ELIMINATORIAS",
        templateId: template.id,
        groups: {
          mode: "AUTO",
          groupCount: template.groupCount,
          groupSize: template.groupSize,
          qualifyPerGroup: template.qualifyPerGroup,
          extraQualifiers: 0,
          seeding: "SNAKE",
        },
      }),
    });
    if (res.ok) {
      setConfigMessage(`Modelo "${template.label}" aplicado.`);
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao aplicar modelo.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function generateMatches(phase: "GROUPS" | "KNOCKOUT") {
    if (!eventId) return;
    setGenerationPlanDetails(null);
    if (!isAdminRole) {
      setGenerationPhase(phase);
      setGenerationError("Sem permissões para gerar jogos.");
      return;
    }
    if (phase === "GROUPS" && !canGeneratePrimaryRound) {
      setGenerationPhase(phase);
      setGenerationError(`Formato atual: ${formatLabel(generationFormat)}. Usa outro fluxo de geração.`);
      return;
    }
    if (phase === "KNOCKOUT" && !supportsKnockout) {
      setGenerationPhase(phase);
      setGenerationError(`Formato atual: ${formatLabel(generationFormat)}. Não usa eliminatórias.`);
      return;
    }

    const payload: Record<string, unknown> = {
      eventId,
      format: generationFormat,
      phase,
    };
    if (selectedCategoryId) payload.categoryId = selectedCategoryId;

    const needsOverride = phase === "KNOCKOUT" && supportsGroups && groupMissing > 0;
    if (needsOverride) {
      if (!isOwnerRole) {
        setGenerationPhase(phase);
        setGenerationError("Só Dono/Co-dono pode forçar eliminatórias com grupos incompletos.");
        return;
      }
      const confirmed = window.confirm(
        `Ainda faltam ${groupMissing} jogo${groupMissing === 1 ? "" : "s"} de grupos. Queres gerar eliminatórias mesmo assim?`,
      );
      if (!confirmed) return;
      payload.allowIncomplete = true;
    }

    setGenerationPhase(phase);
    setGenerationBusy(phase);
    setGenerationMessage(null);
    setGenerationError(null);
    setGenerationPlanDetails(null);
    try {
      const res = await fetch("/api/padel/matches/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        const plan = json?.plan;
        if (plan && typeof plan === "object" && !Array.isArray(plan)) {
          setGenerationPlanDetails(plan as GenerationPlanDetails);
        }
        setGenerationError(resolveGenerationError(json?.error));
        return;
      }
      setGenerationPlanDetails(null);
      if (json?.stage === "GROUPS") {
        const count = Number.isFinite(json?.matches) ? json.matches : null;
        setGenerationMessage(`Gerados ${count ?? 0} jogos de grupos.`);
      } else if (json?.stage === "KNOCKOUT") {
        const count = Number.isFinite(json?.matches) ? json.matches : null;
        const qualifiers = Number.isFinite(json?.qualifiers) ? json.qualifiers : null;
        setGenerationMessage(
          `Eliminatórias geradas${count !== null ? ` (${count} jogos)` : ""}${qualifiers !== null ? ` · ${qualifiers} qualificadas` : ""}.`,
        );
      } else {
        setGenerationMessage("Jogos gerados.");
      }
      mutateMatches();
      mutateConfig();
    } catch (err) {
      console.error("[padel/matches] generate", err);
      setGenerationError("Erro ao gerar jogos.");
    } finally {
      setGenerationBusy(null);
    }
  }

  function downloadImportTemplate() {
    const header = [
      "categoria",
      "player1_name",
      "player1_email",
      "player1_phone",
      "player2_name",
      "player2_email",
      "player2_phone",
      "seed",
      "group",
      "payment_mode",
      "payment_status",
    ];
    const example = [
      "Categoria A",
      "Joao Silva",
      "joao@email.com",
      "",
      "Maria Costa",
      "maria@email.com",
      "",
      "1",
      "A",
      "FULL",
      "PAID",
    ];
    const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [header, example].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "padel_import_modelo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const resetImportFeedback = () => {
    setImportMessage(null);
    setImportErrors([]);
    setImportSummary(null);
    setImportPreview(null);
  };

  async function submitImport(mode: "preview" | "import") {
    if (!importFile || !eventId) return;
    setImportMode(mode);
    resetImportFeedback();
    try {
      const formData = new FormData();
      formData.append("eventId", String(eventId));
      if (selectedCategoryId) {
        formData.append("fallbackCategoryId", String(selectedCategoryId));
      }
      if (mode === "preview") {
        formData.append("dryRun", "true");
      }
      formData.append("file", importFile);
      const res = await fetch(orgApi("/padel/imports/inscritos"), {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        if (mode === "preview") {
          setImportSummary(data?.summary ?? null);
          setImportPreview(data?.preview ?? null);
          setImportMessage("Validação concluída.");
        } else {
          const imported = data?.imported;
          const message = `Importadas ${imported?.pairings ?? 0} duplas · Seeds ${imported?.seedsApplied ?? 0} · Grupos ${imported?.groupsApplied ?? 0}`;
          setImportMessage(message);
          setImportFile(null);
          mutatePairings();
          mutateConfig();
        }
      } else {
        if (data?.summary) setImportSummary(data.summary);
        if (Array.isArray(data?.errors)) setImportErrors(data.errors as ImportErrorItem[]);
        const message =
          data?.error === "INVALID_ROWS"
            ? `Encontrámos ${data?.summary?.errorCount ?? data?.errors?.length ?? 0} erro(s).`
            : data?.error === "EVENT_FULL"
              ? "Evento cheio. Aumenta o limite total."
              : data?.error === "CATEGORY_FULL"
                ? "Categoria cheia. Ajusta a capacidade."
                : data?.error === "CATEGORY_PLAYERS_FULL"
                  ? "Categoria cheia (limite de jogadores)."
                  : "Erro ao importar inscrições.";
        setImportMessage(message);
      }
    } catch (err) {
      setImportMessage(mode === "preview" ? "Erro ao validar importação." : "Erro ao importar inscrições.");
    } finally {
      setImportMode(null);
    }
  }

  const getKoDraft = (match: Match) =>
    koEdits[match.id] ?? {
      pairingAId: match.pairingA?.id ?? match.pairingAId ?? null,
      pairingBId: match.pairingB?.id ?? match.pairingBId ?? null,
    };

  const updateKoDraft = (match: Match, update: Partial<{ pairingAId: number | null; pairingBId: number | null }>) => {
    const current = getKoDraft(match);
    setKoEdits((prev) => ({
      ...prev,
      [match.id]: { ...current, ...update },
    }));
  };

  const clearKoDraft = (matchId: number) => {
    setKoEdits((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  };

  const hasKoDraftChanges = (match: Match, draft: { pairingAId: number | null; pairingBId: number | null }) => {
    const currentA = match.pairingA?.id ?? match.pairingAId ?? null;
    const currentB = match.pairingB?.id ?? match.pairingBId ?? null;
    return draft.pairingAId !== currentA || draft.pairingBId !== currentB;
  };

  async function saveKoAssignment(match: Match) {
    const draft = getKoDraft(match);
    if (!hasKoDraftChanges(match, draft)) return;
    setKoSaving((prev) => ({ ...prev, [match.id]: true }));
    setKoEditMessage(null);
    const res = await fetch("/api/padel/matches/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        pairingAId: draft.pairingAId,
        pairingBId: draft.pairingBId,
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setKoEditMessage("Quadro atualizado.");
      clearKoDraft(match.id);
      mutateMatches();
      mutateConfig();
    } else {
      const error = data?.error;
      const message =
        error === "KO_LOCKED"
          ? "Quadro já iniciado; edição bloqueada."
          : error === "PAIRING_ALREADY_ASSIGNED"
            ? "Dupla já usada nesta ronda."
            : error === "PAIRING_INVALID"
              ? "Dupla inválida ou não confirmada."
              : error === "DUPLICATE_PAIRING"
                ? "A mesma dupla não pode estar nos dois lados."
                : "Erro ao atualizar o quadro.";
      setKoEditMessage(message);
    }
    setKoSaving((prev) => ({ ...prev, [match.id]: false }));
  }

  async function saveTvMonitorSettings() {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const sponsors = tvSponsors
      .split(/[\n,;]/g)
      .map((item) => item.trim())
      .filter(Boolean);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        tvMonitor: {
          footerText: tvFooterText.trim() || null,
          sponsors,
        },
      }),
    });
    if (res.ok) {
      setConfigMessage("Monitor atualizado.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao atualizar monitor.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function toggleWaitlist(next: boolean) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        waitlistEnabled: next,
      }),
    });
    if (res.ok) {
      setConfigMessage("Configuração guardada.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar configuração.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  const canSubmitSwap =
    swapPairingAId && swapPairingBId && swapPairingAId !== swapPairingBId && !swapBusy;
  const resolvedOrgIdForTournamentActions =
    typeof organizationId === "number" && organizationId > 0
      ? organizationId
      : typeof configRes?.config?.organizationId === "number" && configRes.config.organizationId > 0
        ? configRes.config.organizationId
        : null;

  async function handleSwapPairings() {
    if (!eventId || !resolvedOrgIdForTournamentActions) return;
    const pairingAId = Number(swapPairingAId);
    const pairingBId = Number(swapPairingBId);
    if (!Number.isFinite(pairingAId) || !Number.isFinite(pairingBId)) {
      setSwapError("Seleciona duas duplas válidas.");
      return;
    }
    setSwapBusy(true);
    setSwapError(null);
    setSwapMessage(null);
    try {
      const res = await fetch(`/api/org/${resolvedOrgIdForTournamentActions}/tournaments/pairings/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, pairingAId, pairingBId }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setSwapMessage("Troca concluída.");
        setSwapPairingAId("");
        setSwapPairingBId("");
        mutatePairings();
        setTimeout(() => setSwapMessage(null), 2500);
      } else {
        const error = data?.error || data?.errorCode;
        const message =
          error === "CATEGORY_MISMATCH"
            ? "Duplas de categorias diferentes."
            : error === "PARTNER_LOCKED"
              ? "Parceiro já pago. Troca bloqueada."
              : error === "PARTNER_MISSING"
                ? "Uma das duplas não tem parceiro."
                : error === "DUPLICATE_PLAYER"
                  ? "Troca cria jogador duplicado."
                  : error === "SWAP_NOT_ALLOWED"
                    ? "Troca não permitida."
                    : "Erro ao trocar parceiros.";
        setSwapError(message);
      }
    } catch (err) {
      setSwapError("Erro ao trocar parceiros.");
    } finally {
      setSwapBusy(false);
    }
  }

  async function sendBroadcast() {
    if (!eventId || !resolvedOrgIdForTournamentActions) return;
    const message = broadcastMessage.trim();
    if (!message) {
      setBroadcastError("Mensagem obrigatória.");
      return;
    }
    setBroadcastBusy(true);
    setBroadcastError(null);
    setBroadcastResult(null);
    try {
      const res = await fetch(`/api/org/${resolvedOrgIdForTournamentActions}/tournaments/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          title: broadcastTitle.trim() || null,
          message,
          audience: broadcastAudience,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setBroadcastResult(`Mensagem enviada a ${data?.recipients ?? 0} utilizadores.`);
        setBroadcastMessage("");
        setBroadcastTitle("");
        setTimeout(() => setBroadcastResult(null), 3500);
      } else {
        const error = data?.error || data?.errorCode;
        const message =
          error === "NO_RECIPIENTS"
            ? "Sem destinatários elegíveis."
            : error === "MESSAGE_TOO_LONG"
              ? "Mensagem demasiado longa."
              : "Erro ao enviar mensagem.";
        setBroadcastError(message);
      }
    } catch (err) {
      setBroadcastError("Erro ao enviar mensagem.");
    } finally {
      setBroadcastBusy(false);
    }
  }

  async function promoteWaitlist() {
    if (!eventId) return;
    setConfigMessage(null);
    const res = await fetch(orgApi("/padel/waitlist/promote"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        categoryId: selectedCategoryId ?? undefined,
      }),
    });
    if (res.ok) {
      setConfigMessage("Entrada promovida com sucesso.");
      mutateConfig();
      mutateWaitlist();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      const data = await res.json().catch(() => null);
      const error =
        data?.error === "WAITLIST_EMPTY"
          ? "Sem entradas na lista de espera."
          : data?.error === "WAITLIST_DISABLED"
            ? "Waitlist desativada."
            : data?.error === "ALREADY_IN_CATEGORY"
              ? "Já inscrito na categoria."
              : data?.error === "MAX_CATEGORIES"
                ? "Limite de categorias atingido."
                : data?.error === "EVENT_FULL"
                  ? "Torneio cheio."
                  : data?.error === "CATEGORY_FULL"
                    ? "Categoria cheia."
                    : data?.error === "CATEGORY_PLAYERS_FULL"
                      ? "Categoria cheia."
            : data?.error === "INSCRIPTIONS_CLOSED"
              ? "Inscrições fechadas."
            : data?.error === "TOURNAMENT_STARTED"
              ? "Torneio já começou."
            : "Falha a promover waitlist.";
      setConfigMessage(error);
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function saveRegistrationWindow(payload: { start?: string | null; end?: string | null }) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const start = payload.start ?? null;
    const end = payload.end ?? null;
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e.getTime() <= s.getTime()) {
        setConfigMessage("A data de fecho deve ser depois da abertura.");
        setTimeout(() => setConfigMessage(null), 2500);
        return;
      }
    }
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        registrationStartsAt: start,
        registrationEndsAt: end,
      }),
    });
    if (res.ok) {
      setConfigMessage("Configuração guardada.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar configuração.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function savePolicy(update: { allowSecondCategory?: boolean | null; maxEntriesTotal?: number | null }) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        ...update,
      }),
    });
    if (res.ok) {
      setConfigMessage("Configuração guardada.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar configuração.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function saveCompetitionState(next: string) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        competitionState: next,
      }),
    });
    if (res.ok) {
      setConfigMessage("Estado atualizado.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao atualizar estado.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function saveRuleSetId(nextId: number | null) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        ruleSetId: nextId,
      }),
    });
    if (res.ok) {
      setConfigMessage("Regras guardadas.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar regras.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function saveSeedRank(pairingId: number, value: number | null) {
    const organizationId = configRes?.config?.organizationId;
    const format = formatRequested || formatEffective || "GRUPOS_ELIMINATORIAS";
    if (!organizationId || !eventId) return;
    setConfigMessage(null);
    const next = { ...seedRanks };
    if (value && Number.isFinite(value)) {
      next[String(pairingId)] = Math.round(value);
    } else {
      delete next[String(pairingId)];
    }
    const res = await fetch(`/api/padel/tournaments/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        eventId,
        format,
        seedRanks: next,
      }),
    });
    if (res.ok) {
      setConfigMessage("Seeds guardadas.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao guardar seeds.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function generateSeedsFromRanking() {
    if (!eventId) return;
    setConfigMessage(null);
    setSeedingBusy(true);
    try {
      const res = await fetch("/api/padel/tournaments/seeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          categoryId: selectedCategoryId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setConfigMessage(sanitizeUiErrorMessage(json?.error, "Erro ao gerar seeds."));
        setTimeout(() => setConfigMessage(null), 2500);
        return;
      }
      setConfigMessage("Seeds geradas automaticamente com base no ranking.");
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2200);
    } catch (err) {
      console.error("[padel/seeds] generate", err);
      setConfigMessage("Erro ao gerar seeds.");
      setTimeout(() => setConfigMessage(null), 2500);
    } finally {
      setSeedingBusy(false);
    }
  }


  const handleNumberConfig = (
    e: React.FocusEvent<HTMLInputElement>,
    key: "groupCount" | "qualifyPerGroup" | "extraQualifiers",
  ) => {
    const val = Number(e.target.value);
    const minAllowed = key === "extraQualifiers" ? 0 : 1;
    if (!Number.isFinite(val) || val < minAllowed) {
      e.target.value = "";
      return;
    }
    saveGroupsConfig({ [key]: val } as any);
  };

  async function submitResult(matchId: number) {
    const draft = resultDrafts[matchId];
    if (!draft) return;
    const scoreText = draft.scoreText || "";
    const sets = scoreText
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((s) => s.split("-").map((v) => Number(v.trim())))
      .filter((arr) => arr.length === 2 && Number.isFinite(arr[0]) && Number.isFinite(arr[1]))
      .map(([a, b]) => ({ teamA: a, teamB: b }));
    const gamesA = Number(draft.gamesA);
    const gamesB = Number(draft.gamesB);

    const resultType = draft.resultType ?? "NORMAL";
    const timedMode = draft.scoreMode === "TIMED_GAMES";
    if (resultType === "NORMAL") {
      if (timedMode) {
        if (!Number.isFinite(gamesA) || !Number.isFinite(gamesB) || gamesA < 0 || gamesB < 0) {
          updateResultDraft(matchId, { error: "Indica jogos válidos (ex: 6 vs 4)." });
          return;
        }
        if (!draft.allowTimedDraw && gamesA === gamesB) {
          updateResultDraft(matchId, { error: "Empate não permitido neste modo." });
          return;
        }
      } else if (sets.length === 0) {
        updateResultDraft(matchId, { error: "Indica o resultado (ex: 6-3, 6-4)." });
        return;
      }
    } else if (draft.winnerSide !== "A" && draft.winnerSide !== "B") {
      updateResultDraft(matchId, { error: "Seleciona o vencedor (A ou B)." });
      return;
    }

    updateResultDraft(matchId, { saving: true, error: null });
    const isSpecialResult = resultType !== "NORMAL";
    const clientRequestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const timedWinnerSide =
      Number.isFinite(gamesA) && Number.isFinite(gamesB) && gamesA !== gamesB ? (gamesA > gamesB ? "A" : "B") : null;
    const score: Record<string, unknown> = {
      resultType,
      ...(resultType === "NORMAL" && timedMode
        ? {
            mode: "TIMED_GAMES",
            gamesA,
            gamesB,
            allowDraw: draft.allowTimedDraw,
            endedByBuzzer: draft.endedByBuzzer,
            endedAt: new Date().toISOString(),
          }
        : sets.length > 0
          ? { sets }
          : {}),
      ...(draft.winnerSide
        ? { winnerSide: draft.winnerSide }
        : resultType === "NORMAL" && timedMode && timedWinnerSide
          ? { winnerSide: timedWinnerSide }
          : {}),
      ...(draft.photoUrl ? { photoUrl: draft.photoUrl } : {}),
    };

    const res = isSpecialResult
      ? await fetch(`/api/padel/matches/${matchId}/walkover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            winner: draft.winnerSide,
            resultType,
            confirmedByRole: "DIRETOR_PROVA",
            confirmationSource: "WEB_ORGANIZATION",
            clientRequestId,
          }),
        })
      : await fetch(`/api/padel/matches/${matchId}/result/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            score,
            clientRequestId,
          }),
        });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const error = resolveResultSaveError(typeof data?.error === "string" ? data.error : null);
      updateResultDraft(matchId, { saving: false, error });
      return;
    }
    mutateMatches();
    setManualFallbackEnabled((prev) => ({ ...prev, [matchId]: false }));
    updateResultDraft(matchId, { saving: false });
  }

  async function runResultWorkflowAction(matchId: number, path: string, payload: Record<string, unknown>) {
    const clientRequestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    setWorkflowBusy((prev) => ({ ...prev, [matchId]: true }));
    setWorkflowError((prev) => ({ ...prev, [matchId]: null }));
    try {
      const res = await fetch(`/api/padel/matches/${matchId}/result/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationSource: "WEB_ORGANIZATION",
          confirmedByRole: "DIRETOR_PROVA",
          clientRequestId,
          ...payload,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setWorkflowError((prev) => ({
          ...prev,
          [matchId]: sanitizeUiErrorMessage(json?.error, "Erro no workflow de resultado."),
        }));
        return false;
      }
      mutateMatches();
      return true;
    } catch (err) {
      setWorkflowError((prev) => ({ ...prev, [matchId]: "Erro no workflow de resultado." }));
      return false;
    } finally {
      setWorkflowBusy((prev) => ({ ...prev, [matchId]: false }));
      setTimeout(() => {
        setWorkflowError((prev) => ({ ...prev, [matchId]: null }));
      }, 3500);
    }
  }

  async function confirmResult(matchId: number) {
    await runResultWorkflowAction(matchId, "confirm", {});
  }

  async function rejectResult(matchId: number) {
    const reasonText = window.prompt("Motivo da rejeição (obrigatório)") ?? "";
    if (!reasonText.trim()) return;
    await runResultWorkflowAction(matchId, "reject", { reasonText: reasonText.trim() });
  }

  async function resetPendingResult(matchId: number, targetState: "IN_PROGRESS" | "RESULT_SUBMITTED") {
    const reasonText = window.prompt("Motivo do reset (obrigatório)") ?? "";
    if (!reasonText.trim()) return;
    await runResultWorkflowAction(matchId, "reset-pending", {
      reasonCode: "OPERATIONS_RESET",
      reasonText: reasonText.trim(),
      targetState,
    });
  }

  async function overrideResult(matchId: number) {
    const reasonText = window.prompt("Motivo do override (obrigatório)") ?? "";
    if (!reasonText.trim()) return;
    const evidence = window.prompt("Anexo/evidência (URL ou referência) obrigatório") ?? "";
    if (!evidence.trim()) return;
    await runResultWorkflowAction(matchId, "override", {
      reasonCode: "OPERATIONS_OVERRIDE",
      reasonText: reasonText.trim(),
      evidenceAttachments: [evidence.trim()],
    });
  }

  async function savePartialScore(matchId: number) {
    const draft = resultDrafts[matchId];
    if (!draft) return;
    const scoreText = draft.scoreText || "";
    const sets = scoreText
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((s) => s.split("-").map((v) => Number(v.trim())))
      .filter((arr) => arr.length === 2 && Number.isFinite(arr[0]) && Number.isFinite(arr[1]))
      .map(([a, b]) => ({ teamA: a, teamB: b }));
    const gamesA = Number(draft.gamesA);
    const gamesB = Number(draft.gamesB);
    const timedMode = draft.scoreMode === "TIMED_GAMES";

    if (timedMode && (!Number.isFinite(gamesA) || !Number.isFinite(gamesB) || gamesA < 0 || gamesB < 0)) {
      updateResultDraft(matchId, { error: "Indica parcial válido (jogos A/B)." });
      return;
    }
    if (!timedMode && sets.length === 0) {
      updateResultDraft(matchId, { error: "Indica parcial de sets (ex: 4-3)." });
      return;
    }

    updateResultDraft(matchId, { saving: true, error: null });
    const timedWinnerSide =
      Number.isFinite(gamesA) && Number.isFinite(gamesB) && gamesA !== gamesB ? (gamesA > gamesB ? "A" : "B") : null;
    const score: Record<string, unknown> = {
      ...(timedMode
        ? {
            mode: "TIMED_GAMES",
            gamesA,
            gamesB,
            allowDraw: draft.allowTimedDraw,
            endedByBuzzer: false,
            ...(timedWinnerSide ? { winnerSide: timedWinnerSide } : {}),
          }
        : sets.length > 0
          ? { sets }
          : {}),
      ...(draft.photoUrl ? { photoUrl: draft.photoUrl } : {}),
    };

    const res = await fetch(`/api/padel/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: matchId, status: "IN_PROGRESS", score }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const error = resolveResultSaveError(typeof data?.error === "string" ? data.error : null);
      updateResultDraft(matchId, { saving: false, error });
      return;
    }
    mutateMatches();
    setManualFallbackEnabled((prev) => ({ ...prev, [matchId]: false }));
    updateResultDraft(matchId, { saving: false });
  }

  async function resolveMatchDispute(matchId: number) {
    if (!isAdminRole) {
      setDisputeError((prev) => ({ ...prev, [matchId]: "Apenas ADMIN pode resolver." }));
      return;
    }
    const confirmed = window.confirm("Resolver disputa e desbloquear o jogo?");
    if (!confirmed) return;
    const resolutionNote = window.prompt("Nota de resolução (opcional)") ?? "";
    const clientRequestId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    setDisputeBusy((prev) => ({ ...prev, [matchId]: true }));
    setDisputeError((prev) => ({ ...prev, [matchId]: null }));
    try {
      const res = await fetch(`/api/padel/matches/${matchId}/dispute`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(resolutionNote ? { resolutionNote } : {}),
          resolutionStatus: "CONFIRMED",
          confirmationSource: "WEB_ORGANIZATION",
          clientRequestId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setDisputeError((prev) => ({
          ...prev,
          [matchId]: sanitizeUiErrorMessage(json?.error, "Erro ao resolver disputa."),
        }));
        return;
      }
      mutateMatches();
    } catch (err) {
      setDisputeError((prev) => ({ ...prev, [matchId]: "Erro ao resolver disputa." }));
    } finally {
      setDisputeBusy((prev) => ({ ...prev, [matchId]: false }));
      setTimeout(() => {
        setDisputeError((prev) => ({ ...prev, [matchId]: null }));
      }, 2500);
    }
  }

  async function uploadResultPhoto(matchId: number, file: File) {
    if (!file) return;
    updateResultDraft(matchId, { uploading: true, error: null });
    try {
      const organizationId = configRes?.config?.organizationId;
      if (!organizationId) {
        updateResultDraft(matchId, { uploading: false, error: "Organização inválida." });
        return;
      }
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/upload?scope=padel-match&organizationId=${organizationId}`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        updateResultDraft(matchId, {
          uploading: false,
          error: sanitizeUiErrorMessage(json?.error, "Erro ao fazer upload."),
        });
        return;
      }
      updateResultDraft(matchId, { photoUrl: json.url, uploading: false });
    } catch (err) {
      updateResultDraft(matchId, { uploading: false, error: "Erro ao fazer upload." });
    }
  }


  const renderResultControls = (m: Match) => {
    const draft = resultDrafts[m.id];
    if (!draft) return null;
    const dispute = getDisputeInfo(m);
    const disputeOpen = dispute.status === "OPEN";
    const disputeResolved = dispute.status === "RESOLVED";
    const workflow = getLiveWorkflowInfo(m);
    const pendingReviewExpiredAt = workflow.pendingReviewExpiredAt
      ? new Date(workflow.pendingReviewExpiredAt)
      : null;
    const pendingExpiredMinutes =
      pendingReviewExpiredAt && !Number.isNaN(pendingReviewExpiredAt.getTime())
        ? Math.max(0, Math.floor((Date.now() - pendingReviewExpiredAt.getTime()) / 60000))
        : null;
    const lockedByWorkflow = m.status === "PENDING_CONFIRMATION" || m.status === "PENDING_REVIEW_EXPIRED";
    const lockedByDispute = (disputeOpen || m.status === "DISPUTED") && !isAdminRole;
    const fallbackEnabled = manualFallbackEnabled[m.id] === true;
    const lockInputs = (lockedByWorkflow || lockedByDispute) && !fallbackEnabled;
    const resolving = disputeBusy[m.id] === true;
    const disputeMsg = disputeError[m.id];
    const actionRunning = workflowBusy[m.id] === true;
    const actionError = workflowError[m.id];
    const showTimedInputs = draft.resultType === "NORMAL" && draft.scoreMode === "TIMED_GAMES";
    const showSetsInputs = draft.resultType === "NORMAL" && draft.scoreMode === "SETS";
    return (
      <div className="space-y-2 text-[12px]">
        {m.status === "PENDING_CONFIRMATION" && (
          <div className="rounded-lg border border-sky-300/35 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-100 space-y-2">
            <p className="font-semibold">Resultado pendente de confirmação</p>
            <p className="text-sky-100/80">Progressão bloqueada até confirmar/rejeitar.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => confirmResult(m.id)}
                disabled={!isAdminRole || actionRunning}
                className="rounded-full border border-sky-200/45 px-3 py-1 text-[11px] text-sky-100 hover:bg-sky-400/10 disabled:opacity-60"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => rejectResult(m.id)}
                disabled={!isAdminRole || actionRunning}
                className="rounded-full border border-white/25 px-3 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-60"
              >
                Rejeitar
              </button>
            </div>
          </div>
        )}
        {m.status === "PENDING_REVIEW_EXPIRED" && (
          <div className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100 space-y-2">
            <p className="font-semibold">Pendente expirado · fila operacional</p>
            <p className="text-rose-100/80">
              {pendingExpiredMinutes != null
                ? `Expirado há ${pendingExpiredMinutes} min (SLA alvo: <=30s).`
                : "Expirado; requer revisão humana."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => confirmResult(m.id)}
                disabled={!isAdminRole || actionRunning}
                className="rounded-full border border-rose-200/45 px-3 py-1 text-[11px] text-rose-100 hover:bg-rose-400/10 disabled:opacity-60"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => rejectResult(m.id)}
                disabled={!isAdminRole || actionRunning}
                className="rounded-full border border-white/25 px-3 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-60"
              >
                Rejeitar
              </button>
              <button
                type="button"
                onClick={() => resetPendingResult(m.id, "IN_PROGRESS")}
                disabled={!isAdminRole || actionRunning}
                className="rounded-full border border-white/25 px-3 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-60"
              >
                Reset {"->"} Em curso
              </button>
              <button
                type="button"
                onClick={() => resetPendingResult(m.id, "RESULT_SUBMITTED")}
                disabled={!isAdminRole || actionRunning}
                className="rounded-full border border-white/25 px-3 py-1 text-[11px] text-white/90 hover:bg-white/10 disabled:opacity-60"
              >
                Reset {"->"} Submetido
              </button>
              <button
                type="button"
                onClick={() => overrideResult(m.id)}
                disabled={!isAdminRole || actionRunning}
                className="rounded-full border border-amber-200/45 px-3 py-1 text-[11px] text-amber-100 hover:bg-amber-400/10 disabled:opacity-60"
              >
                Override
              </button>
            </div>
          </div>
        )}
        {m.status === "RESULT_SUBMITTED" && (
          <div className="rounded-lg border border-indigo-300/35 bg-indigo-500/10 px-3 py-2 text-[11px] text-indigo-100 space-y-2">
            <p className="font-semibold">Resultado submetido</p>
            <p className="text-indigo-100/80">Confirma para oficial ou ajusta o score antes de fechar.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => confirmResult(m.id)}
                disabled={!isAdminRole || actionRunning}
                className="rounded-full border border-indigo-200/45 px-3 py-1 text-[11px] text-indigo-100 hover:bg-indigo-400/10 disabled:opacity-60"
              >
                Confirmar resultado
              </button>
              {!isAdminRole && <span className="text-indigo-100/70">Apenas ADMIN confirma.</span>}
            </div>
          </div>
        )}
        {m.status === "DISPUTED" && isAdminRole && (
          <div className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 space-y-2">
            <p className="font-semibold">Disputa em curso</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => overrideResult(m.id)}
                disabled={actionRunning}
                className="rounded-full border border-amber-200/45 px-3 py-1 text-[11px] text-amber-100 hover:bg-amber-400/10 disabled:opacity-60"
              >
                Override para oficial
              </button>
            </div>
          </div>
        )}
        {disputeOpen && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 space-y-1">
            <p className="font-semibold">Disputa aberta</p>
            {dispute.reason && <p className="text-amber-100/80">Motivo: {dispute.reason}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {isAdminRole ? (
                <button
                  type="button"
                  onClick={() => resolveMatchDispute(m.id)}
                  disabled={resolving}
                  className="rounded-full border border-amber-200/40 px-3 py-1 text-[11px] text-amber-100 hover:bg-amber-400/10 disabled:opacity-60"
                >
                  {resolving ? "A resolver…" : "Resolver disputa"}
                </button>
              ) : (
                <span className="text-amber-100/70">Apenas ADMIN pode resolver.</span>
              )}
              {disputeMsg && <span className="text-amber-200">{disputeMsg}</span>}
            </div>
          </div>
        )}
        {disputeResolved && (
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-50 space-y-1">
            <p className="font-semibold">Disputa resolvida</p>
            {dispute.resolutionNote && <p className="text-emerald-100/80">Nota: {dispute.resolutionNote}</p>}
          </div>
        )}
        {(lockedByWorkflow || lockedByDispute) && isAdminRole && (
          <div className="rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-[11px] text-white/80 space-y-2">
            <p className="font-semibold text-white">Fallback manual (Admin)</p>
            <p className="text-white/65">
              Em incidentes de operação podes desbloquear inputs para corrigir score e voltar a submeter.
            </p>
            <button
              type="button"
              onClick={() =>
                setManualFallbackEnabled((prev) => ({
                  ...prev,
                  [m.id]:
                    prev[m.id] === true
                      ? false
                      : window.confirm("Ativar fallback manual para este jogo?")
                        ? true
                        : false,
                }))
              }
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/90 hover:bg-white/10"
            >
              {fallbackEnabled ? "Fechar fallback manual" : "Abrir fallback manual"}
            </button>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={draft.resultType}
            onChange={(e) =>
              updateResultDraft(m.id, {
                resultType: e.target.value as "NORMAL" | "WALKOVER" | "RETIREMENT" | "INJURY",
                ...(e.target.value === "NORMAL" ? { winnerSide: "" } : {}),
              })
            }
            disabled={lockInputs}
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 disabled:opacity-60"
          >
            <option value="NORMAL">Resultado normal</option>
            <option value="WALKOVER">WO / Falta</option>
            <option value="RETIREMENT">Desistência</option>
            <option value="INJURY">Lesão</option>
          </select>
          {draft.resultType === "NORMAL" && (
            <select
              value={draft.scoreMode}
              onChange={(e) =>
                updateResultDraft(m.id, {
                  scoreMode: e.target.value === "TIMED_GAMES" ? "TIMED_GAMES" : "SETS",
                })
              }
              disabled={lockInputs}
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 disabled:opacity-60"
            >
              <option value="SETS">Modo sets</option>
              <option value="TIMED_GAMES">Modo tempo (jogos)</option>
            </select>
          )}
        </div>
        {showSetsInputs && (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="6-3, 6-4"
              value={draft.scoreText}
              onChange={(e) => updateResultDraft(m.id, { scoreText: e.target.value })}
              disabled={lockInputs}
              className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
              <span className="text-white/55">Atalhos:</span>
              {["6-4, 6-4", "6-3, 6-4", "7-6, 6-4"].map((preset) => (
                <button
                  key={`sets-preset-${m.id}-${preset}`}
                  type="button"
                  onClick={() => updateResultDraft(m.id, { scoreText: preset })}
                  disabled={lockInputs}
                  className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}
        {showTimedInputs && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              type="number"
              min={0}
              step={1}
              value={draft.gamesA}
              onChange={(e) => updateResultDraft(m.id, { gamesA: e.target.value })}
              disabled={lockInputs}
              placeholder={`Jogos A · ${nameFromSlots(m.pairingA, locale)}`}
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 disabled:opacity-60"
            />
            <input
              type="number"
              min={0}
              step={1}
              value={draft.gamesB}
              onChange={(e) => updateResultDraft(m.id, { gamesB: e.target.value })}
              disabled={lockInputs}
              placeholder={`Jogos B · ${nameFromSlots(m.pairingB, locale)}`}
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 disabled:opacity-60"
            />
            <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-[11px] text-white/75">
              <input
                type="checkbox"
                checked={draft.allowTimedDraw}
                onChange={(e) => updateResultDraft(m.id, { allowTimedDraw: e.target.checked })}
                disabled={lockInputs}
              />
              Permitir empate
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-[11px] text-white/75">
              <input
                type="checkbox"
                checked={draft.endedByBuzzer}
                onChange={(e) => updateResultDraft(m.id, { endedByBuzzer: e.target.checked })}
                disabled={lockInputs}
              />
              Terminou no buzzer
            </label>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
              <span className="text-white/55">Atalhos tempo:</span>
              {[
                { label: "6-4", gamesA: "6", gamesB: "4" },
                { label: "6-6", gamesA: "6", gamesB: "6" },
                { label: "7-5", gamesA: "7", gamesB: "5" },
              ].map((preset) => (
                <button
                  key={`timed-preset-${m.id}-${preset.label}`}
                  type="button"
                  onClick={() => updateResultDraft(m.id, { gamesA: preset.gamesA, gamesB: preset.gamesB })}
                  disabled={lockInputs}
                  className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {draft.resultType !== "NORMAL" && (
          <select
            value={draft.winnerSide}
            onChange={(e) =>
              updateResultDraft(m.id, { winnerSide: e.target.value as "" | "A" | "B" })
            }
            disabled={lockInputs}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 disabled:opacity-60"
          >
            <option value="">Seleciona vencedor</option>
            <option value="A">A · {nameFromSlots(m.pairingA, locale)}</option>
            <option value="B">B · {nameFromSlots(m.pairingB, locale)}</option>
          </select>
        )}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
          <label className="flex items-center gap-2 rounded-full border border-white/15 px-3 py-1">
            Foto
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadResultPhoto(m.id, file);
              }}
              disabled={lockInputs}
              className="text-[11px] text-white/70 disabled:opacity-60"
            />
          </label>
          {draft.uploading && <span>A enviar…</span>}
          {draft.photoUrl && (
            <a href={draft.photoUrl} target="_blank" rel="noreferrer" className="underline">
              Ver foto
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => savePartialScore(m.id)}
            disabled={draft.saving || draft.uploading || lockInputs}
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            Guardar parcial
          </button>
          <button
            type="button"
            onClick={() => submitResult(m.id)}
            disabled={draft.saving || draft.uploading || lockInputs}
            className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black disabled:opacity-60"
          >
            {draft.saving ? "A guardar…" : "Guardar resultado"}
          </button>
          {draft.error && <span className="text-[11px] text-amber-200">{draft.error}</span>}
          {actionError && <span className="text-[11px] text-amber-200">{actionError}</span>}
        </div>
      </div>
    );
  };

  const renderGenerationPlanPanel = () => {
    if (!generationPlanDetails) return null;
    const categories = Array.isArray(generationPlanDetails.categories)
      ? generationPlanDetails.categories
      : [];
    const blockingReasons = Array.isArray(generationPlanDetails.blockingReasons)
      ? generationPlanDetails.blockingReasons
      : [];
    const warnings = Array.isArray(generationPlanDetails.warnings) ? generationPlanDetails.warnings : [];
    const totalSlots = Number(generationPlanDetails.totalSlots ?? 0);
    const matchesNeeded = Number(generationPlanDetails.matchesNeeded ?? 0);
    const unscheduledMatches = Number(generationPlanDetails.unscheduledMatches ?? 0);

    return (
      <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-3 text-[12px] text-amber-100 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Diagnóstico de capacidade</p>
          <span className="text-[11px] text-amber-200/85">
            Slots {totalSlots} · Jogos {matchesNeeded} · Em falta {Math.max(0, unscheduledMatches)}
          </span>
        </div>
        {categories.length > 0 && (
          <div className="space-y-1 text-[11px] text-amber-100/90">
            {categories.slice(0, 4).map((category) => (
              <p key={`plan-${category.key ?? category.label ?? "cat"}`}>
                • {category.label || "Categoria"}: {category.teams ?? 0} equipas · mínimo {category.minTeams ?? 0} ·
                jogos {category.matchesNeeded ?? 0}/{category.allocatedSlots ?? 0} slots
                {typeof category.recommendedMaxTeams === "number" ? ` · recomendado ${category.recommendedMaxTeams}` : ""}
                {typeof category.hardCapMax === "number" ? ` · hard cap ${category.hardCapMax}` : ""}
              </p>
            ))}
          </div>
        )}
        {blockingReasons.length > 0 && (
          <p className="text-[11px] text-amber-100/90">Bloqueios: {blockingReasons.join(" · ")}</p>
        )}
        {warnings.length > 0 && (
          <p className="text-[11px] text-amber-100/90">Avisos: {warnings.slice(0, 2).join(" · ")}</p>
        )}
        {generationPlanAlternatives.length > 0 && (
          <div className="space-y-1 text-[11px] text-amber-50">
            {generationPlanAlternatives.slice(0, 3).map((alternative, idx) => (
              <p key={`plan-alt-${idx}`}>• {alternative}</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderPlanningPreviewPanel = () => {
    if (planningPreviewLoading) {
      return (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[12px] text-white/70">
          A simular viabilidade por formato...
        </div>
      );
    }
    if (planningPreviewError) {
      return (
        <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-3 text-[12px] text-amber-100">
          {planningPreviewError}
        </div>
      );
    }
    if (!planningPreview) return null;
    const categories = Array.isArray(planningPreview.categories) ? planningPreview.categories : [];
    const blockingReasons = Array.isArray(planningPreview.blockingReasons) ? planningPreview.blockingReasons : [];
    const warnings = Array.isArray(planningPreview.warnings) ? planningPreview.warnings : [];
    const totalSlots = Number(planningPreview.totalSlots ?? 0);
    const matchesNeeded = Number(planningPreview.matchesNeeded ?? 0);
    const unscheduledMatches = Number(planningPreview.unscheduledMatches ?? 0);
    return (
      <div
        className={`rounded-xl border p-3 text-[12px] space-y-2 ${
          planningPreview.feasible
            ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
            : "border-amber-300/35 bg-amber-500/10 text-amber-100"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Pré-viabilidade por formato</p>
          <span className="text-[11px] opacity-90">
            Modo: {planningMode === "capacity" ? "capacidade teórica" : "equipas reais"}
          </span>
        </div>
        <p className="text-[11px] opacity-90">
          Slots {totalSlots} · Jogos {matchesNeeded} · Em falta {Math.max(0, unscheduledMatches)}
        </p>
        {categories.length > 0 && (
          <div className="space-y-1 text-[11px]">
            {categories.slice(0, 4).map((category) => (
              <p key={`preview-plan-${category.key ?? category.label ?? "cat"}`}>
                • {category.label || "Categoria"}: {category.teams ?? 0} equipas · mínimo {category.minTeams ?? 0} ·
                jogos {category.matchesNeeded ?? 0}/{category.allocatedSlots ?? 0}
                {typeof category.recommendedMaxTeams === "number" ? ` · recomendado ${category.recommendedMaxTeams}` : ""}
                {typeof category.hardCapMax === "number" ? ` · hard cap ${category.hardCapMax}` : ""}
                {typeof category.queueEstimatedRounds === "number"
                  ? ` · fila ~${category.queueEstimatedRounds} ronda(s)`
                  : ""}
              </p>
            ))}
          </div>
        )}
        {planningPreviewAlternatives.length > 0 && (
          <div className="space-y-1 text-[11px] opacity-95">
            {planningPreviewAlternatives.slice(0, 2).map((alternative, idx) => (
              <p key={`preview-plan-alt-${idx}`}>• {alternative}</p>
            ))}
          </div>
        )}
        {(warnings.length > 0 || blockingReasons.length > 0) && (
          <p className="text-[11px] opacity-90">
            {warnings.length > 0 ? `Avisos: ${warnings.slice(0, 2).join(" · ")}. ` : ""}
            {blockingReasons.length > 0 ? `Bloqueios técnicos: ${blockingReasons.join(" · ")}.` : ""}
          </p>
        )}
      </div>
    );
  };

  const surfaceTabs = [
    { id: "tab-duplas", label: "Duplas", active: tab === "duplas", onClick: () => setTab("duplas" as const) },
    ...(showGroupsTab
      ? [{ id: "tab-grupos", label: groupsTabLabel, active: tab === "grupos", onClick: () => setTab("grupos" as const) }]
      : []),
    ...(showKnockoutTab
      ? [{ id: "tab-eliminatorias", label: "Eliminatórias", active: tab === "eliminatorias", onClick: () => setTab("eliminatorias" as const) }]
      : []),
  ];

  return (
    <TournamentFormSurface
      tabs={surfaceTabs}
      leftColumn={
        <div className="space-y-3">
          <EventCoverLibraryPicker
            value={coverUrl}
            onChange={saveCoverImage}
            organizationId={organizationId}
            templateType="PADEL"
            title="Capa"
            subtitle="Editar capa do torneio"
          />
          {coverSaving ? <p className="text-[11px] text-white/60">A guardar capa...</p> : null}
        </div>
      }
      rightColumn={
        <section id="padel-config" className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Perfil por formato</p>
            <p className="text-[12px] text-white/70">Configuração global do torneio (sem overrides por categoria).</p>
          </div>
          <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/75">
            Global
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-white/60">Formato</span>
            <select
              value={generationFormat}
              disabled={!isAdminRole}
              onChange={(e) => saveFormatProfileConfig({ format: e.target.value }, "selected")}
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] disabled:opacity-60"
            >
              {PADEL_FORMAT_PROFILE_OPTIONS.map((opt) => (
                <option key={`profile-format-${opt}`} value={opt}>
                  {formatLabel(opt)}
                </option>
              ))}
            </select>
          </label>
          {isAmMxFormat && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-white/60">Modo AM/MX</span>
                <select
                  value={selectedAmMxMode}
                  disabled={!isAdminRole}
                  onChange={(e) =>
                    saveFormatProfileConfig(
                      { amMxMode: e.target.value === "FIXED_PAIR" ? "FIXED_PAIR" : "INDIVIDUAL_ROTATION" },
                      "selected",
                    )
                  }
                  className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] disabled:opacity-60"
                >
                  <option value="INDIVIDUAL_ROTATION">Rotação individual</option>
                  <option value="FIXED_PAIR">Dupla fixa</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-white/60">Progressão</span>
                <select
                  value={amMxProgressionMode === "ROUND_BY_ROUND" ? "ROUND_BY_ROUND" : "ROUND_BY_ROUND"}
                  disabled={!isAdminRole}
                  onChange={() => saveFormatProfileConfig({ amMxProgressionMode: "ROUND_BY_ROUND" }, "selected")}
                  className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] disabled:opacity-60"
                >
                  <option value="ROUND_BY_ROUND">Ronda a ronda</option>
                </select>
              </label>
            </>
          )}
          {isNonStopFormat && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-white/60">Modo NON_STOP</span>
                <select
                  value={selectedNonStopMode}
                  disabled={!isAdminRole}
                  onChange={(e) =>
                    saveFormatProfileConfig(
                      { nonStopMode: e.target.value === "HARD_CAP_WAITLIST" ? "HARD_CAP_WAITLIST" : "ACTIVE_QUEUE" },
                      "selected",
                    )
                  }
                  className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] disabled:opacity-60"
                >
                  <option value="ACTIVE_QUEUE">Fila ativa</option>
                  <option value="HARD_CAP_WAITLIST">Hard cap + waitlist</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-white/60">Rondas NON_STOP</span>
                <input
                  key={`profile-ns-rounds-${runtimeCategoryKey}-${selectedNonStopRounds}`}
                  type="number"
                  min={1}
                  defaultValue={selectedNonStopRounds}
                  disabled={!isAdminRole}
                  className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] disabled:opacity-60"
                  onBlur={(e) => {
                    const parsed = Number(e.target.value);
                    if (!Number.isFinite(parsed) || parsed <= 0) {
                      e.target.value = String(selectedNonStopRounds);
                      return;
                    }
                    const nextRounds = Math.max(1, Math.floor(parsed));
                    if (nextRounds === selectedNonStopRounds) return;
                    saveFormatProfileConfig({ nonStopRounds: nextRounds }, "selected");
                  }}
                />
              </label>
            </>
          )}
        </div>
      <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-[11px] text-white/65">
          Perfil único por torneio. Alterações aplicam-se a todas as categorias.
        </div>
      </div>
      {categoryOptions.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
          <span className="uppercase tracking-[0.18em] text-[11px] text-white/60">Categoria ativa</span>
          <select
            value={selectedCategoryId ?? ""}
            onChange={(e) => {
              if (e.target.value) {
                setPreferGlobalCategory(false);
                setSelectedCategoryId(Number(e.target.value));
                return;
              }
              setPreferGlobalCategory(true);
              setSelectedCategoryId(null);
            }}
            className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[12px] text-white/80"
          >
            <option value="">Global / todas</option>
            {categoryOptions.map((opt) => (
              <option key={`padel-cat-${opt.id}`} value={String(opt.id)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Auditoria</p>
          <span className="text-[11px] text-white/50">{auditItems.length} eventos</span>
        </div>
        {auditItems.length === 0 && <p className="text-white/60">Sem eventos de auditoria.</p>}
        {auditItems.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {auditItems.slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-white/60">
                  <span className="uppercase tracking-[0.12em]">{item.action}</span>
                  <span>
                    {item.createdAt
                      ? formatDateTime(new Date(item.createdAt), null, null)
                      : "—"}
                  </span>
                </div>
                <p className="text-[12px] text-white/70">{item.actorName || "Sistema"}</p>
                {summarizeAuditMeta(item.metadata) && (
                  <p className="text-[11px] text-white/50">{summarizeAuditMeta(item.metadata)}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {autoGeneratedMessage && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-[12px] text-emerald-100">
          {autoGeneratedMessage}
        </div>
      )}
      <section
        id="padel-exports"
        className="scroll-mt-24 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80"
      >
        <span className="uppercase tracking-[0.16em] text-[11px] text-white/60">Exportações</span>
        <a
          href={orgApi(`/padel/exports/inscritos?eventId=${eventId}&format=xlsx`)}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Inscritos (Excel)
        </a>
        <a
          href={orgApi(`/padel/exports/resultados?eventId=${eventId}&format=xlsx`)}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Resultados (Excel)
        </a>
        <a
          href={orgApi(`/padel/exports/bracket?eventId=${eventId}&format=pdf`)}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Bracket (PDF)
        </a>
        <a
          href={orgApi(`/padel/exports/bracket?eventId=${eventId}&format=html`)}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Bracket (Poster)
        </a>
        <a
          href={orgApi(`/padel/exports/calendario?eventId=${eventId}&format=pdf`)}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Calendário (PDF)
        </a>
        <a
          href={orgApi(`/padel/exports/calendario?eventId=${eventId}&format=csv`)}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Calendário (CSV)
        </a>
        <a
          href={orgApi(`/padel/exports/calendario?eventId=${eventId}&format=ics`)}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Calendário (ICS)
        </a>
        <a
          href={orgApi(`/padel/exports/analytics?eventId=${eventId}&format=xlsx`)}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Análises (Excel)
        </a>
        <a
          href={orgApi(`/padel/exports/analytics?eventId=${eventId}&format=csv`)}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Análises (CSV)
        </a>
      </section>
      {formatRequested && formatEffective && formatRequested !== formatEffective && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[12px] text-amber-50">
          Pedido: {formatLabel(formatRequested)}. Em uso: {formatLabel(formatEffective)} (Beta).
        </div>
      )}

      {(generationVersion || (supportsGroups && groupMissing > 0)) && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 flex items-center justify-between gap-3 flex-wrap">
          <span>Motor: {generationVersion ?? "v1-groups-ko"}</span>
          {supportsGroups && groupMissing > 0 && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-100">
              Faltam {groupMissing} jogo{groupMissing === 1 ? "" : "s"} para fechar classificação.
            </span>
          )}
        </div>
      )}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p>
              Formato ativo: <span className="font-semibold">{formatLabel(generationFormat)}</span>
            </p>
            <p className="text-white/70">{formatExecutionHint}</p>
            <p className={unscheduledMatchesCount === 0 ? "text-emerald-200" : "text-amber-200"}>{calendarReadinessHint}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-white/60">Planeamento</span>
              <select
                value={planningMode}
                onChange={(e) => setPlanningMode(e.target.value === "capacity" ? "capacity" : "runtime")}
                className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[11px] text-white/80"
              >
                <option value="runtime">Equipas reais</option>
                <option value="capacity">Capacidade teórica</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
              <span className="rounded-full border border-white/20 bg-black/30 px-2 py-1 text-white/80">
                {phaseSupportLabel}
              </span>
              <span className="rounded-full border border-white/20 bg-black/30 px-2 py-1 text-white/80">
                Calendário: {matches.length > 0 ? `${scheduleCoverage}%` : "sem jogos"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={autoScheduleHref}
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
            >
              Abrir calendário automático
            </a>
            {(isNonStopFormat || isAmMxFormat) && (
              <a
                href={roundOpsHref}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                Operar rondas
              </a>
            )}
          </div>
        </div>
      </div>

      {renderPlanningPreviewPanel()}
      {matches.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Filtro live</p>
            <span className="text-[11px] text-white/60">Ativo: {liveOpsFilterLabel}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "ALL" as LiveOpsFilter, label: "Todos", count: liveOpsCounters.all },
              { key: "ACTION_REQUIRED" as LiveOpsFilter, label: "Ação", count: liveOpsCounters.actionRequired },
              { key: "PENDING_CONFIRMATION" as LiveOpsFilter, label: "Pend. confirmação", count: liveOpsCounters.pendingConfirmation },
              {
                key: "PENDING_REVIEW_EXPIRED" as LiveOpsFilter,
                label: "Pend. expirado",
                count: liveOpsCounters.pendingReviewExpired,
              },
              { key: "DISPUTED" as LiveOpsFilter, label: "Disputa", count: liveOpsCounters.disputed },
              { key: "UNSCHEDULED" as LiveOpsFilter, label: "Sem horário", count: liveOpsCounters.unscheduled },
            ].map((item) => (
              <button
                key={`live-filter-${item.key}`}
                type="button"
                onClick={() => setLiveOpsFilter(item.key)}
                className={`rounded-full border px-3 py-1 text-[11px] ${
                  liveOpsFilter === item.key
                    ? "border-sky-300/60 bg-sky-500/20 text-sky-100"
                    : "border-white/20 bg-white/5 text-white/75 hover:bg-white/10"
                }`}
              >
                {item.label} ({item.count})
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "grupos" && (
        <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
            {supportsGroups ? "Configuração de grupos" : `Configuração de ${groupsTabLabel.toLowerCase()}`}
          </p>
          {configMessage && <p className="text-[12px] text-white/70">{configMessage}</p>}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
                {supportsGroups ? "Gerar jogos de grupos" : "Gerar ronda inicial"}
              </p>
              <p className="text-[12px] text-white/70">
                {supportsGroups
                  ? "Cria automaticamente os jogos de grupos para a categoria selecionada."
                  : isNonStopFormat
                    ? "Cria a ronda inicial NON_STOP e ativa a fila operacional."
                    : isAmMxFormat
                      ? "Cria apenas a primeira ronda; as seguintes avançam por classificação."
                      : "Cria as rondas iniciais para este formato."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => generateMatches("GROUPS")}
              disabled={!canGeneratePrimaryRound || generationBusy !== null}
              title={!isAdminRole ? "Sem permissões para gerar jogos." : undefined}
              className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-60"
            >
              {generationBusy === "GROUPS"
                ? "A gerar..."
                : supportsGroups
                  ? "Gerar jogos"
                  : "Gerar ronda"}
            </button>
          </div>
          {generationPhase === "GROUPS" && generationError && (
            <p className="text-[12px] text-red-200">{generationError}</p>
          )}
          {generationPhase === "GROUPS" && generationError && renderGenerationPlanPanel()}
          {generationPhase === "GROUPS" && generationMessage && (
            <p className="text-[12px] text-emerald-200">{generationMessage}</p>
          )}
          {(isNonStopFormat || isAmMxFormat) && (
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Runtime por ronda</p>
                <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] text-white/75">
                  {selectedCategoryLabel}
                </span>
              </div>
              {roundRuntimeHint && <p className="text-[12px] text-white/70">{roundRuntimeHint}</p>}
              {isNonStopFormat && (
                <>
                  <p className="text-[11px] text-white/65">
                    Modo:{" "}
                    {selectedNonStopMode === "HARD_CAP_WAITLIST"
                      ? "Hard cap + waitlist"
                      : "Fila ativa (King of Court)"}
                    {selectedNonStopRounds ? ` · ${selectedNonStopRounds} ronda(s)` : ""}
                    {nonStopRuntimeQueue.length > 0 ? ` · fila ${nonStopRuntimeQueue.length}` : ""}
                  </p>
                  {nonStopRuntimeActivePairs.length > 0 && (
                    <div className="space-y-1 text-[11px] text-white/70">
                      {nonStopRuntimeActivePairs.slice(0, 6).map((entry) => (
                        <p key={`runtime-court-${entry.court}`}>
                          Campo {entry.court}: {entry.pairingAId ? `#${entry.pairingAId}` : "—"} vs{" "}
                          {entry.pairingBId ? `#${entry.pairingBId}` : "—"}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}
              {isAmMxFormat && (
                <p className="text-[11px] text-white/65">
                  Progressão:{" "}
                  {amMxProgressionMode === "ROUND_BY_ROUND" ? "Dinâmica ronda a ronda" : "Ronda fixa"}
                  {selectedAmMxMode === "FIXED_PAIR" ? " · pares fixos" : " · rotação individual"}
                </p>
              )}
              <a
                href={roundOpsHref}
                className="inline-flex rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                Abrir painel de avanço
              </a>
            </div>
          )}
          {supportsGroups && (
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 space-y-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Modelos rápidos</p>
                <p className="text-[12px] text-white/70">Modelos para grupos + playoffs.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "T8", label: "8 equipas", groupCount: 2, groupSize: 4, qualifyPerGroup: 2 },
                  { id: "T16", label: "16 equipas", groupCount: 4, groupSize: 4, qualifyPerGroup: 2 },
                  { id: "T32", label: "32 equipas", groupCount: 8, groupSize: 4, qualifyPerGroup: 2 },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] text-white/80 hover:border-white/40"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Estado da competição</p>
              <p className="text-[12px] text-white/70">Oculto → Dev → Público → Cancelado.</p>
            </div>
            <select
              value={competitionState || "DEVELOPMENT"}
              onChange={(e) => saveCompetitionState(e.target.value)}
              className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px]"
            >
              <option value="HIDDEN">Oculto</option>
              <option value="DEVELOPMENT">Desenvolvimento</option>
              <option value="PUBLIC">Público</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Regras de desempate</p>
                <p className="text-[12px] text-white/70">Ruleset do torneio.</p>
              </div>
              <select
                value={configRes?.config?.ruleSetId ?? ""}
                onChange={(e) => saveRuleSetId(e.target.value ? Number(e.target.value) : null)}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px]"
              >
                <option value="">Default</option>
                {ruleSets.map((rule) => (
                  <option key={`rule-${rule.id}`} value={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
            </div>
            {activeRuleSet?.tieBreakRules && activeRuleSet.tieBreakRules.length > 0 && (
              <p className="text-[11px] text-white/70">
                Ordem: {activeRuleSet.tieBreakRules.join(" · ")}
              </p>
            )}
            {activeRuleSet?.pointsTable && (
              <p className="text-[11px] text-white/70">
                Pontos: WIN {activeRuleSet.pointsTable.WIN ?? 3} / LOSS {activeRuleSet.pointsTable.LOSS ?? 0}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Regras de score</p>
                <p className="text-[12px] text-white/70">Validação de sets e tie-breaks.</p>
              </div>
              <select
                value={scoreRulesPreset}
                onChange={(e) => saveScoreRules(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px]"
              >
                {SCORE_RULE_PRESETS.map((preset) => (
                  <option key={`score-rules-${preset.id}`} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
                {scoreRulesPreset === "CUSTOM" && (
                  <option value="CUSTOM">Custom</option>
                )}
              </select>
            </div>
            {activeScorePreset?.description && (
              <p className="text-[11px] text-white/70">{activeScorePreset.description}</p>
            )}
            {scoreRulesPreset === "CUSTOM" && (
              <p className="text-[11px] text-white/70">Preset custom ativo.</p>
            )}
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Workflow de resultado live</p>
                <p className="text-[12px] text-white/70">Define quem submete e quando o resultado fica oficial.</p>
              </div>
              <label className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[11px] text-white/80">
                <input
                  type="checkbox"
                  checked={playerResultSubmissionEnabled}
                  onChange={(e) =>
                    saveLiveWorkflowConfig({
                      playerResultSubmissionEnabled: e.target.checked,
                    })
                  }
                />
                Jogador pode submeter
              </label>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={resultValidationMode}
                onChange={(e) =>
                  saveLiveWorkflowConfig({
                    resultValidationMode:
                      e.target.value === "IMMEDIATE_PENDING_THEN_OFFICIAL"
                        ? "IMMEDIATE_PENDING_THEN_OFFICIAL"
                        : "IMMEDIATE_OFFICIAL",
                  })
                }
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px]"
              >
                <option value="IMMEDIATE_OFFICIAL">Staff: oficial imediato</option>
                <option value="IMMEDIATE_PENDING_THEN_OFFICIAL">Staff: pendente + confirmação</option>
              </select>
              <input
                key={`pending-window-${pendingConfirmationWindowMinutes}`}
                type="number"
                min={1}
                max={240}
                defaultValue={pendingConfirmationWindowMinutes}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px]"
                onBlur={(e) => {
                  const raw = Number(e.target.value);
                  if (!Number.isFinite(raw) || raw <= 0) {
                    e.target.value = String(pendingConfirmationWindowMinutes);
                    return;
                  }
                  const nextValue = Math.max(1, Math.min(240, Math.floor(raw)));
                  if (nextValue === pendingConfirmationWindowMinutes) return;
                  saveLiveWorkflowConfig({ pendingConfirmationWindowMinutes: nextValue });
                }}
              />
            </div>
            <p className="text-[11px] text-white/65">
              Janela pendente: {pendingConfirmationWindowMinutes} min · modo atual:{" "}
              {resultValidationMode === "IMMEDIATE_PENDING_THEN_OFFICIAL"
                ? "confirmação obrigatória"
                : "oficial imediato para staff"}
              .
            </p>
          </div>
          {supportsGroups && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Modo de grupos</p>
                  <p className="text-[12px] text-white/70">Auto distribui; Manual define grupos.</p>
                </div>
                <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-1 text-[12px]">
                  {[
                    { key: "AUTO", label: "Auto" },
                    { key: "MANUAL", label: "Manual" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => saveGroupsConfig({ mode: opt.key as "AUTO" | "MANUAL" })}
                      className={`rounded-full px-3 py-1 transition ${
                        groupMode === opt.key
                          ? "bg-white text-black font-semibold shadow"
                          : "text-white/75 hover:bg-white/5"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {groupMode === "MANUAL" && (
                <p className="text-[11px] text-white/60">Manual: escolhe grupo no separador Duplas.</p>
              )}
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">Nº de grupos</span>
                  <input
                    type="number"
                    min={1}
                    defaultValue={groupsConfig.groupCount ?? ""}
                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                    onBlur={(e) => handleNumberConfig(e, "groupCount")}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">Passam por grupo</span>
                  <input
                    type="number"
                    min={1}
                    defaultValue={groupsConfig.qualifyPerGroup ?? 2}
                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                    onBlur={(e) => handleNumberConfig(e, "qualifyPerGroup")}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">Melhores extra</span>
                  <input
                    type="number"
                    min={0}
                    defaultValue={groupsConfig.extraQualifiers ?? ""}
                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                    onBlur={(e) => handleNumberConfig(e, "extraQualifiers")}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-white/60">Seeding</span>
                  <select
                    defaultValue={groupsConfig.seeding ?? "SNAKE"}
                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                    onChange={(e) => saveGroupsConfig({ seeding: e.target.value as any })}
                  >
                    <option value="SNAKE">Snake (equilibrado)</option>
                    <option value="NONE">Aleatório</option>
                  </select>
                </label>
              </div>
            </>
          )}
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
            <span>Lista de espera</span>
            <button
              type="button"
              onClick={() => toggleWaitlist(!waitlistEnabled)}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                waitlistEnabled ? "bg-white text-black" : "border border-white/20 text-white/80"
              }`}
            >
              {waitlistEnabled ? "Ativa" : "Inativa"}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Abertura inscrições</span>
              <OryaDateTimeField
                value={toLocalInputValue(registrationStartsAt)}
                onChange={(next) => {
                  const value = next ? new Date(next).toISOString() : null;
                  saveRegistrationWindow({ start: value, end: registrationEndsAt });
                }}
                className="w-full"
                dateButtonClassName="h-9 flex-1 rounded-lg"
                timeButtonClassName="h-9 rounded-lg"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Fecho inscrições</span>
              <OryaDateTimeField
                value={toLocalInputValue(registrationEndsAt)}
                minDateTime={toLocalInputValue(registrationStartsAt)}
                onChange={(next) => {
                  const value = next ? new Date(next).toISOString() : null;
                  saveRegistrationWindow({ start: registrationStartsAt, end: value });
                }}
                className="w-full"
                dateButtonClassName="h-9 flex-1 rounded-lg"
                timeButtonClassName="h-9 rounded-lg"
              />
            </label>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Limite total de duplas</span>
              <input
                type="number"
                min={0}
                defaultValue={maxEntriesTotal ?? ""}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) {
                    savePolicy({ maxEntriesTotal: null });
                    return;
                  }
                  const parsed = Number(raw);
                  if (!Number.isFinite(parsed) || parsed <= 0) {
                    e.target.value = "";
                    return;
                  }
                  savePolicy({ maxEntriesTotal: Math.floor(parsed) });
                }}
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Categorias por jogador</span>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/70">
                <span>{allowSecondCategory ? "Até 2 categorias" : "Apenas 1 categoria"}</span>
                <button
                  type="button"
                  onClick={() => savePolicy({ allowSecondCategory: !allowSecondCategory })}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                    allowSecondCategory ? "bg-white text-black" : "border border-white/20 text-white/80"
                  }`}
                >
                  {allowSecondCategory ? "2 categorias" : "1 categoria"}
                </button>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-[12px] text-white/80 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">TV Monitor</p>
                <p className="text-[12px] text-white/70">Rodapé e patrocinadores do clube.</p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                Configuração interna
              </span>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Mensagem de rodapé</span>
              <input
                type="text"
                value={tvFooterText}
                onChange={(e) => setTvFooterText(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-2"
                placeholder="Ex: Bem-vindos ao torneio!"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Patrocinadores (1 por linha)</span>
              <textarea
                value={tvSponsors}
                onChange={(e) => setTvSponsors(e.target.value)}
                className="min-h-[72px] rounded-lg border border-white/15 bg-black/30 px-2 py-2"
                placeholder="Marca A&#10;Marca B"
              />
            </label>
            <button
              type="button"
              onClick={saveTvMonitorSettings}
              className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:border-white/40"
            >
              Guardar monitor
            </button>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-[12px] text-white/80 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Comunicação em massa</p>
                <p className="text-[12px] text-white/70">Envia aviso rápido a participantes e/ou waitlist.</p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                Notificações
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-2"
                placeholder="Título (opcional)"
              />
              <select
                value={broadcastAudience}
                onChange={(e) => setBroadcastAudience(e.target.value as "ALL" | "PLAYERS" | "WAITLIST")}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-[12px]"
              >
                <option value="ALL">Todos</option>
                <option value="PLAYERS">Participantes</option>
                <option value="WAITLIST">Waitlist</option>
              </select>
            </div>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              className="min-h-[96px] rounded-lg border border-white/15 bg-black/30 px-2 py-2"
              placeholder="Mensagem para enviar"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={sendBroadcast}
                disabled={broadcastBusy}
                className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:border-white/40 disabled:opacity-50"
              >
                {broadcastBusy ? "A enviar..." : "Enviar mensagem"}
              </button>
              {broadcastResult && <span className="text-[11px] text-emerald-200">{broadcastResult}</span>}
              {broadcastError && <span className="text-[11px] text-rose-200">{broadcastError}</span>}
            </div>
          </div>
          <p className="text-[11px] text-white/50">Auto-guardado. Valores &gt;= 0.</p>
        </div>
      )}

      {tab === "duplas" && (
        <div className="space-y-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[12px] text-white/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Matchmaking por categoria</p>
                <p className="text-[12px] text-white/70">
                  Fila ativa e duplas formadas para a categoria selecionada.
                </p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                Fila {matchmakingQueue.length} · Formadas {matchmakingFormed.length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Fila</p>
                {matchmakingQueue.length === 0 ? (
                  <p className="mt-2 text-[12px] text-white/60">Sem espera ativa.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {matchmakingQueue.slice(0, 5).map((pairing) => (
                      <div key={`queue-${pairing.id}`} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="font-semibold text-white">{nameFromSlots(pairing, locale)}</span>
                        <span className="text-white/60">
                          {resolvePairingStatusLabel(pairing, locale)} · {resolvePaymentModeLabel(pairing.paymentMode, locale)}
                        </span>
                      </div>
                    ))}
                    {matchmakingQueue.length > 5 && (
                      <p className="text-[11px] text-white/50">+{matchmakingQueue.length - 5} em fila</p>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Duplas formadas</p>
                {matchmakingFormed.length === 0 ? (
                  <p className="mt-2 text-[12px] text-white/60">Sem duplas formadas ainda.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {matchmakingFormed.slice(0, 5).map((pairing) => (
                      <div key={`formed-${pairing.id}`} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="font-semibold text-white">{nameFromSlots(pairing, locale)}</span>
                        <span className="text-white/60">
                          {resolvePairingStatusLabel(pairing, locale)} · {resolvePaymentModeLabel(pairing.paymentMode, locale)}
                        </span>
                      </div>
                    ))}
                    {matchmakingFormed.length > 5 && (
                      <p className="text-[11px] text-white/50">
                        +{matchmakingFormed.length - 5} duplas formadas
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[12px] text-white/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Swap admin</p>
                <p className="text-[12px] text-white/70">Troca parceiros entre duas duplas (antes do pagamento).</p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] text-white/70">
                {swapCandidates.length} elegíveis
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={swapPairingAId}
                onChange={(e) => setSwapPairingAId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-[12px]"
              >
                <option value="">Dupla A</option>
                {swapCandidates.map((pairing) => (
                  <option key={`swap-a-${pairing.id}`} value={pairing.id}>
                    #{pairing.id} · {nameFromSlots(pairing, locale)}
                  </option>
                ))}
              </select>
              <select
                value={swapPairingBId}
                onChange={(e) => setSwapPairingBId(e.target.value)}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-[12px]"
              >
                <option value="">Dupla B</option>
                {swapCandidates.map((pairing) => (
                  <option key={`swap-b-${pairing.id}`} value={pairing.id}>
                    #{pairing.id} · {nameFromSlots(pairing, locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSwapPairings}
                disabled={!canSubmitSwap}
                className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:border-white/40 disabled:opacity-50"
              >
                {swapBusy ? "A trocar..." : "Trocar parceiros"}
              </button>
              {swapMessage && <span className="text-[11px] text-emerald-200">{swapMessage}</span>}
              {swapError && <span className="text-[11px] text-rose-200">{swapError}</span>}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[12px] text-white/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="uppercase tracking-[0.16em] text-[11px] text-white/60">Importar inscritos</span>
              <button
                type="button"
                onClick={downloadImportTemplate}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                Modelo CSV
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null);
                  resetImportFeedback();
                }}
                className="text-[11px] text-white/70"
              />
              <button
                type="button"
                onClick={() => submitImport("preview")}
                disabled={!importFile || importMode !== null}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
              >
                {importMode === "preview" ? "A validar..." : "Validar"}
              </button>
              <button
                type="button"
                onClick={() => submitImport("import")}
                disabled={!importFile || importMode !== null}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
              >
                {importMode === "import" ? "A importar..." : "Importar"}
              </button>
            </div>
            <p className="text-[11px] text-white/60">
              Campos: categoria, player1_name, player2_name, emails, seed, group, payment_mode, payment_status.
            </p>
            {importSummary && (
              <p className="text-[11px] text-white/70">
                Linhas {importSummary.totalRows} · Válidas {importSummary.validRows} · Erros {importSummary.errorRows}
              </p>
            )}
            {importPreview?.categories && (
              <p className="text-[11px] text-white/60">
                Categorias:{" "}
                {Object.entries(importPreview.categories)
                  .map(([key, count]) => `${categoryLabelById.get(key) ?? `Categoria ${key}`}: ${count}`)
                  .join(" · ")}
              </p>
            )}
            {importMessage && <p className="text-[11px] text-white/70">{importMessage}</p>}
            {importErrors.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-[11px] text-white/70">
                {importErrors.map((err, idx) => (
                  <p key={`import-err-${err.row}-${idx}`}>
                    Linha {err.row}
                    {err.field ? ` · ${err.field}` : ""}: {err.message}
                  </p>
                ))}
              </div>
            )}
          </div>
          {filteredPairings.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
              <span className="uppercase tracking-[0.16em] text-[11px] text-white/60">Seeds</span>
              <button
                type="button"
                onClick={generateSeedsFromRanking}
                disabled={!isAdminRole || seedingBusy}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
                title={!isAdminRole ? "Sem permissões para gerar seeds." : undefined}
              >
                {seedingBusy ? "A gerar..." : "Gerar do ranking"}
              </button>
            </div>
          )}
          {filteredPairings.length === 0 && <p className="text-sm text-white/70">Ainda não há duplas.</p>}
          {filteredPairings.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm flex items-center justify-between">
              <div>
                <p className="font-semibold">{nameFromSlots(p, locale)}</p>
                <p className="text-[11px] text-white/60">
                  {resolvePairingStatusLabel(p, locale)} · {resolvePaymentModeLabel(p.paymentMode, locale)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-[11px] text-white/70">
                  Seed
                  <input
                    type="number"
                    min={1}
                    defaultValue={seedRanks[String(p.id)] ?? ""}
                    className="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px]"
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) {
                        saveSeedRank(p.id, null);
                        return;
                      }
                      const parsed = Number(raw);
                      if (!Number.isFinite(parsed) || parsed <= 0) {
                        e.target.value = "";
                        return;
                      }
                      saveSeedRank(p.id, parsed);
                    }}
                  />
                </label>
                {groupMode === "MANUAL" && (
                  <label className="flex items-center gap-2 text-[11px] text-white/70">
                    Grupo
                    <select
                      value={manualAssignments[String(p.id)] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        const next = { ...manualAssignments };
                        if (value) {
                          next[String(p.id)] = value;
                        } else {
                          delete next[String(p.id)];
                        }
                        saveGroupsConfig({ manualAssignments: next });
                      }}
                      className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px]"
                    >
                      <option value="">Auto</option>
                      {groupLabels.map((label) => (
                        <option key={`group-${label}`} value={label}>
                          Grupo {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {p.inviteToken && (
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${window.location.origin}/eventos/${eventSlug}?inviteToken=${p.inviteToken}`,
                      )
                    }
                    className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10"
                  >
                    Copiar convite
                  </button>
                )}
              </div>
            </div>
          ))}
          {waitlistItems.length > 0 && (
            <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Lista de espera</p>
                <button
                  type="button"
                  onClick={promoteWaitlist}
                  className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
                >
                  Promover próximo
                </button>
              </div>
              {waitlistItems.map((item: any) => (
                <div key={`wait-${item.id}`} className="flex items-center justify-between gap-2 text-[12px]">
                  <span>
                    {item.user?.fullName || item.user?.username || "Jogador"} ·{" "}
                    {item.category?.label || "Categoria"}
                  </span>
                  <span className="text-white/60">{resolveWaitlistStatusLabel(item.status, locale)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "grupos" && (
        <div className="space-y-3">
          {standingsGroups.length > 0 ? (
            <div className="grid gap-3">
              {standingsGroups.map(([groupLabel, rows]) => (
                <div key={`standings-${groupLabel}`} className="rounded-xl border border-white/12 bg-white/5 p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">
                      {supportsGroups
                        ? `Classificações · Grupo ${groupLabel || "?"}`
                        : `Classificações · ${groupLabel || "Geral"}`}
                    </p>
                    <span className="text-[11px] text-white/50">{rows.length} entradas</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((row, index) => {
                      const pairing = typeof row.pairingId === "number" ? (pairingsById.get(row.pairingId) ?? null) : null;
                      const setDiff = row.setsFor - row.setsAgainst;
                      return (
                        <div key={`stand-${row.entityId}`} className="flex items-center justify-between gap-2 text-[12px]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/50">#{index + 1}</span>
                            <span className="font-semibold text-white">
                              {row.label || (pairing ? nameFromSlots(pairing, locale) : `Jogador #${row.entityId}`)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/60">
                            <span>{row.points} pts</span>
                            <span>{row.wins}V-{row.losses}D</span>
                            <span>Sets {row.setsFor}-{row.setsAgainst}</span>
                            <span>{setDiff >= 0 ? `+${setDiff}` : setDiff}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/12 bg-white/5 p-3 text-[12px] text-white/70">
              Sem classificações calculadas ainda para {groupsTabLabel.toLowerCase()}.
            </div>
          )}
          {primaryRoundMatches.length === 0 && <p className="text-sm text-white/70">Sem jogos nesta fase.</p>}
          {primaryRoundMatches.length > 0 && filteredPrimaryRoundMatches.length === 0 && (
            <p className="text-sm text-white/70">Sem jogos para o filtro operacional selecionado.</p>
          )}
          {filteredPrimaryRoundMatches.length > 0 && filteredPrimaryRoundMatches.length < primaryRoundMatches.length && (
            <p className="text-[11px] text-white/60">
              A mostrar {filteredPrimaryRoundMatches.length} de {primaryRoundMatches.length} jogo(s) em {groupsTabLabel.toLowerCase()}.
            </p>
          )}
          {filteredPrimaryRoundMatches.map((m) => (
              <div key={m.id} className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] text-white/70">
                      {supportsGroups
                        ? `Grupo ${m.groupLabel || "?"}`
                        : m.roundLabel || (isNonStopFormat ? `Ronda ${m.groupLabel || "NS"}` : `Ronda ${m.groupLabel || "A"}`)}
                    </span>
                    <p className="font-semibold">{nameFromSlots(m.pairingA as Pairing, locale)} vs {nameFromSlots(m.pairingB as Pairing, locale)}</p>
                  </div>
                  <span className="text-[11px] text-white/60">{formatMatchStatusLabel(m.status)}</span>
                </div>
                <p className="text-[12px] text-white/70">Resultado: {formatScoreLabel(m)}</p>
                {renderResultControls(m)}
              </div>
            ))}
        </div>
      )}

      {tab === "eliminatorias" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Gerar eliminatórias</p>
              <p className="text-[12px] text-white/70">
                {supportsKnockout
                  ? "Gera o quadro eliminatório a partir das classificações."
                  : `Formato atual: ${formatLabel(generationFormat)}. Não usa eliminatórias.`}
              </p>
              {supportsKnockout && groupMissing > 0 && (
                <p className="text-[11px] text-amber-200">
                  Faltam {groupMissing} jogo{groupMissing === 1 ? "" : "s"} de grupos. Só Dono/Co-dono pode forçar.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => generateMatches("KNOCKOUT")}
              disabled={!canGenerateKnockout || generationBusy !== null}
              title={!isAdminRole ? "Sem permissões para gerar jogos." : undefined}
              className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-60"
            >
              {generationBusy === "KNOCKOUT" ? "A gerar..." : "Gerar eliminatórias"}
            </button>
          </div>
          {generationPhase === "KNOCKOUT" && generationError && (
            <p className="text-[12px] text-red-200">{generationError}</p>
          )}
          {generationPhase === "KNOCKOUT" && generationError && renderGenerationPlanPanel()}
          {generationPhase === "KNOCKOUT" && generationMessage && (
            <p className="text-[12px] text-emerald-200">{generationMessage}</p>
          )}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
            <span className="uppercase tracking-[0.16em] text-[11px] text-white/60">Gestão do quadro</span>
            <button
              type="button"
              onClick={() => setKoEditMode((prev) => !prev)}
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
            >
              {koEditMode ? "Fechar edição" : "Editar quadro"}
            </button>
          </div>
          {koEditMode && (
            <p className="text-[11px] text-white/60">
              Edição manual só antes dos jogos começarem. Duplas devem estar completas e confirmadas.
            </p>
          )}
          {koEditMessage && <p className="text-[11px] text-white/70">{koEditMessage}</p>}
          {koRounds.length === 0 && <p className="text-sm text-white/70">Sem eliminatórias.</p>}
          {koRounds.length > 0 && koVisibleMatchesCount === 0 && liveOpsFilter !== "ALL" && (
            <p className="text-sm text-white/70">Sem jogos de eliminatórias para o filtro operacional selecionado.</p>
          )}
          {koGeneratedAt && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 space-y-1">
              <p>Quadro: {formatDate(koGeneratedAt)}.</p>
              {koOverride && <p className="text-amber-200">Override: grupos incompletos.</p>}
              {koManual && (
                <p className="text-amber-200">
                  Override manual{koManualAt ? `: ${formatDate(koManualAt)}.` : "."}
                </p>
              )}
              {koSeedSnapshot.length > 0 && (
                <div className="space-y-1 text-white/70">
                  {koSeedSnapshot.map((q) => (
                    <div key={`${q.groupLabel}-${q.rank}-${q.pairingId}`} className="flex items-center justify-between gap-2">
                      <span>
                        {q.rank}º {q.groupLabel}
                        {q.isExtra ? " (extra)" : ""} — {pairingNameById.get(q.pairingId) ?? `Dupla ${q.pairingId}`}
                      </span>
                      <span className="text-white/50">
                        Pts {q.points ?? "—"} · SetΔ {q.setDiff ?? "—"} · GameΔ {q.gameDiff ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {championName && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-[12px] text-emerald-50 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-200">Vencedor</span>
              <span className="text-sm font-semibold">{championName}</span>
            </div>
          )}
          {koRounds.length > 0 && koVisibleMatchesCount > 0 && liveOpsFilter !== "ALL" && (
            <p className="text-[11px] text-white/60">A mostrar {koVisibleMatchesCount} jogo(s) de eliminatórias em {liveOpsFilterLabel}.</p>
          )}
          {koRounds.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex min-w-full gap-4 pb-2">
                {koRounds.map(([roundKey, games], roundIdx) => {
                  const visibleGames =
                    liveOpsFilter === "ALL"
                      ? games
                      : games.filter((game) => {
                          const fullMatch = matchById.get(game.id);
                          return fullMatch ? doesMatchPassLiveOpsFilter(fullMatch, liveOpsFilter) : false;
                        });
                  if (visibleGames.length === 0 && liveOpsFilter !== "ALL") return null;
                  const isLast = roundIdx === koRounds.length - 1;
                  return (
                  <div
                    key={roundKey}
                    className="relative min-w-[220px] rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-[#0a0f1f]/60 to-[#05070f]/70 p-3 space-y-2 shadow-[0_15px_35px_rgba(0,0,0,0.35)]"
                  >
                    {!isLast && <div className="absolute top-3 right-[-12px] h-[90%] w-px bg-white/10 hidden lg:block" />}
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">
                      {formatRoundLabel(roundKey)}
                    </p>
                    {visibleGames.map((g) => {
                      const fullMatch = matchById.get(g.id);
                      const roundLabel = fullMatch?.roundLabel || roundKey;
                      const used = koUsedByRound.get(roundLabel) ?? new Set();
                      const draft = fullMatch ? getKoDraft(fullMatch) : null;
                      const available = fullMatch
                        ? confirmedPairings.filter((p) => {
                            const currentA = fullMatch.pairingA?.id ?? fullMatch.pairingAId ?? null;
                            const currentB = fullMatch.pairingB?.id ?? fullMatch.pairingBId ?? null;
                            return !used.has(p.id) || p.id === currentA || p.id === currentB;
                          })
                        : [];
                      const availableA = draft
                        ? available.filter((p) => p.id !== (draft.pairingBId ?? null))
                        : [];
                      const availableB = draft
                        ? available.filter((p) => p.id !== (draft.pairingAId ?? null))
                        : [];
                      const hasChanges = fullMatch && draft ? hasKoDraftChanges(fullMatch, draft) : false;

                      return (
                        <div
                          key={g.id}
                          className="rounded-xl border border-white/15 bg-black/40 p-2 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[12px] text-white">
                            <span className={`font-semibold ${g.winner === "A" ? "text-emerald-300" : ""}`}>{g.teamA}</span>
                            <span className="text-white/60">{g.status}</span>
                          </div>
                          <div className="flex items-center justify-between text-[12px] text-white">
                            <span className={`font-semibold ${g.winner === "B" ? "text-emerald-300" : ""}`}>{g.teamB}</span>
                            <span className="text-white/60">{g.score}</span>
                          </div>
                          {koEditMode && fullMatch && draft && (
                            <div className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-2 text-[11px] text-white/70">
                              <div className="grid gap-2">
                                <label className="flex flex-col gap-1">
                                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">Equipa A</span>
                                  <select
                                    value={draft.pairingAId ?? ""}
                                    onChange={(e) => {
                                      const next = e.target.value ? Number(e.target.value) : null;
                                      updateKoDraft(fullMatch, { pairingAId: next });
                                    }}
                                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px]"
                                  >
                                    <option value="">—</option>
                                    {availableA.map((p) => (
                                      <option key={`ko-a-${g.id}-${p.id}`} value={p.id}>
                                        {pairingNameById.get(p.id) ?? `Dupla ${p.id}`}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                  <span className="text-[10px] uppercase tracking-[0.16em] text-white/50">Equipa B</span>
                                  <select
                                    value={draft.pairingBId ?? ""}
                                    onChange={(e) => {
                                      const next = e.target.value ? Number(e.target.value) : null;
                                      updateKoDraft(fullMatch, { pairingBId: next });
                                    }}
                                    className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[11px]"
                                  >
                                    <option value="">—</option>
                                    {availableB.map((p) => (
                                      <option key={`ko-b-${g.id}-${p.id}`} value={p.id}>
                                        {pairingNameById.get(p.id) ?? `Dupla ${p.id}`}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <button
                                type="button"
                                disabled={!hasChanges || koSaving[fullMatch.id]}
                                onClick={() => saveKoAssignment(fullMatch)}
                                className="w-full rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
                              >
                                {koSaving[fullMatch.id] ? "A guardar..." : "Guardar quadro"}
                              </button>
                            </div>
                          )}
                          {fullMatch ? renderResultControls(fullMatch) : null}
                        </div>
                      );
                    })}
                  </div>
                );
                })}
              </div>
            </div>
          )}
        </div>
      )}

        </section>
      }
    />
  );
}
