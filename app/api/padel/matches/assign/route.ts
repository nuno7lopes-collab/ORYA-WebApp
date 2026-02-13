export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule, PadelMatchSide, Prisma, padel_match_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

const parseOptionalId = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const parseParticipantIds = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const ids = value
    .map((entry) => (typeof entry === "number" ? entry : Number(entry)))
    .filter((entry): entry is number => Number.isFinite(entry) && entry > 0)
    .map((entry) => Math.floor(entry));
  return Array.from(new Set(ids));
};

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const matchId = parseOptionalId(body.matchId ?? body.id);
  if (!matchId) return jsonWrap({ ok: false, error: "INVALID_MATCH" }, { status: 400 });
  const pairingAId = parseOptionalId(body.pairingAId ?? null);
  const pairingBId = parseOptionalId(body.pairingBId ?? null);
  const participantsA = parseParticipantIds(body.participantsA ?? body.sideAParticipants ?? null);
  const participantsB = parseParticipantIds(body.participantsB ?? body.sideBParticipants ?? null);
  const hasParticipantsPayload = participantsA !== null || participantsB !== null;
  if (hasParticipantsPayload && (!participantsA || !participantsB)) {
    return jsonWrap({ ok: false, error: "PARTICIPANTS_PAYLOAD_INCOMPLETE" }, { status: 400 });
  }
  if (!hasParticipantsPayload && !pairingAId && !pairingBId) {
    return jsonWrap({ ok: false, error: "PAIRING_OR_PARTICIPANTS_REQUIRED" }, { status: 400 });
  }
  if (pairingAId && pairingBId && pairingAId === pairingBId) {
    return jsonWrap({ ok: false, error: "DUPLICATE_PAIRING" }, { status: 400 });
  }
  if (hasParticipantsPayload) {
    const sideA = participantsA ?? [];
    const sideB = participantsB ?? [];
    if (sideA.length === 0 && sideB.length === 0) {
      return jsonWrap({ ok: false, error: "PARTICIPANTS_REQUIRED" }, { status: 400 });
    }
    if (sideA.some((id) => sideB.includes(id))) {
      return jsonWrap({ ok: false, error: "DUPLICATE_PARTICIPANT_ON_BOTH_SIDES" }, { status: 400 });
    }
  }

  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      eventId: true,
      categoryId: true,
      roundType: true,
      roundLabel: true,
      status: true,
      event: { select: { organizationId: true } },
    },
  });
  if (!match || !match.event?.organizationId) {
    return jsonWrap({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }
  const organizationId = match.event.organizationId;
  if (match.roundType !== "KNOCKOUT") {
    return jsonWrap({ ok: false, error: "MATCH_NOT_KNOCKOUT" }, { status: 409 });
  }
  if (match.status !== padel_match_status.PENDING) {
    return jsonWrap({ ok: false, error: "MATCH_LOCKED" }, { status: 409 });
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

  const matchCategoryFilter = match.categoryId ? { categoryId: match.categoryId } : {};
  const started = await prisma.eventMatchSlot.findFirst({
    where: {
      eventId: match.eventId,
      roundType: "KNOCKOUT",
      status: { in: [padel_match_status.IN_PROGRESS, padel_match_status.DONE] },
      ...matchCategoryFilter,
    },
    select: { id: true },
  });
  if (started) {
    return jsonWrap({ ok: false, error: "KO_LOCKED" }, { status: 409 });
  }

  if (hasParticipantsPayload) {
    const allParticipantIds = [...(participantsA ?? []), ...(participantsB ?? [])];
    const participantRows = allParticipantIds.length
      ? await prisma.padelTournamentParticipant.findMany({
          where: {
            id: { in: allParticipantIds },
            eventId: match.eventId,
            ...(match.categoryId ? { categoryId: match.categoryId } : {}),
          },
          select: { id: true },
        })
      : [];
    if (participantRows.length !== allParticipantIds.length) {
      return jsonWrap({ ok: false, error: "PARTICIPANT_NOT_FOUND" }, { status: 404 });
    }
    const conflict = allParticipantIds.length
      ? await prisma.padelMatchParticipant.findFirst({
          where: {
            participantId: { in: allParticipantIds },
            matchId: { not: match.id },
            match: {
              eventId: match.eventId,
              roundType: "KNOCKOUT",
              roundLabel: match.roundLabel,
              ...(match.categoryId ? { categoryId: match.categoryId } : {}),
            },
          },
          select: { id: true },
        })
      : null;
    if (conflict) {
      return jsonWrap({ ok: false, error: "PARTICIPANT_ALREADY_ASSIGNED" }, { status: 409 });
    }
  } else {
    const pairingIds = [pairingAId, pairingBId].filter(Boolean) as number[];
    const pairings = await prisma.padelPairing.findMany({
      where: { id: { in: pairingIds }, eventId: match.eventId },
      select: {
        id: true,
        categoryId: true,
        pairingStatus: true,
        registration: { select: { status: true } },
        slots: {
          orderBy: { id: "asc" },
          select: { playerProfileId: true },
        },
      },
    });
    if (pairings.length !== pairingIds.length) {
      return jsonWrap({ ok: false, error: "PAIRING_NOT_FOUND" }, { status: 404 });
    }
    const invalid = pairings.find(
      (p) =>
        (match.categoryId && p.categoryId !== match.categoryId) ||
        p.pairingStatus !== "COMPLETE" ||
        p.registration?.status !== "CONFIRMED",
    );
    if (invalid) {
      return jsonWrap({ ok: false, error: "PAIRING_INVALID" }, { status: 409 });
    }

    const conflict = await prisma.eventMatchSlot.findFirst({
      where: {
        eventId: match.eventId,
        roundType: "KNOCKOUT",
        roundLabel: match.roundLabel,
        id: { not: match.id },
        ...matchCategoryFilter,
        participants: {
          some: {
            participant: {
              sourcePairingId: { in: pairingIds },
            },
          },
        },
      },
      select: { id: true },
    });
    if (conflict) {
      return jsonWrap({ ok: false, error: "PAIRING_ALREADY_ASSIGNED" }, { status: 409 });
    }
  }

  const data: Prisma.EventMatchSlotUncheckedUpdateInput = {
    winnerParticipantId: null,
    winnerSide: null,
    status: padel_match_status.PENDING,
    score: {} as Prisma.InputJsonValue,
    scoreSets: Prisma.DbNull,
    pairingAId: null,
    pairingBId: null,
    winnerPairingId: null,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const { match: updatedMatch } = await updatePadelMatch({
      tx,
      matchId: match.id,
      eventId: match.eventId,
      organizationId,
      actorUserId: user.id,
      beforeStatus: match.status ?? null,
      data,
      select: { id: true, roundLabel: true, winnerParticipantId: true, winnerSide: true },
    });

    await tx.padelMatchParticipant.deleteMany({ where: { matchId: match.id } });

    const participantAssignments: Array<{
      matchId: number;
      participantId: number;
      side: PadelMatchSide;
      slotOrder: number;
    }> = [];

    if (hasParticipantsPayload) {
      (participantsA ?? []).forEach((participantId, idx) => {
        participantAssignments.push({
          matchId: match.id,
          participantId,
          side: "A",
          slotOrder: idx,
        });
      });
      (participantsB ?? []).forEach((participantId, idx) => {
        participantAssignments.push({
          matchId: match.id,
          participantId,
          side: "B",
          slotOrder: idx,
        });
      });
    } else {
      const sourcePairingIds = [pairingAId, pairingBId].filter((id): id is number => typeof id === "number");
      const pairingDetails = sourcePairingIds.length
        ? await tx.padelPairing.findMany({
            where: { id: { in: sourcePairingIds } },
            select: {
              id: true,
              categoryId: true,
              slots: {
                orderBy: { id: "asc" },
                select: { playerProfileId: true },
              },
            },
          })
        : [];
      const pairingById = new Map(pairingDetails.map((row) => [row.id, row]));

      const assignSide = async (pairingId: number | null, side: PadelMatchSide) => {
        if (!pairingId) return;
        const pairing = pairingById.get(pairingId);
        if (!pairing) return;
        const targetCategoryId = match.categoryId ?? pairing.categoryId ?? null;
        const playerProfileIds = pairing.slots
          .map((slot) => slot.playerProfileId)
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
        for (let idx = 0; idx < playerProfileIds.length; idx += 1) {
          const playerProfileId = playerProfileIds[idx];
          const participant =
            targetCategoryId !== null
              ? await tx.padelTournamentParticipant.upsert({
                  where: {
                    eventId_categoryId_playerProfileId: {
                      eventId: match.eventId,
                      categoryId: targetCategoryId,
                      playerProfileId,
                    },
                  },
                  update: {
                    sourcePairingId: pairing.id,
                    status: "ACTIVE",
                  },
                  create: {
                    eventId: match.eventId,
                    categoryId: targetCategoryId,
                    organizationId,
                    playerProfileId,
                    sourcePairingId: pairing.id,
                    status: "ACTIVE",
                  },
                  select: { id: true },
                })
              : await (async () => {
                  const existing = await tx.padelTournamentParticipant.findFirst({
                    where: { eventId: match.eventId, categoryId: null, playerProfileId },
                    select: { id: true },
                  });
                  if (existing) {
                    await tx.padelTournamentParticipant.update({
                      where: { id: existing.id },
                      data: { sourcePairingId: pairing.id, status: "ACTIVE" },
                    });
                    return existing;
                  }
                  return tx.padelTournamentParticipant.create({
                    data: {
                      eventId: match.eventId,
                      categoryId: null,
                      organizationId,
                      playerProfileId,
                      sourcePairingId: pairing.id,
                      status: "ACTIVE",
                    },
                    select: { id: true },
                  });
                })();
          participantAssignments.push({
            matchId: match.id,
            participantId: participant.id,
            side,
            slotOrder: idx,
          });
        }
      };

      await assignSide(pairingAId ?? null, "A");
      await assignSide(pairingBId ?? null, "B");
    }

    if (participantAssignments.length > 0) {
      await tx.padelMatchParticipant.createMany({
        data: participantAssignments,
        skipDuplicates: true,
      });
    }

    return updatedMatch;
  });

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: match.eventId },
    select: { advancedSettings: true },
  });
  if (config) {
    const advanced = (config.advancedSettings as Record<string, unknown>) ?? {};
    await prisma.padelTournamentConfig.update({
      where: { eventId: match.eventId },
      data: {
        advancedSettings: {
          ...advanced,
          koManual: true,
          koManualAt: new Date().toISOString(),
        },
      },
    });
  }

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_ASSIGN",
    metadata: {
      matchId: match.id,
      eventId: match.eventId,
      pairingAId: pairingAId ?? null,
      pairingBId: pairingBId ?? null,
      participantsA: hasParticipantsPayload ? (participantsA ?? []) : null,
      participantsB: hasParticipantsPayload ? (participantsB ?? []) : null,
      winnerParticipantId: updated.winnerParticipantId ?? null,
      winnerSide: updated.winnerSide ?? null,
    },
  });

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
