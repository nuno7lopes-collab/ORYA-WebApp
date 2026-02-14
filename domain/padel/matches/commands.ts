import crypto from "crypto";
import { EventMatchSlot, Prisma, PrismaClient, SourceType } from "@prisma/client";
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
    },
): Promise<MatchCommandResult<EventMatchSlot>> {
  const eventType = input.eventType ?? DEFAULT_UPDATED_EVENT;
  const outboxEventType = input.outboxEventType ?? eventType;

  return withTx(input.tx, async (tx) => {
    const updated = (await tx.eventMatchSlot.update({
      where: { id: input.matchId },
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
        matchId: input.matchId,
        eventId: input.eventId,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        beforeStatus: input.beforeStatus ?? null,
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
