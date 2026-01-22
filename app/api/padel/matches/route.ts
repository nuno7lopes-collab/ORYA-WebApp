export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, padel_match_status, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { isValidScore } from "@/lib/padel/validation";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { autoGeneratePadelMatches } from "@/domain/padel/autoGenerateMatches";
import {
  queueMatchChanged,
  queueMatchResult,
  queueNextOpponent,
  queueChampion,
  queueEliminated,
} from "@/domain/notifications/tournament";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { normalizePadelScoreRules, resolvePadelMatchStats } from "@/domain/padel/score";
import {
  computePadelStandingsByGroup,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
} from "@/domain/padel/standings";
import {
  advancePadelKnockoutWinner,
  extractBracketPrefix,
  sortRoundsBySize,
} from "@/domain/padel/knockoutAdvance";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const adminRoles = new Set<OrganizationMemberRole>(["OWNER", "CO_OWNER", "ADMIN"]);

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      organizationId: true,
      status: true,
      publicAccessMode: true,
      inviteOnly: true,
      padelTournamentConfig: { select: { advancedSettings: true } },
    },
  });
  if (!event?.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_matches",
    identifier: user?.id ?? String(eventId),
    max: 240,
  });
  if (rateLimited) return rateLimited;

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
  });
  const isPublicEvent =
    event.publicAccessMode !== "INVITE" &&
    !event.inviteOnly &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";

  if (!user && !isPublicEvent) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (user && !isPublicEvent) {
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: event.organizationId,
      roles: allowedRoles,
    });
    if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

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
  const courtIdRaw =
    typeof body.courtId === "number"
      ? body.courtId
      : typeof body.courtId === "string"
        ? Number(body.courtId)
        : undefined;
  const courtNumberRaw =
    typeof body.courtNumber === "number"
      ? body.courtNumber
      : typeof body.courtNumber === "string"
        ? Number(body.courtNumber)
        : undefined;

  if (!Number.isFinite(matchId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  if (startAtRaw && Number.isNaN(startAtRaw.getTime())) {
    return NextResponse.json({ ok: false, error: "INVALID_START_AT" }, { status: 400 });
  }

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    include: { event: { select: { organizationId: true } } },
  });
  if (!match || !match.event?.organizationId) return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: match.event.organizationId,
    roles: allowedRoles,
  });
  if (!organization || !membership) {
    return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  }

  const isAdmin = adminRoles.has(membership.role);

  if (scoreRaw && !isValidScore(scoreRaw)) {
    return NextResponse.json({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }

  const scoreObj = scoreRaw && typeof scoreRaw === "object" ? (scoreRaw as Record<string, unknown>) : null;
  const nextStatus = statusRaw ?? match.status;

  const existingScore =
    match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
  if (existingScore.disputeStatus === "OPEN" && !isAdmin) {
    return NextResponse.json({ ok: false, error: "MATCH_DISPUTED" }, { status: 423 });
  }
  const mergedScore =
    scoreObj && typeof scoreObj === "object"
      ? ({ ...existingScore, ...scoreObj } as Record<string, unknown>)
      : (existingScore as Record<string, unknown>);

  const hasIncomingSets = scoreObj && Object.prototype.hasOwnProperty.call(scoreObj, "sets");
  const incomingSets = hasIncomingSets ? (scoreObj as { sets?: unknown }).sets : undefined;
  const fallbackSets = Array.isArray(match.scoreSets)
    ? match.scoreSets
    : Array.isArray((existingScore as { sets?: unknown }).sets)
      ? (existingScore as { sets?: unknown }).sets
      : null;
  const rawSets = hasIncomingSets ? incomingSets : fallbackSets;
  const resultType = mergedScore?.resultType;
  const isWalkover =
    mergedScore?.walkover === true ||
    resultType === "WALKOVER" ||
    resultType === "RETIREMENT" ||
    resultType === "INJURY";
  const shouldApplyScoreRules = hasIncomingSets || isWalkover;
  const configForScore = shouldApplyScoreRules
    ? await prisma.padelTournamentConfig.findUnique({
        where: { eventId: match.eventId },
        select: { advancedSettings: true },
      })
    : null;
  const scoreRules = shouldApplyScoreRules
    ? normalizePadelScoreRules((configForScore?.advancedSettings as Record<string, unknown> | null)?.scoreRules)
    : null;
  const stats = resolvePadelMatchStats(rawSets, mergedScore, shouldApplyScoreRules ? scoreRules ?? undefined : undefined);

  if (Array.isArray(rawSets) && rawSets.length > 0 && nextStatus === "DONE" && !stats) {
    return NextResponse.json({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }

  let winnerPairingId: number | null = null;
  const winnerSideRaw = mergedScore?.winnerSide;
  const winnerSide =
    stats?.winner ?? (winnerSideRaw === "A" || winnerSideRaw === "B" ? winnerSideRaw : null);
  if (winnerSide === "A" && match.pairingAId) winnerPairingId = match.pairingAId;
  if (winnerSide === "B" && match.pairingBId) winnerPairingId = match.pairingBId;

  const shouldSetWinner = nextStatus === "DONE";
  if (shouldSetWinner && !winnerPairingId) {
    if (match.pairingAId && !match.pairingBId) winnerPairingId = match.pairingAId;
    if (!match.pairingAId && match.pairingBId) winnerPairingId = match.pairingBId;
  }
  if (shouldSetWinner && !winnerPairingId) {
    return NextResponse.json({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }

  const scoreValue = (scoreObj ? mergedScore : existingScore) as Prisma.InputJsonValue;
  const shouldSetScoreSetsFromStats =
    !hasIncomingSets && nextStatus === "DONE" && stats?.sets && !Array.isArray(match.scoreSets);
  const scoreSetsValue = hasIncomingSets
    ? ((stats?.sets ?? incomingSets) as Prisma.InputJsonValue)
    : shouldSetScoreSetsFromStats
      ? (stats?.sets as Prisma.InputJsonValue)
      : (match.scoreSets as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined);
  let courtIdValue: number | undefined;
  let courtNumberValue: number | undefined;
  if (Number.isFinite(courtIdRaw)) {
    const courtIdCandidate = Math.floor(courtIdRaw as number);
    const courtExists = await prisma.padelClubCourt.findFirst({
      where: { id: courtIdCandidate, club: { organizationId: match.event.organizationId } },
      select: { id: true },
    });
    if (courtExists) {
      courtIdValue = courtIdCandidate;
    } else {
      // Backwards compatibility: treat non-matching courtId as display number.
      courtNumberValue = courtIdCandidate;
    }
  }
  if (Number.isFinite(courtNumberRaw)) {
    courtNumberValue = Math.floor(courtNumberRaw as number);
  }

  const updated = await prisma.padelMatch.update({
    where: { id: matchId },
    data: {
      status: nextStatus,
      score: scoreValue,
      scoreSets: scoreSetsValue,
      winnerPairingId: shouldSetWinner ? winnerPairingId ?? match.winnerPairingId : match.winnerPairingId,
      startTime: startAtRaw ?? match.startTime,
      courtId: courtIdValue ?? match.courtId,
      ...(typeof courtNumberValue === "number" ? { courtNumber: courtNumberValue } : {}),
    },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
  });

  const eventMeta = await prisma.event.findUnique({
    where: { id: updated.eventId },
    select: { id: true, slug: true, title: true, organizationId: true, timezone: true },
  });

  const beforeScore = match.score && typeof match.score === "object" ? match.score : null;
  const beforeScoreSets = Array.isArray(match.scoreSets) ? match.scoreSets : null;
  const afterScore = scoreValue && typeof scoreValue === "object" ? scoreValue : null;
  const afterScoreSets = Array.isArray(scoreSetsValue) ? scoreSetsValue : null;

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_RESULT",
    metadata: {
      matchId: updated.id,
      eventId: updated.eventId,
      status: updated.status,
      winnerPairingId: updated.winnerPairingId ?? null,
      before: {
        status: match.status,
        winnerPairingId: match.winnerPairingId ?? null,
        score: beforeScore,
        scoreSets: beforeScoreSets,
      },
      after: {
        status: updated.status,
        winnerPairingId: updated.winnerPairingId ?? null,
        score: afterScore,
        scoreSets: afterScoreSets,
      },
    },
  });

  const involvedUserIds = [
    ...((updated.pairingA?.slots ?? []).map((s) => s.profileId).filter(Boolean) as string[]),
    ...((updated.pairingB?.slots ?? []).map((s) => s.profileId).filter(Boolean) as string[]),
  ];

  // Notificações: mudança de horário/court
  const matchCourtId = updated.courtId ?? updated.courtNumber ?? null;
  await queueMatchChanged({
    userIds: involvedUserIds,
    matchId: updated.id,
    startAt: updated.startTime ?? null,
    courtId: matchCourtId,
  });

  // Notificações de resultado + próximo adversário
  const resolvedWinnerPairingId = updated.winnerPairingId ?? null;
  if (resolvedWinnerPairingId) {
    await queueMatchResult(involvedUserIds, updated.id, updated.eventId);
    await queueNextOpponent(involvedUserIds, updated.id, updated.eventId);

    // Auto-avanço de vencedores no bracket (baseado em ordem dos jogos por ronda)
    if (updated.roundType === "KNOCKOUT") {
      const config = await prisma.padelTournamentConfig.findUnique({
        where: { eventId: updated.eventId },
        select: { format: true },
      });
      const koMatches = await prisma.padelMatch.findMany({
        where: {
          eventId: updated.eventId,
          roundType: "KNOCKOUT",
          ...(updated.categoryId ? { categoryId: updated.categoryId } : {}),
        },
        select: { id: true, roundLabel: true, pairingAId: true, pairingBId: true, winnerPairingId: true },
        orderBy: [{ roundLabel: "asc" }, { id: "asc" }],
      });
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
      const isGrandFinalAnyLabel = (label?: string | null) =>
        isGrandFinalLabel(label) || isGrandFinalResetLabel(label);
      const bracketPrefix = extractBracketPrefix(updated.roundLabel);
      const bracketMatches = koMatches.filter((m) => extractBracketPrefix(m.roundLabel) === bracketPrefix);
      const roundOrder = sortRoundsBySize(bracketMatches);
      const aMatches = koMatches.filter((m) => extractBracketPrefix(m.roundLabel) === "A ");
      const bMatches = koMatches.filter((m) => extractBracketPrefix(m.roundLabel) === "B ");
      const aRoundOrder = sortRoundsBySize(aMatches);
      const aRoundOrderNoGF = aRoundOrder.filter((label) => !isGrandFinalAnyLabel(label));
      const bRoundOrder = sortRoundsBySize(bMatches);
      const getRoundMatches = (matches: typeof koMatches, label: string | null) =>
        matches.filter((m) => (m.roundLabel || "?") === (label || "?")).sort((a, b) => a.id - b.id);
      const parseLoserRoundIndex = (label?: string | null) => {
        if (!label) return null;
        const trimmed = label.trim();
        const base = trimmed.startsWith("A ") || trimmed.startsWith("B ") ? trimmed.slice(2).trim() : trimmed;
        if (!/^L\\d+$/i.test(base)) return null;
        const parsed = Number(base.slice(1));
        return Number.isFinite(parsed) ? parsed : null;
      };
      const grandFinal = isDoubleElim ? aMatches.find((m) => isGrandFinalLabel(m.roundLabel)) : null;
      const grandFinalReset = isDoubleElim ? aMatches.find((m) => isGrandFinalResetLabel(m.roundLabel)) : null;

      const isGrandFinal = isDoubleElim && isGrandFinalLabel(updated.roundLabel);
      const isGrandFinalReset = isDoubleElim && isGrandFinalResetLabel(updated.roundLabel);
      const shouldAutoAdvance = !(isDoubleElim && (isGrandFinal || isGrandFinalReset));

      if (shouldAutoAdvance) {
        await advancePadelKnockoutWinner({
          matches: koMatches,
          updateMatch: (matchId, data) =>
            prisma.padelMatch.update({
              where: { id: matchId },
              data,
              select: { id: true, roundLabel: true, pairingAId: true, pairingBId: true, winnerPairingId: true },
            }),
          winnerMatchId: updated.id,
          winnerPairingId: resolvedWinnerPairingId,
        });
      }

      const loserPairingId =
        resolvedWinnerPairingId && updated.pairingAId && updated.pairingBId
          ? resolvedWinnerPairingId === updated.pairingAId
            ? updated.pairingBId
            : updated.pairingAId
          : null;

      if (
        config?.format === "QUADRO_AB" &&
        bracketPrefix === "A " &&
        updated.pairingAId &&
        updated.pairingBId &&
        roundOrder.length > 0 &&
        (updated.roundLabel || "") === roundOrder[0]
      ) {
        const bMatches = koMatches.filter((m) => extractBracketPrefix(m.roundLabel) === "B ");
        if (bMatches.length > 0 && loserPairingId) {
          const bRoundOrder = sortRoundsBySize(bMatches);
          const bFirstRound = bRoundOrder[0];
          if (bFirstRound) {
            const aFirstRoundMatches = bracketMatches
              .filter((m) => (m.roundLabel || "?") === roundOrder[0])
              .sort((a, b) => a.id - b.id);
            const aPlayableMatches = aFirstRoundMatches.filter((m) => m.pairingAId && m.pairingBId);
            const aIndex = aPlayableMatches.findIndex((m) => m.id === updated.id);
            const bFirstRoundMatches = bMatches
              .filter((m) => (m.roundLabel || "?") === bFirstRound)
              .sort((a, b) => a.id - b.id);
            if (aIndex !== -1 && bFirstRoundMatches.length > 0) {
              const targetIdx = Math.floor(aIndex / 2);
              const target = bFirstRoundMatches[targetIdx];
              if (target) {
                const updateTarget: Record<string, number> = {};
                if (aIndex % 2 === 0) {
                  if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
                  else if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                } else {
                  if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                  else if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
                }
                if (Object.keys(updateTarget).length > 0) {
                  await prisma.padelMatch.update({
                    where: { id: target.id },
                    data: updateTarget,
                  });
                }
              }
            }
          }
        }
      }

      if (isDoubleElim && bracketPrefix === "A " && loserPairingId && aRoundOrderNoGF.length > 0 && bMatches.length > 0) {
        const currentLabel = updated.roundLabel ?? aRoundOrderNoGF[0];
        const wIndex = currentLabel ? aRoundOrderNoGF.findIndex((label) => label === currentLabel) : -1;
        if (wIndex >= 0) {
          const loserRoundIndex = wIndex === 0 ? 1 : 2 * (wIndex + 1) - 2;
          const loserRoundLabel = `B L${loserRoundIndex}`;
          const aRoundMatches = getRoundMatches(aMatches, currentLabel);
          const bRoundMatches = getRoundMatches(bMatches, loserRoundLabel);
          const aIndex = aRoundMatches.findIndex((m) => m.id === updated.id);
          if (aIndex !== -1 && bRoundMatches.length > 0) {
            const targetIdx = wIndex === 0 ? Math.floor(aIndex / 2) : aIndex;
            const target = bRoundMatches[targetIdx];
            if (target) {
              const updateTarget: Record<string, number> = {};
              if (wIndex === 0) {
                if (aIndex % 2 === 0) {
                  if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
                  else if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                } else {
                  if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                  else if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
                }
              } else {
                if (!target.pairingBId) updateTarget.pairingBId = loserPairingId;
                else if (!target.pairingAId) updateTarget.pairingAId = loserPairingId;
              }
              if (Object.keys(updateTarget).length > 0) {
                await prisma.padelMatch.update({
                  where: { id: target.id },
                  data: updateTarget,
                });
              }
            }
          }
        }
      }

      if (isDoubleElim && bracketPrefix === "B " && resolvedWinnerPairingId && bRoundOrder.length > 0) {
        const currentLoserRound = parseLoserRoundIndex(updated.roundLabel);
        const lastLoserRound = Math.max(
          ...bRoundOrder.map((label) => parseLoserRoundIndex(label) ?? 0),
        );
        if (currentLoserRound && lastLoserRound && currentLoserRound === lastLoserRound) {
          if (grandFinal) {
            const updateTarget: Record<string, number> = {};
            if (!grandFinal.pairingAId) updateTarget.pairingAId = resolvedWinnerPairingId;
            else if (!grandFinal.pairingBId) updateTarget.pairingBId = resolvedWinnerPairingId;
            if (Object.keys(updateTarget).length > 0) {
              await prisma.padelMatch.update({
                where: { id: grandFinal.id },
                data: updateTarget,
              });
            }
          }
        }
      }

      let gfResetNeeded: boolean | null = null;
      if (isDoubleElim && isGrandFinal && resolvedWinnerPairingId) {
        const winnersFinalLabel =
          aRoundOrderNoGF.length > 0 ? aRoundOrderNoGF[aRoundOrderNoGF.length - 1] : null;
        const winnersFinal = winnersFinalLabel ? getRoundMatches(aMatches, winnersFinalLabel)[0] : null;
        const winnersFinalWinner = winnersFinal?.winnerPairingId ?? null;

        const lastLoserRoundLabel = bRoundOrder.length > 0 ? bRoundOrder[bRoundOrder.length - 1] : null;
        const lastLoserMatch = lastLoserRoundLabel ? getRoundMatches(bMatches, lastLoserRoundLabel)[0] : null;
        const losersFinalWinner = lastLoserMatch?.winnerPairingId ?? null;

        if (losersFinalWinner) {
          gfResetNeeded = resolvedWinnerPairingId === losersFinalWinner;
        } else if (winnersFinalWinner) {
          gfResetNeeded = resolvedWinnerPairingId !== winnersFinalWinner;
        }

        if (grandFinalReset && gfResetNeeded !== null) {
          if (gfResetNeeded) {
            const pairingAId = grandFinal?.pairingAId ?? winnersFinalWinner ?? null;
            const pairingBId = grandFinal?.pairingBId ?? resolvedWinnerPairingId ?? null;
            await prisma.padelMatch.update({
              where: { id: grandFinalReset.id },
              data: {
                pairingAId,
                pairingBId,
                winnerPairingId: null,
                status: "PENDING",
                score: {},
                scoreSets: null,
              },
            });
          } else {
            await prisma.padelMatch.update({
              where: { id: grandFinalReset.id },
              data: {
                pairingAId: null,
                pairingBId: null,
                winnerPairingId: null,
                status: "CANCELLED",
                score: {},
                scoreSets: null,
              },
            });
          }
        }
      }

      const isFirstRound = roundOrder.length > 0 && (updated.roundLabel || "") === roundOrder[0];
      const finalRound = roundOrder[roundOrder.length - 1];
      const isFinal = finalRound && (updated.roundLabel || "") === finalRound;
      const isMainBracket = bracketPrefix !== "B ";
      const hasGrandFinal = isDoubleElim && aMatches.some((m) => isGrandFinalLabel(m.roundLabel));
      let shouldNotifyEliminated = false;
      if (isDoubleElim) {
        if (bracketPrefix === "B ") {
          shouldNotifyEliminated = Boolean(loserPairingId);
        } else if (isGrandFinalReset) {
          shouldNotifyEliminated = Boolean(loserPairingId);
        } else if (isGrandFinal) {
          shouldNotifyEliminated = Boolean(loserPairingId) && gfResetNeeded === false;
        } else if (!hasGrandFinal && isFinal && isMainBracket) {
          shouldNotifyEliminated = Boolean(loserPairingId);
        }
      } else {
        shouldNotifyEliminated =
          Boolean(loserPairingId) && (config?.format !== "QUADRO_AB" || bracketPrefix === "B " || !isFirstRound);
      }
      if (shouldNotifyEliminated && loserPairingId) {
        const loserPairing =
          loserPairingId === updated.pairingAId
            ? updated.pairingA
            : loserPairingId === updated.pairingBId
              ? updated.pairingB
              : null;
        const loserUserIds = Array.from(
          new Set((loserPairing?.slots ?? []).map((slot) => slot.profileId).filter(Boolean) as string[]),
        );
        if (loserUserIds.length > 0) {
          await queueEliminated(loserUserIds, updated.eventId);
        }
      }

      let shouldNotifyChampion = false;
      if (isDoubleElim) {
        if (isGrandFinalReset && resolvedWinnerPairingId) {
          shouldNotifyChampion = true;
        } else if (isGrandFinal && resolvedWinnerPairingId && gfResetNeeded === false) {
          shouldNotifyChampion = true;
        } else if (!hasGrandFinal && isFinal && isMainBracket && resolvedWinnerPairingId) {
          shouldNotifyChampion = true;
        }
      } else {
        shouldNotifyChampion = Boolean(resolvedWinnerPairingId) && isFinal && isMainBracket;
      }
      if (shouldNotifyChampion && resolvedWinnerPairingId) {
        const winnerPairing =
          resolvedWinnerPairingId === updated.pairingAId
            ? updated.pairingA
            : resolvedWinnerPairingId === updated.pairingBId
              ? updated.pairingB
              : null;
        const winnerUserIds = (winnerPairing?.slots ?? [])
          .map((slot) => slot.profileId)
          .filter(Boolean) as string[];
        if (winnerUserIds.length > 0) {
          await queueChampion(winnerUserIds, updated.eventId);
        }
      }
    }
  }

  const matchCompleted = updated.status === "DONE" && match.status !== "DONE";
  const pairingLabel = (pairing: typeof updated.pairingA | null) => {
    if (!pairing) return "Dupla";
    const names = (pairing.slots || [])
      .map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName)
      .filter(Boolean) as string[];
    return names.length > 0 ? names.join(" / ") : `Dupla #${pairing.id}`;
  };

  const notifyNextMatch = async (pairingId: number) => {
    const nextMatch = await prisma.padelMatch.findFirst({
      where: {
        eventId: updated.eventId,
        status: "PENDING",
        AND: [
          { OR: [{ pairingAId: pairingId }, { pairingBId: pairingId }] },
          { OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }] },
        ],
      },
      orderBy: [{ plannedStartAt: "asc" }, { startTime: "asc" }, { id: "asc" }],
      include: {
        court: { select: { name: true } },
        pairingA: { include: { slots: { include: { playerProfile: true } } } },
        pairingB: { include: { slots: { include: { playerProfile: true } } } },
      },
    });
    if (!nextMatch) return;

    const startAt = nextMatch.plannedStartAt ?? nextMatch.startTime;
    if (!startAt) return;

    const targetPairing =
      nextMatch.pairingAId === pairingId ? nextMatch.pairingA : nextMatch.pairingB;
    const opponentPairing =
      nextMatch.pairingAId === pairingId ? nextMatch.pairingB : nextMatch.pairingA;
    const pairingUsers = (targetPairing?.slots ?? [])
      .map((slot) => slot.profileId)
      .filter(Boolean) as string[];

    const timeLabel = new Intl.DateTimeFormat("pt-PT", {
      timeZone: eventMeta?.timezone || "Europe/Lisbon",
      hour: "2-digit",
      minute: "2-digit",
    }).format(startAt);
    const courtLabel = nextMatch.court?.name || nextMatch.courtName || nextMatch.courtNumber || nextMatch.courtId || "Quadra";
    const opponentLabel = pairingLabel(opponentPairing);

    for (const userId of pairingUsers) {
      const allow = await shouldNotify(userId, "EVENT_REMINDER");
      if (!allow) continue;
      const dedupeKey = `NEXT_MATCH:${nextMatch.id}:${userId}`;
      try {
        await prisma.matchNotification.create({
          data: {
            matchId: nextMatch.id,
            dedupeKey,
            payload: { type: "NEXT_MATCH", startAt: startAt.toISOString() },
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throw err;
      }

      await createNotification({
        userId,
        type: "EVENT_REMINDER",
        title: "Próximo jogo definido",
        body: `Contra ${opponentLabel} · ${timeLabel} · ${courtLabel}`,
        eventId: eventMeta?.id ?? null,
        organizationId: eventMeta?.organizationId ?? null,
        ctaUrl: eventMeta?.slug ? `/eventos/${eventMeta.slug}` : null,
        ctaLabel: "Ver torneio",
        payload: {
          matchId: nextMatch.id,
          eventId: eventMeta?.id ?? null,
          startAt: startAt.toISOString(),
        },
      });
    }
  };

  if (matchCompleted && updated.pairingAId) {
    await notifyNextMatch(updated.pairingAId);
  }
  if (matchCompleted && updated.pairingBId) {
    await notifyNextMatch(updated.pairingBId);
  }

  if (matchCompleted && updated.roundType === "GROUPS" && updated.groupLabel) {
    const [config, groupMatches] = await Promise.all([
      prisma.padelTournamentConfig.findUnique({
        where: { eventId: updated.eventId },
        select: { ruleSetId: true, advancedSettings: true, format: true },
      }),
      prisma.padelMatch.findMany({
        where: {
          eventId: updated.eventId,
          roundType: "GROUPS",
          groupLabel: updated.groupLabel,
          ...(updated.categoryId ? { categoryId: updated.categoryId } : {}),
        },
        select: {
          id: true,
          pairingAId: true,
          pairingBId: true,
          scoreSets: true,
          score: true,
          status: true,
        },
      }),
    ]);

    const allClosed = groupMatches.every(
      (m) => m.status === "DONE" || m.status === "CANCELLED",
    );
    if (allClosed) {
      const ruleSet = config?.ruleSetId
        ? await prisma.padelRuleSet.findUnique({ where: { id: config.ruleSetId } })
        : null;
      const pointsTable = normalizePadelPointsTable(ruleSet?.pointsTable);
      const tieBreakRules = normalizePadelTieBreakRules(ruleSet?.tieBreakRules);
      const standingsByGroup = computePadelStandingsByGroup(groupMatches, pointsTable, tieBreakRules);
      const standings = standingsByGroup[updated.groupLabel] ?? [];
      const groupsConfig = (config?.advancedSettings as { groupsConfig?: { qualifyPerGroup?: number | null } } | null)
        ?.groupsConfig;
      const qualifyPerGroup =
        typeof groupsConfig?.qualifyPerGroup === "number" && Number.isFinite(groupsConfig.qualifyPerGroup)
          ? Math.max(1, Math.floor(groupsConfig.qualifyPerGroup))
          : 2;
      const pairingIds = standings.map((row) => row.pairingId);
      const pairings = await prisma.padelPairing.findMany({
        where: { id: { in: pairingIds } },
        select: { id: true, slots: { select: { profileId: true } } },
      });
      const pairingUsers = new Map<number, string[]>();
      pairings.forEach((pairing) => {
        pairingUsers.set(
          pairing.id,
          (pairing.slots ?? []).map((slot) => slot.profileId).filter(Boolean) as string[],
        );
      });

      for (let idx = 0; idx < standings.length; idx += 1) {
        const row = standings[idx];
        const qualified = idx < qualifyPerGroup;
        const users = pairingUsers.get(row.pairingId) ?? [];
        for (const userId of users) {
          const allow = await shouldNotify(userId, "EVENT_REMINDER");
          if (!allow) continue;
          const dedupeKey = `GROUP_CLOSED:${updated.eventId}:${updated.groupLabel}:${row.pairingId}:${userId}`;
          try {
            await prisma.matchNotification.create({
              data: {
                matchId: updated.id,
                dedupeKey,
                payload: { type: "GROUP_CLOSED", group: updated.groupLabel },
              },
            });
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
            throw err;
          }
          await createNotification({
            userId,
            type: "EVENT_REMINDER",
            title: `Grupo ${updated.groupLabel} fechado`,
            body: qualified
              ? `Terminaste em ${idx + 1}º · Qualificado para a próxima fase.`
              : `Terminaste em ${idx + 1}º · Grupo concluído.`,
            eventId: eventMeta?.id ?? null,
            organizationId: eventMeta?.organizationId ?? null,
            ctaUrl: eventMeta?.slug ? `/eventos/${eventMeta.slug}` : null,
            ctaLabel: "Ver torneio",
            payload: {
              group: updated.groupLabel,
              position: idx + 1,
              qualified,
              eventId: eventMeta?.id ?? null,
            },
          });
        }
      }
    }

    if (allClosed) {
      const [allGroupMatches, existingKo, categoryLink] = await Promise.all([
        prisma.padelMatch.findMany({
          where: {
            eventId: updated.eventId,
            roundType: "GROUPS",
            ...(updated.categoryId ? { categoryId: updated.categoryId } : {}),
          },
          select: { id: true, status: true },
        }),
        prisma.padelMatch.findFirst({
          where: {
            eventId: updated.eventId,
            roundType: "KNOCKOUT",
            ...(updated.categoryId ? { categoryId: updated.categoryId } : {}),
          },
          select: { id: true },
        }),
        updated.categoryId
          ? prisma.padelEventCategoryLink.findFirst({
              where: { eventId: updated.eventId, padelCategoryId: updated.categoryId, isEnabled: true },
              select: { format: true },
            })
          : Promise.resolve(null),
      ]);

      const allGroupsClosed =
        allGroupMatches.length > 0 &&
        allGroupMatches.every((m) => m.status === "DONE" || m.status === "CANCELLED");
      const formatToUse = categoryLink?.format ?? config?.format ?? null;
      if (allGroupsClosed && !existingKo && formatToUse === "GRUPOS_ELIMINATORIAS") {
        try {
          await autoGeneratePadelMatches({
            eventId: updated.eventId,
            categoryId: updated.categoryId ?? null,
            format: formatToUse,
            phase: "KNOCKOUT",
            actorUserId: user.id,
            auditAction: "PADEL_MATCHES_AUTO_GENERATED",
          });
        } catch (err) {
          console.warn("[padel][auto-generate-ko] falhou", err);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, match: updated }, { status: 200 });
}
