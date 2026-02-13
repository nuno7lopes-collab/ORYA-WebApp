export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { extractBracketPrefix, sortRoundsBySize } from "@/domain/padel/knockoutAdvance";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const UNDO_WINDOW_MS = 60 * 1000;
const SYSTEM_MATCH_EVENT = "PADEL_MATCH_SYSTEM_UPDATED";

const asObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const matchHasAnyParticipant = (
  match: { participants?: Array<{ participantId: number }> },
  participantIds: number[],
) => {
  if (!Array.isArray(match.participants) || participantIds.length === 0) return false;
  const target = new Set(participantIds);
  return match.participants.some((row) => target.has(row.participantId));
};

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const matchId = Number(resolved?.id);
  if (!Number.isFinite(matchId)) {
    return jsonWrap({ ok: false, error: "INVALID_MATCH" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const eventIdBody =
    typeof body?.eventId === "number"
      ? body.eventId
      : typeof body?.eventId === "string"
        ? Number(body.eventId)
        : null;

  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      eventId: true,
      status: true,
      roundType: true,
      categoryId: true,
      roundLabel: true,
      winnerParticipantId: true,
      winnerSide: true,
      participants: {
        orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
        select: {
          side: true,
          participantId: true,
        },
      },
      event: { select: { id: true, organizationId: true } },
    },
  });
  if (!match || !match.event?.organizationId) {
    return jsonWrap({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }
  const organizationId = match.event.organizationId;
  if (Number.isFinite(eventIdBody) && match.eventId !== eventIdBody) {
    return jsonWrap({ ok: false, error: "EVENT_MISMATCH" }, { status: 409 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const recentLogs = await prisma.organizationAuditLog.findMany({
    where: { organizationId, action: "PADEL_MATCH_RESULT" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const targetLog = recentLogs.find((log) => {
    const meta = asObject(log.metadata);
    return meta?.matchId === matchId;
  });

  if (!targetLog) {
    return jsonWrap({ ok: false, error: "UNDO_NOT_FOUND" }, { status: 404 });
  }

  if (!targetLog.createdAt || Date.now() - targetLog.createdAt.getTime() > UNDO_WINDOW_MS) {
    return jsonWrap({ ok: false, error: "UNDO_EXPIRED" }, { status: 409 });
  }

  const metadata = asObject(targetLog.metadata);
  const before = asObject(metadata?.before);
  const after = asObject(metadata?.after);
  if (!before) {
    return jsonWrap({ ok: false, error: "UNDO_INVALID" }, { status: 400 });
  }

  const winnerSideFromAfter =
    after?.winnerSide === "A" || after?.winnerSide === "B"
      ? (after.winnerSide as "A" | "B")
      : match.winnerSide === "A" || match.winnerSide === "B"
        ? match.winnerSide
        : null;
  const winnerParticipantIds =
    winnerSideFromAfter === "A" || winnerSideFromAfter === "B"
      ? match.participants
          .filter((row) => row.side === winnerSideFromAfter)
          .map((row) => row.participantId)
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      : typeof match.winnerParticipantId === "number"
        ? [match.winnerParticipantId]
        : [];
  const loserParticipantIds =
    winnerSideFromAfter === "A" || winnerSideFromAfter === "B"
      ? match.participants
          .filter((row) => row.side !== winnerSideFromAfter)
          .map((row) => row.participantId)
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      : [];

  const updateDownstream: Array<{
    id: number;
    clearParticipantIds: number[];
  }> = [];
  if (match.roundType === "KNOCKOUT" && winnerParticipantIds.length > 0) {
    const [config, koMatches] = await Promise.all([
      prisma.padelTournamentConfig.findUnique({
        where: { eventId: match.eventId },
        select: { format: true },
      }),
      prisma.eventMatchSlot.findMany({
        where: {
          eventId: match.eventId,
          roundType: "KNOCKOUT",
          ...(match.categoryId ? { categoryId: match.categoryId } : {}),
        },
        select: {
          id: true,
          roundLabel: true,
          winnerParticipantId: true,
          winnerSide: true,
          status: true,
          participants: {
            select: {
              participantId: true,
            },
          },
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
        matchHasAnyParticipant(m, winnerParticipantIds) &&
        (!downstreamLabels || downstreamLabels.has(m.roundLabel || "?")),
    );

    if (winnerDownstream.some((m) => m.status !== "PENDING")) {
      return jsonWrap({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
    }

    winnerDownstream.forEach((m) => {
      const clearParticipantIds = (m.participants ?? [])
        .map((row) => row.participantId)
        .filter((id): id is number => winnerParticipantIds.includes(id));
      updateDownstream.push({
        id: m.id,
        clearParticipantIds,
      });
    });

    if (
      config?.format === "QUADRO_AB" &&
      prefix === "A " &&
      roundOrder[0] &&
      (match.roundLabel || "") === roundOrder[0]
    ) {
      const loserDownstream = koMatches.filter(
        (m) =>
          extractBracketPrefix(m.roundLabel) === "B " &&
          matchHasAnyParticipant(m, loserParticipantIds),
      );
      if (loserDownstream.some((m) => m.status !== "PENDING")) {
        return jsonWrap({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
      }
      loserDownstream.forEach((m) => {
        const clearParticipantIds = (m.participants ?? [])
          .map((row) => row.participantId)
          .filter((id): id is number => loserParticipantIds.includes(id));
        updateDownstream.push({
          id: m.id,
          clearParticipantIds,
        });
      });
    }

    if (isDoubleElim && prefix === "A ") {
      const loserDownstream = koMatches.filter(
        (m) =>
          extractBracketPrefix(m.roundLabel) === "B " &&
          matchHasAnyParticipant(m, loserParticipantIds),
      );
      if (loserDownstream.some((m) => m.status !== "PENDING")) {
        return jsonWrap({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
      }
      loserDownstream.forEach((m) => {
        const clearParticipantIds = (m.participants ?? [])
          .map((row) => row.participantId)
          .filter((id): id is number => loserParticipantIds.includes(id));
        updateDownstream.push({
          id: m.id,
          clearParticipantIds,
        });
      });
    }

    if (isDoubleElim && prefix === "B ") {
      const grandFinal = koMatches.find(
        (m) => extractBracketPrefix(m.roundLabel) === "A " && isGrandFinalLabel(m.roundLabel),
      );
      const grandFinalReset = koMatches.find(
        (m) => extractBracketPrefix(m.roundLabel) === "A " && isGrandFinalResetLabel(m.roundLabel),
      );
      if (
        grandFinal &&
        matchHasAnyParticipant(grandFinal, winnerParticipantIds)
      ) {
        if (grandFinal.status !== "PENDING") {
          return jsonWrap({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
        }
        const clearParticipantIds = (grandFinal.participants ?? [])
          .map((row) => row.participantId)
          .filter((id): id is number => winnerParticipantIds.includes(id));
        updateDownstream.push({
          id: grandFinal.id,
          clearParticipantIds,
        });
      }
      if (
        grandFinalReset &&
        matchHasAnyParticipant(grandFinalReset, winnerParticipantIds)
      ) {
        if (grandFinalReset.status !== "PENDING") {
          return jsonWrap({ ok: false, error: "DOWNSTREAM_LOCKED" }, { status: 409 });
        }
        const clearParticipantIds = (grandFinalReset.participants ?? [])
          .map((row) => row.participantId)
          .filter((id): id is number => winnerParticipantIds.includes(id));
        updateDownstream.push({
          id: grandFinalReset.id,
          clearParticipantIds,
        });
      }
    }
  }

  const beforeStatus = typeof before.status === "string" ? before.status : match.status;
  const beforeWinnerParticipant =
    typeof before.winnerParticipantId === "number"
      ? (before.winnerParticipantId as number)
      : typeof match.winnerParticipantId === "number"
        ? match.winnerParticipantId
        : null;
  const beforeWinnerSide =
    before.winnerSide === "A" || before.winnerSide === "B"
      ? before.winnerSide
      : match.winnerSide === "A" || match.winnerSide === "B"
        ? match.winnerSide
        : null;
  const beforeScore = before.score && typeof before.score === "object" ? before.score : {};
  const beforeScoreSets = Array.isArray(before.scoreSets) ? before.scoreSets : null;

  const updated = await prisma.$transaction(async (tx) => {
    for (const target of updateDownstream) {
      if (target.clearParticipantIds.length === 0) continue;
      if (target.clearParticipantIds.length > 0) {
        await tx.padelMatchParticipant.deleteMany({
          where: {
            matchId: target.id,
            participantId: { in: target.clearParticipantIds },
          },
        });
      }
      const data: Prisma.EventMatchSlotUncheckedUpdateInput = {};
      data.winnerParticipantId = null;
      data.winnerSide = null;
      await updatePadelMatch({
        tx,
        matchId: target.id,
        eventId: match.eventId,
        organizationId,
        actorUserId: user.id,
        eventType: SYSTEM_MATCH_EVENT,
        data,
      });
    }

    const { match: restored } = await updatePadelMatch({
      tx,
      matchId,
      eventId: match.eventId,
      organizationId,
      actorUserId: user.id,
      beforeStatus,
      eventType: SYSTEM_MATCH_EVENT,
      data: {
        status: beforeStatus as any,
        winnerParticipantId: beforeWinnerParticipant,
        winnerSide: beforeWinnerSide,
        score: beforeScore as Prisma.InputJsonValue,
        scoreSets: beforeScoreSets ? (beforeScoreSets as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    return restored;
  });

  await recordOrganizationAuditSafe({
    organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_UNDO",
    metadata: {
      matchId,
      eventId: match.eventId,
      sourceLogId: targetLog.id,
      restored: true,
    },
  });

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
