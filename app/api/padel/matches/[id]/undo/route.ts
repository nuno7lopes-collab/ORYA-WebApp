export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { extractBracketPrefix, sortRoundsBySize } from "@/domain/padel/knockoutAdvance";
import { updatePadelMatch } from "@/domain/padel/matches/commands";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const UNDO_WINDOW_MS = 60 * 1000;
const SYSTEM_MATCH_EVENT = "PADEL_MATCH_SYSTEM_UPDATED";

const asObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const matchHasPairing = (match: { pairingAId: number | null; pairingBId: number | null }, pairingId: number) =>
  match.pairingAId === pairingId || match.pairingBId === pairingId;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const matchId = Number(resolved?.id);
  if (!Number.isFinite(matchId)) {
    return NextResponse.json({ ok: false, error: "INVALID_MATCH" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const eventIdBody =
    typeof body?.eventId === "number"
      ? body.eventId
      : typeof body?.eventId === "string"
        ? Number(body.eventId)
        : null;

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    include: { event: { select: { id: true, organizationId: true } } },
  });
  if (!match || !match.event?.organizationId) {
    return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }
  if (Number.isFinite(eventIdBody) && match.eventId !== eventIdBody) {
    return NextResponse.json({ ok: false, error: "EVENT_MISMATCH" }, { status: 409 });
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: match.event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const recentLogs = await prisma.organizationAuditLog.findMany({
    where: { organizationId: match.event.organizationId, action: "PADEL_MATCH_RESULT" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const targetLog = recentLogs.find((log) => {
    const meta = asObject(log.metadata);
    return meta?.matchId === matchId;
  });

  if (!targetLog) {
    return NextResponse.json({ ok: false, error: "UNDO_NOT_FOUND" }, { status: 404 });
  }

  if (!targetLog.createdAt || Date.now() - targetLog.createdAt.getTime() > UNDO_WINDOW_MS) {
    return NextResponse.json({ ok: false, error: "UNDO_EXPIRED" }, { status: 409 });
  }

  const metadata = asObject(targetLog.metadata);
  const before = asObject(metadata?.before);
  const after = asObject(metadata?.after);
  if (!before) {
    return NextResponse.json({ ok: false, error: "UNDO_INVALID" }, { status: 400 });
  }

  const winnerPairingId =
    typeof after?.winnerPairingId === "number"
      ? (after.winnerPairingId as number)
      : typeof match.winnerPairingId === "number"
        ? match.winnerPairingId
        : null;

  const updateDownstream: Array<{ id: number; clearA: boolean; clearB: boolean }> = [];
  if (match.roundType === "KNOCKOUT" && winnerPairingId) {
    const [config, koMatches] = await Promise.all([
      prisma.padelTournamentConfig.findUnique({
        where: { eventId: match.eventId },
        select: { format: true },
      }),
      prisma.padelMatch.findMany({
        where: {
          eventId: match.eventId,
          roundType: "KNOCKOUT",
          ...(match.categoryId ? { categoryId: match.categoryId } : {}),
        },
        select: {
          id: true,
          roundLabel: true,
          pairingAId: true,
          pairingBId: true,
          winnerPairingId: true,
          status: true,
        },
        orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
      }),
    ]);

    const prefix = extractBracketPrefix(match.roundLabel);
    const isDoubleElim = config?.format === "DUPLA_ELIMINACAO";
    const isGrandFinalLabel = (label?: string | null) => {
      if (!label) return false;
      const trimmed = label.trim();
      const base = trimmed.startsWith("A ") || trimmed.startsWith("B ") ? trimmed.slice(2).trim() : trimmed;
      return /^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base);
    };
    const isGrandFinalResetLabel = (label?: string | null) => {
      if (!label) return false;
      const trimmed = label.trim();
      const base = trimmed.startsWith("A ") || trimmed.startsWith("B ") ? trimmed.slice(2).trim() : trimmed;
      return /^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base);
    };
    const bracketMatches = koMatches.filter((m) => extractBracketPrefix(m.roundLabel) === prefix);
    const roundOrder = sortRoundsBySize(bracketMatches);
    const currentLabel = match.roundLabel ?? (roundOrder[0] ?? null);
    const currentIdx = currentLabel ? roundOrder.findIndex((label) => label === currentLabel) : -1;
    const downstreamLabels =
      currentIdx >= 0 ? new Set(roundOrder.slice(currentIdx + 1).map((label) => label || "?")) : null;

    const winnerDownstream = koMatches.filter(
      (m) =>
        m.id !== match.id &&
        matchHasPairing(m, winnerPairingId) &&
        (!downstreamLabels || downstreamLabels.has(m.roundLabel || "?")),
    );

    if (winnerDownstream.some((m) => m.status !== "PENDING")) {
      return NextResponse.json({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
    }

    winnerDownstream.forEach((m) => {
      updateDownstream.push({
        id: m.id,
        clearA: m.pairingAId === winnerPairingId,
        clearB: m.pairingBId === winnerPairingId,
      });
    });

    if (
      config?.format === "QUADRO_AB" &&
      prefix === "A " &&
      match.pairingAId &&
      match.pairingBId &&
      roundOrder[0] &&
      (match.roundLabel || "") === roundOrder[0]
    ) {
      const loserPairingId =
        winnerPairingId === match.pairingAId ? match.pairingBId : match.pairingAId;
      if (loserPairingId) {
        const loserDownstream = koMatches.filter(
          (m) =>
            extractBracketPrefix(m.roundLabel) === "B " &&
            matchHasPairing(m, loserPairingId),
        );
        if (loserDownstream.some((m) => m.status !== "PENDING")) {
          return NextResponse.json({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
        }
        loserDownstream.forEach((m) => {
          updateDownstream.push({
            id: m.id,
            clearA: m.pairingAId === loserPairingId,
            clearB: m.pairingBId === loserPairingId,
          });
        });
      }
    }

    if (isDoubleElim && prefix === "A " && match.pairingAId && match.pairingBId) {
      const loserPairingId =
        winnerPairingId === match.pairingAId ? match.pairingBId : match.pairingAId;
      if (loserPairingId) {
        const loserDownstream = koMatches.filter(
          (m) =>
            extractBracketPrefix(m.roundLabel) === "B " &&
            matchHasPairing(m, loserPairingId),
        );
        if (loserDownstream.some((m) => m.status !== "PENDING")) {
          return NextResponse.json({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
        }
        loserDownstream.forEach((m) => {
          updateDownstream.push({
            id: m.id,
            clearA: m.pairingAId === loserPairingId,
            clearB: m.pairingBId === loserPairingId,
          });
        });
      }
    }

    if (isDoubleElim && prefix === "B ") {
      const grandFinal = koMatches.find(
        (m) => extractBracketPrefix(m.roundLabel) === "A " && isGrandFinalLabel(m.roundLabel),
      );
      const grandFinalReset = koMatches.find(
        (m) => extractBracketPrefix(m.roundLabel) === "A " && isGrandFinalResetLabel(m.roundLabel),
      );
      if (grandFinal && matchHasPairing(grandFinal, winnerPairingId)) {
        if (grandFinal.status !== "PENDING") {
          return NextResponse.json({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
        }
        updateDownstream.push({
          id: grandFinal.id,
          clearA: grandFinal.pairingAId === winnerPairingId,
          clearB: grandFinal.pairingBId === winnerPairingId,
        });
      }
      if (grandFinalReset && matchHasPairing(grandFinalReset, winnerPairingId)) {
        if (grandFinalReset.status !== "PENDING") {
          return NextResponse.json({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
        }
        updateDownstream.push({
          id: grandFinalReset.id,
          clearA: grandFinalReset.pairingAId === winnerPairingId,
          clearB: grandFinalReset.pairingBId === winnerPairingId,
        });
      }
    }
  }

  const beforeStatus = typeof before.status === "string" ? before.status : match.status;
  const beforeWinner =
    typeof before.winnerPairingId === "number" ? (before.winnerPairingId as number) : null;
  const beforeScore = before.score && typeof before.score === "object" ? before.score : {};
  const beforeScoreSets = Array.isArray(before.scoreSets) ? before.scoreSets : null;

  const updated = await prisma.$transaction(async (tx) => {
    for (const target of updateDownstream) {
      if (!target.clearA && !target.clearB) continue;
      const data: Prisma.PadelMatchUpdateInput = {};
      if (target.clearA) data.pairingAId = null;
      if (target.clearB) data.pairingBId = null;
      if (target.clearA || target.clearB) data.winnerPairingId = null;
      await updatePadelMatch({
        tx,
        matchId: target.id,
        eventId: match.eventId,
        organizationId: match.event.organizationId,
        actorUserId: user.id,
        eventType: SYSTEM_MATCH_EVENT,
        data,
      });
    }

    const { match: restored } = await updatePadelMatch({
      tx,
      matchId,
      eventId: match.eventId,
      organizationId: match.event.organizationId,
      actorUserId: user.id,
      beforeStatus,
      eventType: SYSTEM_MATCH_EVENT,
      data: {
        status: beforeStatus as any,
        winnerPairingId: beforeWinner,
        score: beforeScore as Prisma.InputJsonValue,
        scoreSets: (beforeScoreSets ?? null) as Prisma.InputJsonValue | null,
      },
    });

    return restored;
  });

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_UNDO",
    metadata: {
      matchId,
      eventId: match.eventId,
      sourceLogId: targetLog.id,
      restored: true,
    },
  });

  return NextResponse.json({ ok: true, match: updated }, { status: 200 });
}
