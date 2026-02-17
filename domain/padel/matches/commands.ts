import crypto from "crypto";
import {
  EventMatchSlot,
  PadelMatchResultCard,
  PadelMatchResultCardStatus,
  PadelMatchSide,
  Prisma,
  PrismaClient,
  SourceType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";

type MatchCommandBase = {
  eventId: number;
  organizationId: number;
  actorUserId: string | null;
  correlationId?: string | null;
  eventType?: string;
  outboxEventType?: string;
};

type MatchCommandTx = {
  tx?: Prisma.TransactionClient;
};

type MatchCommandResult<T> = { match: T; outboxEventId: string };

const DEFAULT_UPDATED_EVENT = "PADEL_MATCH_UPDATED";
const DEFAULT_CREATED_EVENT = "PADEL_MATCH_GENERATED";
const DEFAULT_DELETED_EVENT = "PADEL_MATCH_DELETED";
const DEFAULT_RESULT_CARD_UPDATED_EVENT = "PADEL_MATCH_RESULT_CARD_UPDATED";
const DEFAULT_RESULT_CARD_CONFLICT_EVENT = "PADEL_MATCH_RESULT_CARD_CONFLICT";
const RATING_REBUILD_EVENT = "PADEL_RATING_REBUILD_REQUESTED";
const RESULT_MUTATION_KEYS = new Set(["score", "scoreSets", "winnerSide", "winnerPairingId", "winnerParticipantId"]);
const COUNTED_RATING_STATUSES = new Set(["OFFICIAL", "WALKOVER", "RETIRED"]);

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(obj[key]);
        return acc;
      }, {});
  }
  if (value instanceof Date) return value.toISOString();
  return value;
};

const hashPayload = (payload: Record<string, unknown>) =>
  crypto.createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");

const buildMatchDedupeKey = (eventType: string, payload: Record<string, unknown>) =>
  `padel_match:${eventType}:${payload.matchId ?? "unknown"}:${hashPayload(payload)}`;

const buildRatingRebuildDedupeKey = (payload: Record<string, unknown>) =>
  `padel_rating_rebuild:${payload.eventId ?? "unknown"}:${payload.matchId ?? "unknown"}:${hashPayload(payload)}`;

async function withTx<T>(
  tx: Prisma.TransactionClient | undefined,
  fn: (client: Prisma.TransactionClient) => Promise<T>,
) {
  if (tx) return fn(tx);
  return prisma.$transaction(fn);
}

async function recordMatchEvent(params: {
  tx: Prisma.TransactionClient;
  eventType: string;
  outboxEventType: string;
  organizationId: number;
  actorUserId: string | null;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}) {
  const payload = params.payload as Prisma.InputJsonValue;
  const dedupeKey = buildMatchDedupeKey(params.outboxEventType, params.payload);
  const outbox = await recordOutboxEvent(
    {
      eventType: params.outboxEventType,
      dedupeKey,
      payload,
    },
    params.tx,
  );

  await appendEventLog(
    {
      eventId: outbox.eventId,
      organizationId: params.organizationId,
      eventType: params.eventType,
      idempotencyKey: outbox.eventId,
      actorUserId: params.actorUserId,
      sourceType: SourceType.MATCH,
      sourceId: String(params.payload.matchId ?? ""),
      correlationId: params.correlationId ?? outbox.eventId,
      payload,
    },
    params.tx,
  );

  return outbox.eventId;
}

const isResultMutationData = (
  data: Prisma.EventMatchSlotUpdateInput | Prisma.EventMatchSlotUncheckedUpdateInput,
) => {
  const payload = data as Record<string, unknown>;
  const hasResultField = Object.keys(payload).some((key) => RESULT_MUTATION_KEYS.has(key));
  if (hasResultField) return true;
  if (!Object.prototype.hasOwnProperty.call(payload, "status")) return false;

  const status = payload.status;
  if (typeof status === "string") return true;
  if (status && typeof status === "object" && "set" in status) {
    return true;
  }
  return false;
};

