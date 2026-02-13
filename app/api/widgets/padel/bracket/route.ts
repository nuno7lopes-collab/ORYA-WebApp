export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { isWidgetsEnabled } from "@/lib/featureFlags";

type MatchRow = {
  id: number;
  status: string;
  score: string;
  teamA: string;
  teamB: string;
};

const pairingLabel = (slots?: Array<{ playerProfile?: { displayName?: string | null; fullName?: string | null } | null }>) => {
  const names =
    slots
      ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
      .filter((name): name is string => Boolean(name)) ?? [];
  return names.length > 0 ? names.slice(0, 2).join(" / ") : "";
};

const formatScore = (scoreSets?: unknown, scoreRaw?: Record<string, unknown> | null) => {
  const sets = Array.isArray(scoreSets) ? (scoreSets as Array<{ teamA: number; teamB: number }>) : [];
  if (sets.length > 0) {
    return sets.map((s) => `${s.teamA}-${s.teamB}`).join(" · ");
  }
  const rawSets = Array.isArray(scoreRaw?.sets) ? (scoreRaw?.sets as Array<{ teamA: number; teamB: number }>) : [];
  if (rawSets.length > 0) {
    return rawSets.map((s) => `${s.teamA}-${s.teamB}`).join(" · ");
  }
  return "—";
};

const parseRoundMeta = (label: string) => {
  const prefix = label.startsWith("A ") ? "A " : label.startsWith("B ") ? "B " : "";
  const base = prefix ? label.slice(2) : label;
  let size: number | null = null;
  if (base.startsWith("R")) {
    const parsed = Number(base.slice(1));
    size = Number.isFinite(parsed) ? parsed : null;
  }
  if (size === null) {
    if (base === "QUARTERFINAL") size = 8;
    if (base === "SEMIFINAL") size = 4;
    if (base === "FINAL") size = 2;
  }
  return { prefix, size };
};

function fail(
  ctx: RequestContext,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  if (!isWidgetsEnabled()) {
    return fail(ctx, 403, "Widgets desativados.");
  }
  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  if (!eventId && !slug) {
    return fail(ctx, 400, "EVENT_REQUIRED");
  }

  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_widget_bracket",
    identifier: eventId ? String(eventId) : slug,
  });
  if (rateLimited) return rateLimited;

  const event = await prisma.event.findUnique({
    where: eventId ? { id: eventId, isDeleted: false } : { slug: slug!, isDeleted: false },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      padelTournamentConfig: { select: { advancedSettings: true, lifecycleStatus: true } },
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: { mode: true },
      },
    },
  });
  if (!event) return fail(ctx, 404, "EVENT_NOT_FOUND");

  const accessMode = resolveEventAccessMode(event.accessPolicies?.[0]);
  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
    lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
  });
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";
  if (!isPublicEvent) {
    return fail(ctx, 403, "FORBIDDEN");
  }

  const matches = await prisma.eventMatchSlot.findMany({
    where: { eventId: event.id, roundType: "KNOCKOUT" },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
  });

  const roundsMap = new Map<string, MatchRow[]>();
  matches.forEach((m) => {
    const label = m.roundLabel || "Bracket";
    if (!roundsMap.has(label)) roundsMap.set(label, []);
    const scoreObj = m.score && typeof m.score === "object" ? (m.score as Record<string, unknown>) : null;
    roundsMap.get(label)!.push({
      id: m.id,
      status: m.status,
      score: formatScore(m.scoreSets, scoreObj),
      teamA: pairingLabel(m.pairingA?.slots),
      teamB: pairingLabel(m.pairingB?.slots),
    });
  });

  const rounds = Array.from(roundsMap.entries())
    .sort((a, b) => {
      const aMeta = parseRoundMeta(a[0]);
      const bMeta = parseRoundMeta(b[0]);
      if (aMeta.prefix !== bMeta.prefix) return aMeta.prefix.localeCompare(bMeta.prefix);
      if (aMeta.size && bMeta.size && aMeta.size !== bMeta.size) return bMeta.size - aMeta.size;
      return a[0].localeCompare(b[0]);
    })
    .map(([label, items]) => ({ label, matches: items }));

  return respondOk(
    ctx,
    { event: { id: event.id, slug: event.slug, title: event.title }, rounds },
    { status: 200 },
  );
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

export const GET = withApiEnvelope(_GET);
