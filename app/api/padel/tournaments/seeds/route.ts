export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const categoryId = typeof body.categoryId === "number" ? body.categoryId : Number(body.categoryId);
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true, padelTournamentConfig: { select: { advancedSettings: true } } },
  });
  if (!event?.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  if (!event.padelTournamentConfig) return NextResponse.json({ ok: false, error: "NO_TOURNAMENT" }, { status: 404 });

  const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};
  const pairings = await prisma.padelPairing.findMany({
    where: {
      eventId,
      pairingStatus: "COMPLETE",
      ...matchCategoryFilter,
    },
    select: { id: true, createdAt: true, slots: { select: { playerProfileId: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (pairings.length === 0) {
    return NextResponse.json({ ok: false, error: "NO_PAIRINGS" }, { status: 400 });
  }

  const playerIds = Array.from(
    new Set(
      pairings
        .flatMap((p) => p.slots)
        .map((s) => s.playerProfileId)
        .filter(Boolean) as number[],
    ),
  );

  const rankingEntries = playerIds.length
    ? await prisma.padelRankingEntry.findMany({
        where: { organizationId: event.organizationId, playerId: { in: playerIds } },
        select: { playerId: true, points: true },
      })
    : [];

  const pointsByPlayer = new Map<number, number>();
  rankingEntries.forEach((entry) => {
    const total = pointsByPlayer.get(entry.playerId) ?? 0;
    pointsByPlayer.set(entry.playerId, total + (entry.points ?? 0));
  });

  const pairingScores = pairings.map((pairing) => {
    const playerPoints = pairing.slots.reduce((acc, slot) => {
      if (!slot.playerProfileId) return acc;
      return acc + (pointsByPlayer.get(slot.playerProfileId) ?? 0);
    }, 0);
    return {
      id: pairing.id,
      createdAt: pairing.createdAt,
      points: playerPoints,
    };
  });

  pairingScores.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const advanced = (event.padelTournamentConfig.advancedSettings as Record<string, unknown>) ?? {};
  const existingSeedRanks =
    advanced.seedRanks && typeof advanced.seedRanks === "object" ? (advanced.seedRanks as Record<string, number>) : {};
  const nextSeedRanks = { ...existingSeedRanks };
  pairingScores.forEach((row, idx) => {
    nextSeedRanks[String(row.id)] = idx + 1;
  });

  await prisma.padelTournamentConfig.update({
    where: { eventId },
    data: {
      advancedSettings: {
        ...advanced,
        seedRanks: nextSeedRanks,
      },
    },
  });

  await recordOrganizationAuditSafe({
    organizationId: event.organizationId,
    actorUserId: user.id,
    action: "PADEL_SEEDS_GENERATED",
    metadata: {
      eventId,
      categoryId: Number.isFinite(categoryId) ? categoryId : null,
      pairings: pairings.length,
      playersRanked: rankingEntries.length,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      pairings: pairings.length,
      playersRanked: rankingEntries.length,
    },
    { status: 200 },
  );
}
