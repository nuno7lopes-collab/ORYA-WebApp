export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, padel_match_status, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { isValidScore } from "@/lib/padel/validation";
import {
  queueMatchChanged,
  queueMatchResult,
  queueNextOpponent,
} from "@/domain/notifications/tournament";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

function sortRoundsBySize(matches: Array<{ roundLabel: string | null }>) {
  const counts = matches.reduce<Record<string, number>>((acc, m) => {
    const key = m.roundLabel || "?";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!event?.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: allowedRoles,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const matches = await prisma.padelMatch.findMany({
    where: { eventId, ...matchCategoryFilter },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [
      { roundType: "asc" },
      { groupLabel: "asc" },
      { startTime: "asc" },
      { id: "asc" },
    ],
  });

  return NextResponse.json({ ok: true, items: matches }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const matchId = typeof body.id === "number" ? body.id : Number(body.id);
  const statusRaw =
    typeof body.status === "string" && Object.values(padel_match_status).includes(body.status as padel_match_status)
      ? (body.status as padel_match_status)
      : undefined;
  const scoreRaw = body.score;
  const startAtRaw = body.startAt ? new Date(String(body.startAt)) : undefined;
  const courtIdRaw = typeof body.courtId === "number" ? body.courtId : undefined;

  if (!Number.isFinite(matchId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  if (startAtRaw && Number.isNaN(startAtRaw.getTime())) {
    return NextResponse.json({ ok: false, error: "INVALID_START_AT" }, { status: 400 });
  }

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    include: { event: { select: { organizationId: true } } },
  });
  if (!match || !match.event?.organizationId) return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: match.event.organizationId,
    roles: allowedRoles,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  if (scoreRaw && !isValidScore(scoreRaw)) {
    return NextResponse.json({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }

  let winnerPairingId: number | null = null;
  if (scoreRaw && typeof scoreRaw === "object" && "sets" in (scoreRaw as { sets?: unknown })) {
    const rawSets = (scoreRaw as { sets?: unknown }).sets;
    const sets = Array.isArray(rawSets) ? rawSets : [];
    let winsA = 0;
    let winsB = 0;
    sets.forEach((s) => {
      const set = s as { teamA?: number; teamB?: number };
      if (Number.isFinite(set.teamA) && Number.isFinite(set.teamB)) {
        const a = Number(set.teamA);
        const b = Number(set.teamB);
        if (a > b) winsA += 1;
        else if (b > a) winsB += 1;
      }
    });
    if (winsA > winsB && match.pairingAId) winnerPairingId = match.pairingAId;
    if (winsB > winsA && match.pairingBId) winnerPairingId = match.pairingBId;
  }

  const scoreValue = (scoreRaw ?? match.score) as Prisma.InputJsonValue;
  const scoreSetsValue =
    typeof scoreRaw === "object" && scoreRaw && "sets" in (scoreRaw as { sets?: unknown })
      ? ((scoreRaw as { sets?: unknown }).sets as Prisma.InputJsonValue)
      : (match.scoreSets as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined);

  const updated = await prisma.padelMatch.update({
    where: { id: matchId },
    data: {
      status: statusRaw ?? match.status,
      score: scoreValue,
      scoreSets: scoreSetsValue,
      winnerPairingId: winnerPairingId ?? match.winnerPairingId,
      startTime: startAtRaw ?? match.startTime,
      courtNumber: courtIdRaw ?? match.courtNumber,
    },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
  });

  const involvedUserIds = [
    ...((updated.pairingA?.slots ?? []).map((s) => s.profileId).filter(Boolean) as string[]),
    ...((updated.pairingB?.slots ?? []).map((s) => s.profileId).filter(Boolean) as string[]),
  ];

  // Notificações: mudança de horário/court
  await queueMatchChanged({
    userIds: involvedUserIds,
    matchId: updated.id,
    startAt: updated.startTime ?? null,
    courtId: updated.courtNumber ?? null,
  });

  // Notificações de resultado + próximo adversário
  if (winnerPairingId) {
    await queueMatchResult(involvedUserIds, updated.id, updated.eventId);
    await queueNextOpponent(involvedUserIds, updated.id, updated.eventId);

    // Auto-avanço de vencedores no bracket (baseado em ordem dos jogos por ronda)
    if (updated.roundType === "KNOCKOUT") {
      const koMatches = await prisma.padelMatch.findMany({
        where: {
          eventId: updated.eventId,
          roundType: "KNOCKOUT",
          ...(updated.categoryId ? { categoryId: updated.categoryId } : {}),
        },
        select: { id: true, roundLabel: true, pairingAId: true, pairingBId: true, winnerPairingId: true },
        orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
      });
      const roundOrder = sortRoundsBySize(koMatches).map(([label]) => label);
      const roundsMap = new Map<string, Array<typeof koMatches[number]>>();
      roundOrder.forEach((label) => {
        roundsMap.set(
          label,
          koMatches.filter((m) => (m.roundLabel || "?") === label),
        );
      });

      const advance = async (fromMatchId: number, winner: number) => {
        const fromMatch = koMatches.find((m) => m.id === fromMatchId);
        if (!fromMatch) return;
        const currentRound = fromMatch.roundLabel || roundOrder[0] || null;
        if (!currentRound) return;
        const currentIdx = roundOrder.findIndex((l) => l === currentRound);
        if (currentIdx === -1 || currentIdx >= roundOrder.length - 1) return;
        const currentMatches = roundsMap.get(currentRound) || [];
        const nextRoundLabel = roundOrder[currentIdx + 1];
        const nextMatches = roundsMap.get(nextRoundLabel) || [];
        const currentPos = currentMatches.findIndex((m) => m.id === fromMatchId);
        if (currentPos === -1) return;
        const targetIdx = Math.floor(currentPos / 2);
        const target = nextMatches[targetIdx];
        if (!target) return;
        const updateTarget: Record<string, unknown> = {};
        if (currentPos % 2 === 0) {
          if (!target.pairingAId) updateTarget.pairingAId = winner;
          else if (!target.pairingBId) updateTarget.pairingBId = winner;
        } else {
          if (!target.pairingBId) updateTarget.pairingBId = winner;
          else if (!target.pairingAId) updateTarget.pairingAId = winner;
        }
        if (Object.keys(updateTarget).length > 0) {
          const targetUpdated = await prisma.padelMatch.update({
            where: { id: target.id },
            data: updateTarget,
          });
          // atualizar caches locais
          target.pairingAId = targetUpdated.pairingAId;
          target.pairingBId = targetUpdated.pairingBId;
          // BYE: auto-avançar
          if (
            (targetUpdated.pairingAId && !targetUpdated.pairingBId) ||
            (!targetUpdated.pairingAId && targetUpdated.pairingBId)
          ) {
            const autoWinner = targetUpdated.pairingAId ?? targetUpdated.pairingBId!;
            const autoDone = await prisma.padelMatch.update({
              where: { id: targetUpdated.id },
              data: { winnerPairingId: autoWinner, status: "DONE" },
            });
            target.winnerPairingId = autoDone.winnerPairingId;
            target.pairingAId = autoDone.pairingAId;
            target.pairingBId = autoDone.pairingBId;
            await advance(target.id, autoWinner);
          }
        }
      };

      await advance(updated.id, winnerPairingId);
    }
  }

  return NextResponse.json({ ok: true, match: updated }, { status: 200 });
}
