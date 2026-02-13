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
    keyPrefix: "padel_widget_next",
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
      timezone: true,
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
    where: {
      eventId: event.id,
      OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: {
      court: { select: { name: true } },
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
    take: 8,
  });

  const items = matches.map((m) => ({
    id: m.id,
    startAt: (m.plannedStartAt ?? m.startTime)?.toISOString() ?? null,
    court: m.court?.name || m.courtName || m.courtNumber || m.courtId || null,
    teamA:
      m.pairingA?.slots
        ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
        .filter((name): name is string => Boolean(name))
        .join(" / ") || "",
    teamB:
      m.pairingB?.slots
        ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
        .filter((name): name is string => Boolean(name))
        .join(" / ") || "",
    status: m.status,
  }));

  return respondOk(
    ctx,
    { event: { id: event.id, slug: event.slug, title: event.title, timezone: event.timezone }, items },
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