const resolveStatusFromUpdateData = (
  data: Prisma.EventMatchSlotUpdateInput | Prisma.EventMatchSlotUncheckedUpdateInput,
) => {
  const payload = data as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(payload, "status")) return null;
  const status = payload.status;
  if (typeof status === "string") return status;
  if (status && typeof status === "object" && "set" in status) {
    const setStatus = (status as { set?: unknown }).set;
    return typeof setStatus === "string" ? setStatus : null;
  }
  return null;
};

const isCountedRatingStatus = (status: string | null | undefined) =>
  typeof status === "string" && COUNTED_RATING_STATUSES.has(status);

const resolveRatingRebuildReason = (params: {
  data: Prisma.EventMatchSlotUpdateInput | Prisma.EventMatchSlotUncheckedUpdateInput;
  beforeStatus: string | null;
  afterStatus: string | null;
}) => {
  const { data, beforeStatus, afterStatus } = params;
  const touchesResultData = Object.keys(data as Record<string, unknown>).some((key) => RESULT_MUTATION_KEYS.has(key));
  const beforeIsCounted = isCountedRatingStatus(beforeStatus);
  const afterIsCounted = isCountedRatingStatus(afterStatus);
  if (beforeIsCounted !== afterIsCounted) return "COUNTED_STATUS_TRANSITION";
  if (touchesResultData && (beforeIsCounted || afterIsCounted)) return "COUNTED_RESULT_CORRECTION";
  return null;
};

async function resolveConfirmedResultCardForWrite(params: {
  tx: Prisma.TransactionClient;
  matchId: number;
  requireConfirmedResultCard: boolean;
  resultCardId?: string | null;
}) {
  if (!params.requireConfirmedResultCard) return null;
  if (!params.resultCardId) throw new Error("MATCH_RESULT_CARD_REQUIRED");

  const card = await params.tx.padelMatchResultCard.findUnique({
    where: { id: params.resultCardId },
    select: { id: true, matchId: true, status: true, appliedAt: true },
  });
  if (!card || card.matchId !== params.matchId) {
    throw new Error("MATCH_RESULT_CARD_NOT_FOUND");
  }
  if (card.status !== PadelMatchResultCardStatus.CONFIRMED) {
    throw new Error("MATCH_RESULT_CARD_NOT_CONFIRMED");
  }

  return card;
}

export async function createPadelMatch(
  input: MatchCommandBase &
    MatchCommandTx & {
      data: Prisma.EventMatchSlotCreateInput | Prisma.EventMatchSlotUncheckedCreateInput;
      select?: Prisma.EventMatchSlotSelect;
      include?: Prisma.EventMatchSlotInclude;
    },
): Promise<MatchCommandResult<EventMatchSlot>> {
  const eventType = input.eventType ?? DEFAULT_CREATED_EVENT;
  const outboxEventType = input.outboxEventType ?? eventType;

  return withTx(input.tx, async (tx) => {
    const created = (await tx.eventMatchSlot.create({
      data: input.data,
      ...(input.select ? { select: input.select } : {}),
      ...(input.include ? { include: input.include } : {}),
    })) as EventMatchSlot;

    const outboxEventId = await recordMatchEvent({
      tx,
      eventType,
      outboxEventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      payload: {
        matchId: (created as { id?: number }).id,
        eventId: input.eventId,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
      },
    });

    return { match: created, outboxEventId };
  });
}

