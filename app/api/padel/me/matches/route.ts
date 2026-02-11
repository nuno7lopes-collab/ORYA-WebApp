export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolvePadelMatchStats } from "@/domain/padel/score";

const DEFAULT_LIMIT = 50;
const clampLimit = (raw: string | null) => {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 200);
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const scope = (req.nextUrl.searchParams.get("scope") || "all").toLowerCase();
  const limit = clampLimit(req.nextUrl.searchParams.get("limit"));
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
    return jsonWrap({ ok: true, items: [] }, { status: 200 });
  }

  const pairingFilter = { OR: [{ pairingAId: { in: pairingIds } }, { pairingBId: { in: pairingIds } }] };
  const where: Record<string, any> = pairingFilter;
  if (scope === "past") {
    where.status = "DONE";
  } else if (scope === "upcoming") {
    where.status = { not: "DONE" };
    where.AND = [
      pairingFilter,
      {
        OR: [
          { startTime: { gte: now } },
          { plannedStartAt: { gte: now } },
          { startTime: null, plannedStartAt: null },
        ],
      },
    ];
  }

  const matches = await prisma.eventMatchSlot.findMany({
    where,
    select: {
      id: true,
      eventId: true,
      categoryId: true,
      pairingAId: true,
      pairingBId: true,
      status: true,
      startTime: true,
      plannedStartAt: true,
      plannedEndAt: true,
      score: true,
      scoreSets: true,
      courtName: true,
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
          endsAt: true,
          coverImageUrl: true,
        },
      },
      category: { select: { id: true, label: true } },
    },
    orderBy: [{ startTime: "asc" }, { plannedStartAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  const items = matches.map((match) => {
    const pairingSide =
      match.pairingAId && pairingIds.includes(match.pairingAId)
        ? "A"
        : match.pairingBId && pairingIds.includes(match.pairingBId)
          ? "B"
          : null;
    const stats = resolvePadelMatchStats(match.scoreSets ?? null, match.score ?? null);
    const winnerSide = stats?.winner ?? null;
    return {
      id: match.id,
      status: match.status ?? null,
      startTime: match.startTime ?? null,
      plannedStartAt: match.plannedStartAt ?? null,
      plannedEndAt: match.plannedEndAt ?? null,
      courtName: match.courtName ?? null,
      pairingSide,
      winnerSide,
      isWinner: pairingSide ? pairingSide === winnerSide : null,
      scoreSets: match.scoreSets ?? null,
      score: match.score ?? null,
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

  return jsonWrap({ ok: true, items }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
