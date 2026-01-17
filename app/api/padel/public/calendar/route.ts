export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";

const formatDayKey = (date: Date, timezone: string) =>
  date.toLocaleDateString("en-CA", { timeZone: timezone });

const parseDay = (value: string | null) => {
  if (!value) return null;
  const day = new Date(value);
  return Number.isNaN(day.getTime()) ? null : day;
};

export async function GET(req: NextRequest) {
  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_public_calendar",
    max: 120,
  });
  if (rateLimited) return rateLimited;

  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  if (!eventId && !slug) {
    return NextResponse.json({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: eventId ? { id: eventId, isDeleted: false } : { slug: slug!, isDeleted: false },
    select: {
      id: true,
      title: true,
      status: true,
      publicAccessMode: true,
      inviteOnly: true,
      timezone: true,
      padelTournamentConfig: { select: { advancedSettings: true, padelClubId: true, partnerClubIds: true } },
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

  const filterDay = parseDay(req.nextUrl.searchParams.get("date"));
  const timezone = event.timezone || "Europe/Lisbon";

  const matches = await prisma.padelMatch.findMany({
    where: {
      eventId: event.id,
      OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
    },
    include: {
      court: { select: { id: true, name: true } },
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });

  const matchItems = matches
    .map((m) => {
      const startAt = m.plannedStartAt ?? m.startTime;
      if (!startAt) return null;
      const endAt =
        m.plannedEndAt ??
        (m.plannedDurationMinutes
          ? new Date(startAt.getTime() + m.plannedDurationMinutes * 60 * 1000)
          : null);
      const score = m.score && typeof m.score === "object" ? (m.score as Record<string, unknown>) : {};
      const delayStatus = typeof score.delayStatus === "string" ? score.delayStatus : null;
      const dayKey = formatDayKey(startAt, timezone);
      const teamA =
        m.pairingA?.slots
          ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
          .filter((name): name is string => Boolean(name))
          .join(" / ") || "";
      const teamB =
        m.pairingB?.slots
          ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || null)
          .filter((name): name is string => Boolean(name))
          .join(" / ") || "";
      return {
        id: m.id,
        startAt: startAt.toISOString(),
        endAt: endAt?.toISOString() ?? null,
        status: m.status,
        roundLabel: m.roundLabel ?? null,
        groupLabel: m.groupLabel ?? null,
        courtId: m.court?.id ?? m.courtId ?? null,
        courtLabel:
          m.court?.name || m.courtName || (m.courtNumber ? `Court ${m.courtNumber}` : null) || "Court",
        teamA,
        teamB,
        delayStatus,
        dayKey,
      };
    })
    .filter(Boolean) as Array<{
    id: number;
    startAt: string;
    endAt: string | null;
    status: string;
    roundLabel: string | null;
    groupLabel: string | null;
    courtId: number | null;
    courtLabel: string;
    teamA: string;
    teamB: string;
    delayStatus: string | null;
    dayKey: string;
  }>;

  const filteredMatches = filterDay
    ? matchItems.filter((m) => {
        const dayKey = formatDayKey(filterDay, timezone);
        return m.dayKey === dayKey;
      })
    : matchItems;

  const daysMap = new Map<
    string,
    Map<string, { courtId: number | null; courtLabel: string; matches: typeof filteredMatches }>
  >();

  filteredMatches.forEach((match) => {
    const courtKey = match.courtId ? `id:${match.courtId}` : `label:${match.courtLabel}`;
    if (!daysMap.has(match.dayKey)) daysMap.set(match.dayKey, new Map());
    const courtsMap = daysMap.get(match.dayKey)!;
    if (!courtsMap.has(courtKey)) {
      courtsMap.set(courtKey, {
        courtId: match.courtId,
        courtLabel: match.courtLabel,
        matches: [],
      });
    }
    courtsMap.get(courtKey)!.matches.push(match);
  });

  const days = Array.from(daysMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, courtsMap]) => ({
      date,
      courts: Array.from(courtsMap.values()).map((court) => ({
        courtId: court.courtId,
        courtLabel: court.courtLabel,
        matches: court.matches,
      })),
    }));

  return NextResponse.json(
    {
      ok: true,
      event: { id: event.id, title: event.title, timezone },
      days,
    },
    { status: 200 },
  );
}