export async function updatePadelMatch(
  input: MatchCommandBase &
    MatchCommandTx & {
      matchId: number;
      data: Prisma.EventMatchSlotUpdateInput | Prisma.EventMatchSlotUncheckedUpdateInput;
      beforeStatus?: string | null;
      select?: Prisma.EventMatchSlotSelect;
      include?: Prisma.EventMatchSlotInclude;
      requireConfirmedResultCard?: boolean;
      resultCardId?: string | null;
    },
): Promise<MatchCommandResult<EventMatchSlot>> {
  const eventType = input.eventType ?? DEFAULT_UPDATED_EVENT;
  const outboxEventType = input.outboxEventType ?? eventType;

  return withTx(input.tx, async (tx) => {
    const isResultMutation = isResultMutationData(input.data);
    let resolvedBeforeStatus = input.beforeStatus ?? null;
    if (!resolvedBeforeStatus && isResultMutation) {
      const current = await tx.eventMatchSlot.findUnique({
        where: { id: input.matchId },
        select: { status: true },
      });
      resolvedBeforeStatus = current?.status ?? null;
    }
    const resultCard = await resolveConfirmedResultCardForWrite({
      tx,
      matchId: input.matchId,
      requireConfirmedResultCard: Boolean(input.requireConfirmedResultCard && isResultMutation),
      resultCardId: input.resultCardId ?? null,
    });

    const updated = (await tx.eventMatchSlot.update({
      where: { id: input.matchId },
      data: input.data,
      ...(input.select ? { select: input.select } : {}),
      ...(input.include ? { include: input.include } : {}),
    })) as EventMatchSlot;

    if (resultCard && !resultCard.appliedAt) {
      await tx.padelMatchResultCard.update({
        where: { id: resultCard.id },
        data: { appliedAt: new Date() },
      });
    }

    if (isResultMutation) {
      const requestedAt = new Date().toISOString();
      const resolvedAfterStatus =
        resolveStatusFromUpdateData(input.data) ??
        ((updated as { status?: string | null }).status ?? null) ??
        resolvedBeforeStatus;
      const reasonCode = resolveRatingRebuildReason({
        data: input.data,
        beforeStatus: resolvedBeforeStatus,
        afterStatus: resolvedAfterStatus,
      });
      if (reasonCode) {
        const ratingPayload = {
          eventId: input.eventId,
          organizationId: input.organizationId,
          matchId: input.matchId,
          actorUserId: input.actorUserId,
          beforeStatus: resolvedBeforeStatus,
          reasonCode,
          requestedAt,
        } satisfies Record<string, unknown>;
        await recordOutboxEvent(
          {
            eventType: RATING_REBUILD_EVENT,
            dedupeKey: buildRatingRebuildDedupeKey(ratingPayload),
            payload: ratingPayload as Prisma.InputJsonValue,
          },
          tx,
        );
      }
    }

    const outboxEventId = await recordMatchEvent({
      tx,
      eventType,
      outboxEventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      payload: {
        matchId: input.matchId,
        eventId: input.eventId,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        beforeStatus: resolvedBeforeStatus,
      },
    });

    return { match: updated, outboxEventId };
  });
}

export async function deletePadelMatch(
  input: MatchCommandBase &
    MatchCommandTx & {
      matchId: number;
    },
): Promise<{ outboxEventId: string }> {
  const eventType = input.eventType ?? DEFAULT_DELETED_EVENT;
  const outboxEventType = input.outboxEventType ?? eventType;

  return withTx(input.tx, async (tx) => {
    await tx.eventMatchSlot.delete({ where: { id: input.matchId } });

    const outboxEventId = await recordMatchEvent({
      tx,
      eventType,
      outboxEventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      payload: {
        matchId: input.matchId,
        eventId: input.eventId,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
      },
    });

    return { outboxEventId };
  });
}

export async function reassignWinnerParticipantOnMatchSlots(params: {
  tx: Prisma.TransactionClient | PrismaClient;
  sourceParticipantId: number;
  targetParticipantId: number;
}) {
  const { tx, sourceParticipantId, targetParticipantId } = params;
  return tx.eventMatchSlot.updateMany({
    where: { winnerParticipantId: sourceParticipantId },
    data: { winnerParticipantId: targetParticipantId },
  });
}

