export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";

export async function GET(req: NextRequest) {
  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  if (!eventId && !slug) {
    return NextResponse.json({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
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
      title: true,
      status: true,
      publicAccessMode: true,
      inviteOnly: true,
      timezone: true,
      padelTournamentConfig: { select: { advancedSettings: true } },
    },
  });
  if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
  });
  const isPublicEvent =
    event.publicAccessMode !== "INVITE" &&
    !event.inviteOnly &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";
  if (!isPublicEvent) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const matches = await prisma.padelMatch.findMany({
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

  return NextResponse.json(
    { ok: true, event: { id: event.id, title: event.title, timezone: event.timezone }, items },
    { status: 200 },
  );
}
