export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolvePadelMatchStats } from "@/domain/padel/score";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const DEFAULT_LIMIT = 50;
const ATTENTION_STATUS_FILTER = ["IN_PROGRESS", "RESULT_SUBMITTED", "PENDING_CONFIRMATION", "PENDING_REVIEW_EXPIRED", "DISPUTED"] as const;
const SCOPES = new Set(["all", "upcoming", "past", "attention"]);

type PadelMeMatchesScope = "all" | "upcoming" | "past" | "attention";

const clampLimit = (raw: string | null) => {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 200);
};

const resolveScope = (raw: string | null): PadelMeMatchesScope => {
  const normalized = (raw || "all").toLowerCase();
  if (!SCOPES.has(normalized)) return "all";
  return normalized as PadelMeMatchesScope;
};

const STATUS_FILTER_ALLOWLIST = new Set([
  "PENDING",
  "IN_PROGRESS",
  "RESULT_SUBMITTED",
  "PENDING_CONFIRMATION",
  "PENDING_REVIEW_EXPIRED",
  "DISPUTED",
  "OFFICIAL",
  "WALKOVER",
  "RETIRED",
  "CANCELLED",
]);

const parseStatusFilters = (raw: string | null) => {
  if (!raw) return [];
  const values = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);
  const deduped: string[] = [];
  values.forEach((value) => {
    if (!STATUS_FILTER_ALLOWLIST.has(value) || deduped.includes(value)) return;
    deduped.push(value);
  });
  return deduped;
};