export async function submitPadelMatchResultCard(
  input: MatchCommandBase &
    MatchCommandTx & {
      matchId: number;
      side: PadelMatchSide;
      payload: Record<string, unknown>;
      actorUserId: string;
    },
): Promise<{ card: PadelMatchResultCard; conflict: boolean; outboxEventId: string }> {
  const eventType = input.eventType ?? DEFAULT_RESULT_CARD_UPDATED_EVENT;
  const outboxEventType = input.outboxEventType ?? eventType;
  const now = new Date();
  const payloadHash = hashPayload(input.payload);

  return withTx(input.tx, async (tx) => {
    const existingPending = await tx.padelMatchResultCard.findMany({
      where: {
        matchId: input.matchId,
        status: PadelMatchResultCardStatus.PENDING_SIGNATURES,
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const conflicting = existingPending.find((card) => card.payloadHash !== payloadHash);
    if (conflicting) {
      await tx.padelMatchResultCard.updateMany({
        where: {
          matchId: input.matchId,
          status: PadelMatchResultCardStatus.PENDING_SIGNATURES,
        },
        data: {
          status: PadelMatchResultCardStatus.CONFLICTED,
          conflictAt: now,
        },
      });

      const conflictCard = await tx.padelMatchResultCard.create({
        data: {
          matchId: input.matchId,
          organizationId: input.organizationId,
          eventId: input.eventId,
          submittedByUserId: input.actorUserId,
          payload: input.payload as Prisma.InputJsonValue,
          payloadHash,
          status: PadelMatchResultCardStatus.CONFLICTED,
          conflictAt: now,
        },
      });
      await tx.padelMatchResultSignature.create({
        data: {
          resultCardId: conflictCard.id,
          side: input.side,
          userId: input.actorUserId,
        },
      });

      const currentMatch = await tx.eventMatchSlot.findUnique({
        where: { id: input.matchId },
        select: { score: true },
      });
      const previousScore =
        currentMatch?.score && typeof currentMatch.score === "object"
          ? (currentMatch.score as Record<string, unknown>)
          : {};
      await tx.eventMatchSlot.update({
        where: { id: input.matchId },
        data: {
          score: {
            ...previousScore,
            disputeStatus: "OPEN",
            disputeReason: "RESULT_HASH_CONFLICT",
            disputedAt: now.toISOString(),
            disputedBy: input.actorUserId,
          },
        },
      });

      const outboxEventId = await recordMatchEvent({
        tx,
        eventType: DEFAULT_RESULT_CARD_CONFLICT_EVENT,
        outboxEventType: DEFAULT_RESULT_CARD_CONFLICT_EVENT,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        payload: {
          matchId: input.matchId,
          eventId: input.eventId,
          organizationId: input.organizationId,
          resultCardId: conflictCard.id,
          status: conflictCard.status,
          payloadHash,
        },
      });

      return { card: conflictCard, conflict: true, outboxEventId };
    }

    const baseCard =
      existingPending.find((card) => card.payloadHash === payloadHash) ??
      (await tx.padelMatchResultCard.create({
        data: {
          matchId: input.matchId,
          organizationId: input.organizationId,
          eventId: input.eventId,
          submittedByUserId: input.actorUserId,
          payload: input.payload as Prisma.InputJsonValue,
          payloadHash,
          status: PadelMatchResultCardStatus.PENDING_SIGNATURES,
        },
      }));

    await tx.padelMatchResultSignature.upsert({
      where: {
        resultCardId_side: {
          resultCardId: baseCard.id,
          side: input.side,
        },
      },
      update: {
        userId: input.actorUserId,
      },
      create: {
        resultCardId: baseCard.id,
        side: input.side,
        userId: input.actorUserId,
      },
    });

    const signatures = await tx.padelMatchResultSignature.findMany({
      where: { resultCardId: baseCard.id },
      select: { side: true },
    });
    const hasBothSides =
      signatures.some((signature) => signature.side === PadelMatchSide.A) &&
      signatures.some((signature) => signature.side === PadelMatchSide.B);

    const card =
      hasBothSides && baseCard.status !== PadelMatchResultCardStatus.CONFIRMED
        ? await tx.padelMatchResultCard.update({
            where: { id: baseCard.id },
            data: { status: PadelMatchResultCardStatus.CONFIRMED, confirmedAt: now },
          })
        : baseCard;

    const outboxEventId = await recordMatchEvent({
      tx,
      eventType,
      outboxEventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      payload: {
        matchId: input.matchId,
        eventId: input.eventId,
        organizationId: input.organizationId,
        resultCardId: card.id,
        status: card.status,
        payloadHash,
      },
    });

    return { card, conflict: false, outboxEventId };
  });
}
