"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDateTime } from "@/lib/i18n";
import useSWR from "swr";
import { DEFAULT_PADEL_SCORE_RULES, type PadelScoreRules } from "@/domain/padel/score";

type Pairing = {
  id: number;
  pairingStatus: string;
  lifecycleStatus?: string | null;
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
};

type Standings = Record<string, Array<{ pairingId: number; points: number; wins: number; losses: number; setsFor: number; setsAgainst: number }>>;
type CategoryMeta = { name?: string; categoryId?: number | null; capacity?: number | null; registrationType?: string | null };
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
    description: "Aceita qualquer score (modo legacy)",
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

function nameFromSlots(pairing?: Pairing | null) {
  if (!pairing) return "—";
  const names = pairing.slots
    .map((s) => s.playerProfile?.displayName || s.playerProfile?.fullName)
    .filter(Boolean) as string[];
  return names.length ? names.join(" / ") : "Dupla incompleta";
}

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

export default function PadelTournamentTabs({
  eventId,
  eventSlug,
  categoriesMeta,
}: {
  eventId: number;
  eventSlug: string;
  categoriesMeta?: CategoryMeta[];
}) {
  const [tab, setTab] = useState<"duplas" | "grupos" | "eliminatorias">("duplas");
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [widgetBase, setWidgetBase] = useState("");
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
  const [koEdits, setKoEdits] = useState<Record<number, { pairingAId: number | null; pairingBId: number | null }>>({});
  const [koSaving, setKoSaving] = useState<Record<number, boolean>>({});
  const [disputeBusy, setDisputeBusy] = useState<Record<number, boolean>>({});
  const [disputeError, setDisputeError] = useState<Record<number, string | null>>({});
  const categoryOptions = useMemo(
    () =>
      (categoriesMeta || [])
        .filter((c) => Number.isFinite(c.categoryId as number))
        .map((c) => ({
          id: c.categoryId as number,
          label: c.name || `Categoria ${c.categoryId}`,
        })),
    [categoriesMeta],
  );
  const categoryLabelById = useMemo(
    () => new Map(categoryOptions.map((opt) => [String(opt.id), opt.label])),
    [categoryOptions],
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  useEffect(() => {
    if (categoryOptions.length === 0) {
      if (selectedCategoryId !== null) setSelectedCategoryId(null);
      return;
    }
    if (selectedCategoryId && categoryOptions.some((c) => c.id === selectedCategoryId)) return;
    setSelectedCategoryId(categoryOptions[0].id ?? null);
  }, [categoryOptions, selectedCategoryId]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWidgetBase(window.location.origin);
    }
  }, []);
  useEffect(() => {
    setGenerationMessage(null);
    setGenerationError(null);
    setGenerationPhase(null);
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
    eventId ? `/api/organizacao/padel/waitlist?eventId=${eventId}${categoryParam}` : null,
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
    orgIdForMe ? `/api/organizacao/me?organizationId=${orgIdForMe}` : null,
    fetcher,
  );
  const { data: analyticsRes } = useSWR(
    eventId ? `/api/organizacao/padel/analytics?eventId=${eventId}` : null,
    fetcher,
  );
  const { data: auditRes } = useSWR(
    eventId ? `/api/organizacao/padel/audit?eventId=${eventId}&limit=25&actionPrefix=PADEL_` : null,
    fetcher,
  );

  const pairings: Pairing[] = pairingsRes?.pairings ?? [];
  const matches: Match[] = Array.isArray(matchesRes?.items) ? (matchesRes.items as Match[]) : emptyMatches;
  const standings: Standings = standingsRes?.standings ?? {};
  const pairingsById = useMemo(() => new Map(pairings.map((pairing) => [pairing.id, pairing])), [pairings]);
  const standingsGroups = useMemo(() => {
    const entries = Object.entries(standings);
    return entries.sort((a, b) => a[0].localeCompare(b[0], "pt-PT", { numeric: true }));
  }, [standings]);
  const waitlistItems = Array.isArray(waitlistRes?.items) ? (waitlistRes.items as Array<any>) : [];
  const advanced = (configRes?.config?.advancedSettings || {}) as Record<string, any>;
  const ruleSets = Array.isArray(ruleSetsRes?.items) ? (ruleSetsRes.items as PadelRuleSetSummary[]) : [];
  const activeRuleSet = configRes?.config?.ruleSet as PadelRuleSetSummary | undefined;
  const analytics = analyticsRes?.ok ? analyticsRes : null;
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
  const autoGeneratedMessage =
    autoGeneratedAt && !autoGeneratedBy
      ? `Bracket gerado automaticamente em ${new Date(autoGeneratedAt).toLocaleString("pt-PT")}.`
      : null;
  const generationFormat = formatRequested || formatEffective || configRes?.config?.format || "GRUPOS_ELIMINATORIAS";
  const supportsGroups = generationFormat === "GRUPOS_ELIMINATORIAS";
  const supportsKnockout = ["GRUPOS_ELIMINATORIAS", "QUADRO_ELIMINATORIO", "QUADRO_AB", "DUPLA_ELIMINACAO"].includes(
    generationFormat,
  );

  useEffect(() => {
    setTvFooterText(tvMonitor.footerText ?? "");
    setTvSponsors((tvMonitor.sponsors ?? []).join("\n"));
  }, [tvMonitor.footerText, tvMonitor.sponsors]);

  const pairingNameById = useMemo(() => {
    const map = new Map<number, string>();
    pairings.forEach((p) => map.set(p.id, nameFromSlots(p)));
    return map;
  }, [pairings]);

  const filteredPairings = selectedCategoryId
    ? pairings.filter((p) => p.categoryId === selectedCategoryId)
    : pairings;
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

  const categoryStats = (() => {
    const metaMap = new Map<number | null, CategoryMeta>();
    (categoriesMeta || []).forEach((m) => {
      const key = Number.isFinite(m.categoryId as number) ? (m.categoryId as number) : null;
      metaMap.set(key, m);
    });
    const counts = new Map<number | null, number>();
    pairings.forEach((p) => {
      const key = Number.isFinite(p.categoryId as number) ? (p.categoryId as number) : null;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const rows: Array<{ key: number | null; label: string; count: number; capacity: number | null }> = [];
    const keys = new Set([...counts.keys(), ...metaMap.keys()]);
    keys.forEach((key) => {
      const meta = metaMap.get(key);
      const label = meta?.name || (key === null ? "Categoria" : `Categoria ${key}`);
      const capacity = meta?.capacity ?? null;
      rows.push({ key, label, count: counts.get(key) || 0, capacity });
    });
    return rows;
  })();

  const matchesSummary = {
    pending: matches.filter((m) => m.status === "PENDING").length,
    live: matches.filter((m) => m.status === "IN_PROGRESS" || m.status === "LIVE").length,
    done: matches.filter((m) => m.status === "DONE").length,
  };
  const groupMatchesCount = matches.filter((m) => m.roundType === "GROUPS").length;
  const groupMatchesDone = matches.filter((m) => m.roundType === "GROUPS" && m.status === "DONE").length;
  const groupMissing = Math.max(0, groupMatchesCount - groupMatchesDone);
  const canGenerateGroups = isAdminRole && supportsGroups;
  const canGenerateKnockout = isAdminRole && supportsKnockout && (groupMissing === 0 || isOwnerRole);

  const [resultDrafts, setResultDrafts] = useState<
    Record<
      number,
      {
        scoreText: string;
        resultType: "NORMAL" | "WALKOVER" | "RETIREMENT" | "INJURY";
        winnerSide: "" | "A" | "B";
        photoUrl: string | null;
        streamUrl: string;
        saving?: boolean;
        uploading?: boolean;
        error?: string | null;
      }
    >
  >({});

  const getScoreText = (m: Match) =>
    m.scoreSets?.length ? m.scoreSets.map((s) => `${s.teamA}-${s.teamB}`).join(", ") : "";
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
  const getStreamUrl = (m: Match) => {
    const score = (m.score || {}) as Record<string, unknown>;
    return typeof score.liveStreamUrl === "string" ? score.liveStreamUrl : "";
  };

  useEffect(() => {
    setResultDrafts((prev) => {
      const next = { ...prev };
      const existingIds = new Set<number>();
      matches.forEach((m) => {
        existingIds.add(m.id);
        const shouldRefresh = !next[m.id] || (!next[m.id].saving && !next[m.id].uploading);
        if (shouldRefresh) {
          next[m.id] = {
            scoreText: getScoreText(m),
            resultType: getResultType(m),
            winnerSide: getWinnerSide(m),
            photoUrl: getPhotoUrl(m),
            streamUrl: getStreamUrl(m),
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
  }, [matches]);

  const updateResultDraft = (
    matchId: number,
    patch: Partial<{
      scoreText: string;
      resultType: "NORMAL" | "WALKOVER" | "RETIREMENT" | "INJURY";
      winnerSide: "" | "A" | "B";
      photoUrl: string | null;
      streamUrl: string;
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

  function formatScoreLabel(match: Match) {
    const dispute = getDisputeInfo(match);
    if (dispute.status === "OPEN") return "Em disputa";
    const score = (match.score || {}) as Record<string, unknown>;
    if (score.delayStatus === "DELAYED") return "Atrasado";
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

  const resolveGenerationError = (value?: string | null) => {
    if (!value) return "Não foi possível gerar os jogos.";
    const code = value.toUpperCase();
    switch (code) {
      case "OVERRIDE_NOT_ALLOWED":
        return "Só o owner/co-owner pode gerar eliminatórias com grupos incompletos.";
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
      case "GENERATION_FAILED":
        return "Falha ao gerar jogos. Verifica inscrições e configuração.";
      default:
        return value;
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
      setConfigMessage(`Template "${template.label}" aplicado.`);
      mutateConfig();
      setTimeout(() => setConfigMessage(null), 2000);
    } else {
      setConfigMessage("Erro ao aplicar template.");
      setTimeout(() => setConfigMessage(null), 2500);
    }
  }

  async function generateMatches(phase: "GROUPS" | "KNOCKOUT") {
    if (!eventId) return;
    if (!isAdminRole) {
      setGenerationPhase(phase);
      setGenerationError("Sem permissões para gerar jogos.");
      return;
    }
    if (phase === "GROUPS" && !supportsGroups) {
      setGenerationPhase(phase);
      setGenerationError(`Formato atual: ${formatLabel(generationFormat)}. Não usa grupos.`);
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
        setGenerationError("Só o owner/co-owner pode forçar eliminatórias com grupos incompletos.");
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
    try {
      const res = await fetch("/api/padel/matches/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setGenerationError(resolveGenerationError(json?.error));
        return;
      }
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
    a.download = "padel_import_template.csv";
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
      const res = await fetch("/api/organizacao/padel/imports/inscritos", {
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

  async function promoteWaitlist() {
    if (!eventId) return;
    setConfigMessage(null);
    const res = await fetch(`/api/organizacao/padel/waitlist/promote`, {
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
        setConfigMessage(json?.error || "Erro ao gerar seeds.");
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

    const resultType = draft.resultType ?? "NORMAL";
    if (resultType === "NORMAL" && sets.length === 0) {
      updateResultDraft(matchId, { error: "Indica o resultado (ex: 6-3, 6-4)." });
      return;
    }
    if (resultType !== "NORMAL" && draft.winnerSide !== "A" && draft.winnerSide !== "B") {
      updateResultDraft(matchId, { error: "Seleciona o vencedor (A ou B)." });
      return;
    }

    updateResultDraft(matchId, { saving: true, error: null });
    const score: Record<string, unknown> = {
      resultType,
      ...(sets.length > 0 ? { sets } : {}),
      ...(draft.winnerSide ? { winnerSide: draft.winnerSide } : {}),
      ...(draft.photoUrl ? { photoUrl: draft.photoUrl } : {}),
      ...(draft.streamUrl ? { liveStreamUrl: draft.streamUrl.trim() } : {}),
    };

    const res = await fetch(`/api/padel/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: matchId, status: "DONE", score }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const error =
        data?.error === "MATCH_DISPUTED"
          ? "Jogo em disputa. Apenas ADMIN pode editar."
          : data?.error === "INVALID_SCORE"
            ? "Resultado inválido. Confirma sets e regras."
            : "Erro ao guardar resultado.";
      updateResultDraft(matchId, { saving: false, error });
      return;
    }
    mutateMatches();
    updateResultDraft(matchId, { saving: false });
  }

  async function saveLiveScore(matchId: number) {
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

    updateResultDraft(matchId, { saving: true, error: null });
    const score: Record<string, unknown> = {
      ...(sets.length > 0 ? { sets } : {}),
      ...(draft.photoUrl ? { photoUrl: draft.photoUrl } : {}),
      ...(draft.streamUrl ? { liveStreamUrl: draft.streamUrl.trim() } : {}),
    };

    const res = await fetch(`/api/padel/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: matchId, status: "IN_PROGRESS", score }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const error =
        data?.error === "MATCH_DISPUTED"
          ? "Jogo em disputa. Apenas ADMIN pode editar."
          : data?.error === "INVALID_SCORE"
            ? "Score inválido. Ajusta o parcial."
            : "Erro ao guardar score.";
      updateResultDraft(matchId, { saving: false, error });
      return;
    }
    mutateMatches();
    updateResultDraft(matchId, { saving: false });
  }

  async function saveStreamLink(matchId: number) {
    const draft = resultDrafts[matchId];
    if (!draft) return;
    updateResultDraft(matchId, { saving: true, error: null });
    const score: Record<string, unknown> = {
      ...(draft.photoUrl ? { photoUrl: draft.photoUrl } : {}),
      ...(draft.streamUrl ? { liveStreamUrl: draft.streamUrl.trim() } : {}),
    };

    const res = await fetch(`/api/padel/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: matchId, score }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const error =
        data?.error === "MATCH_DISPUTED"
          ? "Jogo em disputa. Apenas ADMIN pode editar."
          : "Erro ao guardar stream.";
      updateResultDraft(matchId, { saving: false, error });
      return;
    }
    mutateMatches();
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
    setDisputeBusy((prev) => ({ ...prev, [matchId]: true }));
    setDisputeError((prev) => ({ ...prev, [matchId]: null }));
    try {
      const res = await fetch(`/api/padel/matches/${matchId}/dispute`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setDisputeError((prev) => ({
          ...prev,
          [matchId]: json?.error || "Erro ao resolver disputa.",
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
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload?scope=padel-match", {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        updateResultDraft(matchId, { uploading: false, error: json?.error || "Erro ao fazer upload." });
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
    const lockedByDispute = disputeOpen && !isAdminRole;
    const resolving = disputeBusy[m.id] === true;
    const disputeMsg = disputeError[m.id];
    return (
      <div className="space-y-2 text-[12px]">
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
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            placeholder="6-3, 6-4"
            value={draft.scoreText}
            onChange={(e) => updateResultDraft(m.id, { scoreText: e.target.value })}
            disabled={lockedByDispute}
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 disabled:opacity-60"
          />
          <select
            value={draft.resultType}
            onChange={(e) =>
              updateResultDraft(m.id, {
                resultType: e.target.value as "NORMAL" | "WALKOVER" | "RETIREMENT" | "INJURY",
                ...(e.target.value === "NORMAL" ? { winnerSide: "" } : {}),
              })
            }
            disabled={lockedByDispute}
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 disabled:opacity-60"
          >
            <option value="NORMAL">Resultado normal</option>
            <option value="WALKOVER">WO / Falta</option>
            <option value="RETIREMENT">Desistência</option>
            <option value="INJURY">Lesão</option>
          </select>
        </div>
        {draft.resultType !== "NORMAL" && (
          <select
            value={draft.winnerSide}
            onChange={(e) =>
              updateResultDraft(m.id, { winnerSide: e.target.value as "" | "A" | "B" })
            }
            disabled={lockedByDispute}
            className="w-full rounded-lg border border-white/15 bg-black/30 px-2 py-1 disabled:opacity-60"
          >
            <option value="">Seleciona vencedor</option>
            <option value="A">A · {nameFromSlots(m.pairingA)}</option>
            <option value="B">B · {nameFromSlots(m.pairingB)}</option>
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
              disabled={lockedByDispute}
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
        <label className="flex flex-col gap-1 text-[11px] text-white/70">
          <span className="text-white/60">Stream (opcional)</span>
          <input
            type="url"
            placeholder="https://youtube.com/..."
            value={draft.streamUrl}
            onChange={(e) => updateResultDraft(m.id, { streamUrl: e.target.value })}
            disabled={lockedByDispute}
            className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-[12px] disabled:opacity-60"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => saveLiveScore(m.id)}
            disabled={draft.saving || draft.uploading || lockedByDispute}
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            Guardar live
          </button>
          <button
            type="button"
            onClick={() => saveStreamLink(m.id)}
            disabled={draft.saving || draft.uploading || lockedByDispute}
            className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            Guardar stream
          </button>
          <button
            type="button"
            onClick={() => submitResult(m.id)}
            disabled={draft.saving || draft.uploading || lockedByDispute}
            className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black disabled:opacity-60"
          >
            {draft.saving ? "A guardar…" : "Guardar resultado"}
          </button>
          {draft.error && <span className="text-[11px] text-amber-200">{draft.error}</span>}
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4 mt-6">
      {categoryOptions.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/80">
          <span className="uppercase tracking-[0.18em] text-[11px] text-white/60">Categoria ativa</span>
          <select
            value={selectedCategoryId ?? ""}
            onChange={(e) => setSelectedCategoryId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[12px] text-white/80"
          >
            {categoryOptions.map((opt) => (
              <option key={`padel-cat-${opt.id}`} value={String(opt.id)}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Inscrições Padel</p>
          <p className="text-2xl font-semibold text-white">{pairings.length}</p>
          <p className="text-[12px] text-white/70">
            Completas: {pairings.filter((p) => p.pairingStatus === "COMPLETE").length} · Pendentes:{" "}
            {pairings.filter((p) => p.pairingStatus !== "COMPLETE").length}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Jogos</p>
          <p className="text-2xl font-semibold text-white">{matches.length}</p>
          <p className="text-[12px] text-white/70">
            Pendentes {matchesSummary.pending} · Live {matchesSummary.live} · Terminados {matchesSummary.done}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Categorias</p>
          <div className="space-y-1 text-[12px] text-white/75">
            {categoryStats.length === 0 && <p className="text-white/60">Sem categorias.</p>}
            {categoryStats.map((c) => {
              const occupancy = c.capacity ? Math.min(100, Math.round((c.count / c.capacity) * 100)) : null;
              return (
                <div key={`${c.key ?? "default"}`} className="flex items-center justify-between gap-2">
                  <span className="text-white">{c.label}</span>
                  <span className="text-white/70">
                    {c.count} equipa{c.count === 1 ? "" : "s"} {c.capacity ? `· ${occupancy}%` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {analytics && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Analitica avancada</p>
              <p className="text-white/70">
                Ocupacao {analytics.occupancy}% · Media {analytics.avgMatchMinutes} min · Atraso{" "}
                {analytics.avgDelayMinutes ?? 0} min · Courts {analytics.courts}
              </p>
              <p className="text-white/60 text-[11px]">
                Jogos {analytics.matches ?? matches.length} · Atrasados {analytics.delayedMatches ?? 0} · Janela{" "}
                {analytics.windowMinutes ?? 0} min
              </p>
            </div>
            <div className="text-right text-white/70">
              <p>Receita {formatCurrency(analytics.payments?.totalCents ?? 0, "EUR")}</p>
              <p>Taxa plataforma {formatCurrency(analytics.payments?.platformFeeCents ?? 0, "EUR")}</p>
              <p>Taxa Stripe {formatCurrency(analytics.payments?.stripeFeeCents ?? 0, "EUR")}</p>
              <p>Líquido {formatCurrency(analytics.payments?.netCents ?? 0, "EUR")}</p>
            </div>
          </div>
          {Array.isArray(analytics.courtsBreakdown) && analytics.courtsBreakdown.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {analytics.courtsBreakdown.slice(0, 6).map((court: any) => (
                <div key={`court-${court.courtId}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                    Court {court.name || court.courtId}
                  </p>
                  <p className="text-white/70">
                    {court.matches} jogos · {court.minutes} min · {court.occupancy}% ocupacao
                  </p>
                </div>
              ))}
            </div>
          )}
          {Array.isArray(analytics.phaseStats) && analytics.phaseStats.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">Fases</p>
              <div className="grid gap-2 md:grid-cols-3">
                {analytics.phaseStats.map((phase: any) => (
                  <div
                    key={`phase-${phase.phase}`}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">{phase.label}</p>
                    <p className="text-white/70">
                      {phase.matches} jogos · {phase.avgMatchMinutes} min · atraso {phase.avgDelayMinutes} min
                    </p>
                    <p className="text-[11px] text-white/60">Atrasados {phase.delayedMatches ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(analytics.courtDayBreakdown) && analytics.courtDayBreakdown.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">Ocupacao por court/dia</p>
              <div className="grid gap-2 md:grid-cols-2">
                {analytics.courtDayBreakdown.slice(0, 6).map((row: any) => (
                  <div
                    key={`court-day-${row.date}-${row.courtId}`}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                      {row.date} · Court {row.courtName || row.courtId}
                    </p>
                    <p className="text-white/70">
                      {row.matches} jogos · {row.minutes} min · {row.occupancy}% ocupacao
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          href={`/api/organizacao/padel/exports/inscritos?eventId=${eventId}&format=xlsx`}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Inscritos (Excel)
        </a>
        <a
          href={`/api/organizacao/padel/exports/resultados?eventId=${eventId}&format=xlsx`}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Resultados (Excel)
        </a>
        <a
          href={`/api/organizacao/padel/exports/bracket?eventId=${eventId}&format=pdf`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Bracket (PDF)
        </a>
        <a
          href={`/api/organizacao/padel/exports/bracket?eventId=${eventId}&format=html`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Bracket (Poster)
        </a>
        <a
          href={`/api/organizacao/padel/exports/calendario?eventId=${eventId}&format=pdf`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Calendário (PDF)
        </a>
        <a
          href={`/api/organizacao/padel/exports/analytics?eventId=${eventId}&format=xlsx`}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Analytics (Excel)
        </a>
        <a
          href={`/api/organizacao/padel/exports/analytics?eventId=${eventId}&format=csv`}
          className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
        >
          Analytics (CSV)
        </a>
      </section>
      {eventSlug && (
        <section
          id="padel-widgets"
          className="scroll-mt-24 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[12px] text-white/80 space-y-2"
        >
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Widgets</p>
          <p className="text-white/70">Usa estes iframes no site do clube.</p>
          <div className="grid gap-2 md:grid-cols-3">
            {[
              {
                label: "Próximos jogos",
                url: `${widgetBase}/widgets/padel/next?slug=${eventSlug}`,
              },
              {
                label: "Classificações",
                url: `${widgetBase}/widgets/padel/standings?eventId=${eventId}`,
              },
              {
                label: "Bracket",
                url: `${widgetBase}/widgets/padel/bracket?slug=${eventSlug}`,
              },
              {
                label: "Inscrições",
                url: `${widgetBase}/widgets/padel/inscricoes?slug=${eventSlug}`,
              },
              {
                label: "Calendário",
                url: `${widgetBase}/widgets/padel/calendar?slug=${eventSlug}`,
              },
            ].map((w) => (
              <label key={w.label} className="space-y-1 text-[11px] text-white/60">
                <span>{w.label}</span>
                <textarea
                  readOnly
                  className="min-h-[70px] w-full rounded-lg border border-white/15 bg-black/30 px-2 py-2 text-[11px] text-white/80"
                  value={`<iframe src=\"${w.url}\" style=\"width:100%;border:0;min-height:240px\"></iframe>`}
                />
              </label>
            ))}
          </div>
        </section>
      )}

      {formatRequested && formatEffective && formatRequested !== formatEffective && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-[12px] text-amber-50">
          Pedido: {formatLabel(formatRequested)}. Em uso: {formatLabel(formatEffective)} (Beta).
        </div>
      )}

      {(generationVersion || groupMissing > 0) && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px] text-white/80 flex items-center justify-between gap-3 flex-wrap">
          <span>Motor: {generationVersion ?? "v1-groups-ko"}</span>
          {groupMissing > 0 && (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-amber-100">
              Faltam {groupMissing} jogo{groupMissing === 1 ? "" : "s"} para fechar classificação.
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-[12px]">
        {[
          { key: "duplas", label: "Duplas" },
          { key: "grupos", label: "Grupos" },
          { key: "eliminatorias", label: "Eliminatórias" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`rounded-full px-3 py-1 border ${tab === t.key ? "bg-white text-black font-semibold" : "border-white/20 text-white/75"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "grupos" && (
        <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Configuração de grupos</p>
          {configMessage && <p className="text-[12px] text-white/70">{configMessage}</p>}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Gerar jogos</p>
              <p className="text-[12px] text-white/70">
                {supportsGroups
                  ? "Cria automaticamente os jogos de grupos para a categoria selecionada."
                  : `Formato atual: ${formatLabel(generationFormat)}. Não usa grupos.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => generateMatches("GROUPS")}
              disabled={!canGenerateGroups || generationBusy !== null}
              title={!isAdminRole ? "Sem permissões para gerar jogos." : undefined}
              className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:bg-white/10 disabled:opacity-60"
            >
              {generationBusy === "GROUPS" ? "A gerar..." : "Gerar jogos"}
            </button>
          </div>
          {generationPhase === "GROUPS" && generationError && (
            <p className="text-[12px] text-red-200">{generationError}</p>
          )}
          {generationPhase === "GROUPS" && generationMessage && (
            <p className="text-[12px] text-emerald-200">{generationMessage}</p>
          )}
          <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80 space-y-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Templates rápidos</p>
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
              <input
                type="datetime-local"
                defaultValue={toLocalInputValue(registrationStartsAt)}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                onBlur={(e) => {
                  const value = e.target.value ? new Date(e.target.value).toISOString() : null;
                  saveRegistrationWindow({ start: value, end: registrationEndsAt });
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-white/60">Fecho inscrições</span>
              <input
                type="datetime-local"
                defaultValue={toLocalInputValue(registrationEndsAt)}
                className="rounded-lg border border-white/15 bg-black/30 px-2 py-1"
                onBlur={(e) => {
                  const value = e.target.value ? new Date(e.target.value).toISOString() : null;
                  saveRegistrationWindow({ start: registrationStartsAt, end: value });
                }}
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
              {eventSlug && (
                <a
                  href={`/eventos/${eventSlug}/monitor`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/20 px-3 py-1 text-[12px] text-white/80 hover:border-white/40"
                >
                  Abrir monitor
                </a>
              )}
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
          <p className="text-[11px] text-white/50">Auto-guardado. Valores &gt;= 0.</p>
        </div>
      )}

      {tab === "duplas" && (
        <div className="space-y-2">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[12px] text-white/80 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="uppercase tracking-[0.16em] text-[11px] text-white/60">Importar inscritos</span>
              <button
                type="button"
                onClick={downloadImportTemplate}
                className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-white/80 hover:bg-white/10"
              >
                Template CSV
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
                <p className="font-semibold">{nameFromSlots(p)}</p>
                <p className="text-[11px] text-white/60">{p.pairingStatus} · {p.paymentMode}</p>
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
                  <span className="text-white/60">{item.status}</span>
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
                      Classificações · Grupo {groupLabel || "?"}
                    </p>
                    <span className="text-[11px] text-white/50">{rows.length} duplas</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((row, index) => {
                      const pairing = pairingsById.get(row.pairingId) ?? null;
                      const setDiff = row.setsFor - row.setsAgainst;
                      return (
                        <div key={`stand-${row.pairingId}`} className="flex items-center justify-between gap-2 text-[12px]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/50">#{index + 1}</span>
                            <span className="font-semibold text-white">{nameFromSlots(pairing)}</span>
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
              Sem classificações calculadas ainda.
            </div>
          )}
          {matches.filter((m) => m.roundType === "GROUPS").length === 0 && <p className="text-sm text-white/70">Sem jogos.</p>}
          {matches
            .filter((m) => m.roundType === "GROUPS")
            .map((m) => (
              <div key={m.id} className="rounded-xl border border-white/15 bg-white/5 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] text-white/70">
                      Grupo {m.groupLabel || "?"}
                    </span>
                    <p className="font-semibold">{nameFromSlots(m.pairingA as Pairing)} vs {nameFromSlots(m.pairingB as Pairing)}</p>
                  </div>
                  <span className="text-[11px] text-white/60">{m.status}</span>
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
                  Faltam {groupMissing} jogo{groupMissing === 1 ? "" : "s"} de grupos. Só owner/co-owner pode forçar.
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
          {koRounds.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex min-w-full gap-4 pb-2">
                {koRounds.map(([roundKey, games], roundIdx) => {
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
                    {games.map((g) => {
                      const fullMatch = matches.find((m) => m.id === g.id);
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
  );
}
