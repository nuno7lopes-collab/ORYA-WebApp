export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { PadelPointsTable } from "@/lib/padel/validation";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export async function GET(req: NextRequest) {
  const organizerId = req.nextUrl.searchParams.get("organizerId");
  const eventId = req.nextUrl.searchParams.get("eventId");

  if (eventId) {
    const eId = Number(eventId);
    if (!Number.isFinite(eId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

    const entries = await prisma.padelRankingEntry.findMany({
      where: { eventId: eId },
      include: { player: true },
      orderBy: [{ points: "desc" }],
    });
    const items = entries.map((row, idx) => ({
      position: idx + 1,
      points: row.points,
      player: {
        id: row.player.id,
        fullName: row.player.fullName,
        level: row.player.level,
      },
    }));
    return NextResponse.json({ ok: true, items }, { status: 200 });
  }

  if (!organizerId) {
    return NextResponse.json({ ok: false, error: "MISSING_ORGANIZER" }, { status: 400 });
  }
  const oId = Number(organizerId);
  if (!Number.isFinite(oId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ORGANIZER" }, { status: 400 });
  }

  const entries = await prisma.padelRankingEntry.findMany({
    where: { organizerId: oId },
    include: { player: true },
  });

  const aggregated = Object.values(
    entries.reduce<Record<number, { player: any; points: number }>>((acc, row) => {
      const key = row.playerId;
      if (!acc[key]) acc[key] = { player: row.player, points: 0 };
      acc[key].points += row.points;
      return acc;
    }, {}),
  ).sort((a, b) => b.points - a.points);

  const items = aggregated.map((item, idx) => ({
    position: idx + 1,
    points: item.points,
    player: {
      id: item.player.id,
      fullName: item.player.fullName,
      level: item.player.level,
    },
  }));

  return NextResponse.json({ ok: true, items }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizerId: true },
  });
  if (!event || !event.organizerId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { ruleSetId: true },
  });
  const ruleSet = config?.ruleSetId
    ? await prisma.padelRuleSet.findUnique({ where: { id: config.ruleSetId } })
    : null;
  const pointsTable: PadelPointsTable = (ruleSet?.pointsTable as any) || { WIN: 3, LOSS: 0 };

  const matches = await prisma.padelMatch.findMany({
    where: { eventId, status: "DONE" },
    include: {
      pairingA: { select: { slots: { select: { playerProfileId: true, profileId: true } } } },
      pairingB: { select: { slots: { select: { playerProfileId: true, profileId: true } } } },
    },
  });

  const profileIds = new Set<string>();
  matches.forEach((m) => {
    [m.pairingA, m.pairingB].forEach((pairing) => {
      pairing?.slots.forEach((slot) => {
        if (!slot.playerProfileId && slot.profileId) profileIds.add(slot.profileId);
      });
    });
  });

  const playerProfiles = profileIds.size
    ? await prisma.padelPlayerProfile.findMany({
        where: { organizerId: event.organizerId!, userId: { in: Array.from(profileIds) } },
        select: { id: true, userId: true },
      })
    : [];
  const profileToPlayerProfile = new Map<string, number>();
  playerProfiles.forEach((row) => {
    if (row.userId) profileToPlayerProfile.set(row.userId, row.id);
  });

  const playerPoints: Record<number, number> = {};
  const winPts = pointsTable.WIN ?? 3;
  const lossPts = pointsTable.LOSS ?? 0;

  const resolvePlayerId = (slot: { playerProfileId: number | null; profileId: string | null }) => {
    if (slot.playerProfileId) return slot.playerProfileId;
    if (slot.profileId) return profileToPlayerProfile.get(slot.profileId) ?? null;
    return null;
  };

  matches.forEach((m) => {
    const rawSets = Array.isArray(m.scoreSets)
      ? m.scoreSets
      : Array.isArray((m.score as { sets?: unknown } | null)?.sets)
        ? ((m.score as { sets?: unknown }).sets as any[])
        : [];
    if (!rawSets.length) return;
    let aSets = 0;
    let bSets = 0;
    rawSets.forEach((s) => {
      const set = s as { teamA?: number; teamB?: number };
      if (!Number.isFinite(set.teamA) || !Number.isFinite(set.teamB)) return;
      if (Number(set.teamA) > Number(set.teamB)) aSets += 1;
      else if (Number(set.teamB) > Number(set.teamA)) bSets += 1;
    });
    if (aSets === bSets) return;
    const winner = aSets > bSets ? "A" : "B";
    const winnerPairing = winner === "A" ? m.pairingA : m.pairingB;
    const loserPairing = winner === "A" ? m.pairingB : m.pairingA;

    const award = (pairing: typeof m.pairingA, pts: number) => {
      pairing?.slots.forEach((slot) => {
        const playerId = resolvePlayerId(slot);
        if (!playerId) return;
        playerPoints[playerId] = (playerPoints[playerId] ?? 0) + pts;
      });
    };

    award(winnerPairing, winPts);
    award(loserPairing, lossPts);
  });

  await prisma.$transaction(async (tx) => {
    await tx.padelRankingEntry.deleteMany({ where: { eventId } });
    const entries = Object.entries(playerPoints).map(([playerIdStr, points]) => ({
      organizerId: event.organizerId!,
      eventId,
      playerId: Number(playerIdStr),
      points,
      position: null,
    }));
    if (entries.length > 0) {
      await tx.padelRankingEntry.createMany({ data: entries });
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