const parseCategoryId = (raw: string | null) => {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const parseEventId = (raw: string | null) => {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const parseBooleanFlag = (raw: string | null) =>
  raw === "1" || raw === "true" || raw === "yes" || raw === "on";

const FINAL_STATUSES = new Set(["OFFICIAL", "WALKOVER", "RETIRED", "CANCELLED"]);
const REVIEW_LOCKED_STATUSES = new Set(["PENDING_CONFIRMATION", "PENDING_REVIEW_EXPIRED", "DISPUTED"]);
const ATTENTION_STATUSES = new Set(["PENDING_CONFIRMATION", "PENDING_REVIEW_EXPIRED", "DISPUTED"]);

const emptySummary = () => ({
  total: 0,
  actionable: 0,
  liveNow: 0,
  pendingConfirmation: 0,
  pendingReviewExpired: 0,
  disputed: 0,
  official: 0,
  requiresAttention: 0,
  awaitingConfirmation: 0,
  reviewExpired: 0,
  byStatus: {} as Record<string, number>,
});

const resolveAttentionReason = (params: {
  status: string | null;
  playerCanSubmitResult: boolean;
  pendingConfirmationMsRemaining: number | null;
}) => {
  if (params.playerCanSubmitResult) return "SUBMIT_RESULT" as const;
  if (params.status === "PENDING_CONFIRMATION") {
    if (typeof params.pendingConfirmationMsRemaining === "number" && params.pendingConfirmationMsRemaining <= 0) {
      return "CONFIRMATION_EXPIRED" as const;
    }
    return "AWAITING_CONFIRMATION" as const;
  }
  if (params.status === "PENDING_REVIEW_EXPIRED") return "REVIEW_EXPIRED" as const;
  if (params.status === "DISPUTED") return "DISPUTED" as const;
  if (params.status === "IN_PROGRESS") return "MATCH_LIVE" as const;
  return null;
};

const formatStatusLabel = (status: string | null) => {
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
      return status ?? "—";
  }
};

const formatScoreLabel = (params: {
  status: string | null;
  scoreSets: Array<{ teamA: number; teamB: number }> | null;
  score: Record<string, unknown> | null;
}) => {
  if (params.scoreSets?.length) {
    return params.scoreSets.map((set) => `${set.teamA}-${set.teamB}`).join(", ");
  }
  const score = params.score ?? {};
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
  if (params.status === "DISPUTED") return "Em disputa";
  if (params.status === "PENDING_CONFIRMATION") return "Pendente confirmação";
  if (params.status === "PENDING_REVIEW_EXPIRED") return "Pendente expirado";
  return "—";
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const scope = resolveScope(req.nextUrl.searchParams.get("scope"));
  const limit = clampLimit(req.nextUrl.searchParams.get("limit"));
  const statusFilters = parseStatusFilters(req.nextUrl.searchParams.get("status"));
  const categoryId = parseCategoryId(req.nextUrl.searchParams.get("categoryId"));
  const eventId = parseEventId(req.nextUrl.searchParams.get("eventId"));
  const attentionOnly = parseBooleanFlag(req.nextUrl.searchParams.get("attentionOnly"));
  const requireAttentionItems = attentionOnly || scope === "attention";
  const now = new Date();

  const pairings = await prisma.padelPairing.findMany({
    where: {
      OR: [
        { createdByUserId: user.id },
        { player1UserId: user.id },
        { player2UserId: user.id },
        { slots: { some: { profileId: user.id } } },
        { slots: { some: { invitedUserId: user.id } } },
      ],
    },
    select: { id: true },
  });

  const pairingIds = pairings.map((p) => p.id);
  if (pairingIds.length === 0) {
    return jsonWrap(
      {
        ok: true,
        items: [],
        summary: emptySummary(),
        filters: {
          scope,
          limit,
          categoryId,
          eventId,
          status: statusFilters,
          attentionOnly: requireAttentionItems,
        },
      },
      { status: 200 },
    );
  }

  const participantFilter = {
    participants: {
      some: {
        participant: {
          sourcePairingId: { in: pairingIds },
        },
      },
    },
  };
  const where: Record<string, any> = participantFilter;
  if (scope === "past") {
    where.status = { in: ["OFFICIAL", "WALKOVER", "RETIRED"] };
  } else if (scope === "upcoming") {
    where.status = { notIn: ["OFFICIAL", "WALKOVER", "RETIRED", "CANCELLED"] };
    where.AND = [
      participantFilter,
      {
        OR: [
          { startTime: { gte: now } },
          { plannedStartAt: { gte: now } },
          { startTime: null, plannedStartAt: null },
        ],
      },
    ];
  }
  if (statusFilters.length > 0) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { status: { in: statusFilters } }];
  } else if (scope === "attention" || attentionOnly) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), { status: { in: [...ATTENTION_STATUS_FILTER] } }];
  }
  if (categoryId) {
    where.categoryId = categoryId;
  }
  if (eventId) {
    where.eventId = eventId;
  }

  const queryTake = requireAttentionItems ? Math.min(limit * 3, 400) : limit;

  const matches = await prisma.eventMatchSlot.findMany({
    where,
    select: {
      id: true,
      eventId: true,
      categoryId: true,
      status: true,
      startTime: true,
      plannedStartAt: true,
      plannedEndAt: true,
      score: true,
      scoreSets: true,
      courtName: true,
      participants: {
        select: {
          side: true,
          participant: {
            select: {
              sourcePairingId: true,
            },
          },
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
          endsAt: true,
          coverImageUrl: true,
          padelTournamentConfig: {
            select: {
              playerResultSubmissionEnabled: true,
              resultValidationMode: true,
            },
          },
        },
      },
      category: { select: { id: true, label: true } },
    },
    orderBy: [{ startTime: "asc" }, { plannedStartAt: "asc" }, { id: "asc" }],
    take: queryTake,
  });

  const items = matches.map((match) => {
    const pairingSide = (() => {
      const hasA = match.participants.some(
        (row) => row.side === "A" && typeof row.participant?.sourcePairingId === "number" && pairingIds.includes(row.participant.sourcePairingId),
      );
      if (hasA) return "A" as const;
      const hasB = match.participants.some(
        (row) => row.side === "B" && typeof row.participant?.sourcePairingId === "number" && pairingIds.includes(row.participant.sourcePairingId),
      );
      if (hasB) return "B" as const;
      return null;
    })();
    const stats = resolvePadelMatchStats(match.scoreSets ?? null, match.score ?? null);
    const winnerSide = stats?.winner ?? null;
    const rawStatus = typeof match.status === "string" ? match.status : null;
    const scoreObject = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : null;
    const workflow =
      scoreObject?.liveWorkflow && typeof scoreObject.liveWorkflow === "object" && !Array.isArray(scoreObject.liveWorkflow)
        ? (scoreObject.liveWorkflow as Record<string, unknown>)
        : null;
    const pendingConfirmationExpiresAt =
      workflow && typeof workflow.pendingConfirmationExpiresAt === "string" ? workflow.pendingConfirmationExpiresAt : null;
    const pendingConfirmationExpiresAtDate = pendingConfirmationExpiresAt ? new Date(pendingConfirmationExpiresAt) : null;
    const pendingConfirmationMsRemaining =
      pendingConfirmationExpiresAtDate && Number.isFinite(pendingConfirmationExpiresAtDate.getTime())
        ? pendingConfirmationExpiresAtDate.getTime() - now.getTime()
        : null;
    const playerSubmissionEnabled = match.event?.padelTournamentConfig?.playerResultSubmissionEnabled === true;
    const playerCanSubmitResult =
      playerSubmissionEnabled &&
      !(rawStatus && FINAL_STATUSES.has(rawStatus)) &&
      !(rawStatus && REVIEW_LOCKED_STATUSES.has(rawStatus));
    const attentionReason = resolveAttentionReason({
      status: rawStatus,
      playerCanSubmitResult,
      pendingConfirmationMsRemaining,
    });
    const requiresAttention =
      playerCanSubmitResult || (rawStatus ? ATTENTION_STATUSES.has(rawStatus) : false) || rawStatus === "IN_PROGRESS";
    return {
      id: match.id,
      status: rawStatus,
      statusLabel: formatStatusLabel(rawStatus),
      startTime: match.startTime ?? null,
      plannedStartAt: match.plannedStartAt ?? null,
      plannedEndAt: match.plannedEndAt ?? null,
      courtName: match.courtName ?? null,
      pairingSide,
      winnerSide,
      isWinner: pairingSide ? pairingSide === winnerSide : null,
      scoreSets: match.scoreSets ?? null,
      score: scoreObject ?? null,
      scoreLabel: formatScoreLabel({
        status: rawStatus,
        scoreSets: (match.scoreSets as Array<{ teamA: number; teamB: number }> | null) ?? null,
        score: scoreObject,
      }),
      playerCanSubmitResult,
      playerSubmissionEnabled,
      resultValidationMode:
        match.event?.padelTournamentConfig?.resultValidationMode === "IMMEDIATE_PENDING_THEN_OFFICIAL"
          ? "IMMEDIATE_PENDING_THEN_OFFICIAL"
          : "IMMEDIATE_OFFICIAL",
      pendingConfirmationExpiresAt,
      pendingConfirmationMsRemaining,
      isLiveNow: rawStatus === "IN_PROGRESS",
      requiresAttention,
      attentionReason,
      event: match.event
        ? {
            id: match.event.id,
            title: match.event.title,
            slug: match.event.slug,
            startsAt: match.event.startsAt,
            endsAt: match.event.endsAt,
            coverImageUrl: match.event.coverImageUrl ?? null,
          }
        : null,
      category: match.category ? { id: match.category.id, label: match.category.label ?? null } : null,
    };
  });

  const effectiveItems = (requireAttentionItems ? items.filter((item) => item.requiresAttention) : items).slice(0, limit);

  const summary = effectiveItems.reduce(
    (acc, item) => {
      const status = typeof item.status === "string" ? item.status : "UNKNOWN";
      acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
      if (item.playerCanSubmitResult === true) acc.actionable += 1;
      if (status === "IN_PROGRESS") acc.liveNow += 1;
      if (status === "PENDING_CONFIRMATION") acc.pendingConfirmation += 1;
      if (status === "PENDING_REVIEW_EXPIRED") acc.pendingReviewExpired += 1;
      if (status === "DISPUTED") acc.disputed += 1;
      if (status === "OFFICIAL" || status === "WALKOVER" || status === "RETIRED") acc.official += 1;
      if (item.requiresAttention) acc.requiresAttention += 1;
      if (item.attentionReason === "AWAITING_CONFIRMATION" || item.attentionReason === "CONFIRMATION_EXPIRED") {
        acc.awaitingConfirmation += 1;
      }
      if (item.attentionReason === "REVIEW_EXPIRED") acc.reviewExpired += 1;
      return acc;
    },
    {
      ...emptySummary(),
      total: effectiveItems.length,
    },
  );

  return jsonWrap(
    {
      ok: true,
      items: effectiveItems,
      summary,
      filters: {
        scope,
        limit,
        categoryId,
        eventId,
        status: statusFilters,
        attentionOnly: requireAttentionItems,
      },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
