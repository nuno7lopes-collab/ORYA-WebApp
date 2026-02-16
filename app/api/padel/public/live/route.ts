export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildPadelLiveReadModel } from "@/domain/padel/liveReadModel";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";

async function _GET(req: NextRequest) {
  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_public_live",
    max: 180,
  });
  if (rateLimited) return rateLimited;

  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  if (!eventId && !slug) {
    return jsonWrap({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: eventId ? { id: eventId, isDeleted: false } : { slug: slug!, isDeleted: false },
    select: {
      id: true,
      status: true,
      padelTournamentConfig: {
        select: {
          advancedSettings: true,
          lifecycleStatus: true,
        },
      },
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: { mode: true },
      },
    },
  });

  if (!event) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
    lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
  });
  const accessMode = resolveEventAccessMode(event.accessPolicies?.[0]);
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";

  if (!isPublicEvent) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const live = await buildPadelLiveReadModel({
    eventId: event.id,
    visibility: "public",
  });
  if (!live) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  return jsonWrap({ ok: true, ...live }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
