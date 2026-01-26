import { Prisma, SourceType } from "@prisma/client";
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
  const outbox = await recordOutboxEvent(
    {
      eventType: params.outboxEventType,
      payload: params.payload,
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
      payload: params.payload,
    },
    params.tx,
  );

  return outbox.eventId;
}

export async function createPadelMatch(
  input: MatchCommandBase &
    MatchCommandTx & {
      data: Prisma.PadelMatchCreateInput | Prisma.PadelMatchUncheckedCreateInput;
      select?: Prisma.PadelMatchSelect;
      include?: Prisma.PadelMatchInclude;
    },
): Promise<MatchCommandResult<unknown>> {
  const eventType = input.eventType ?? DEFAULT_CREATED_EVENT;
  const outboxEventType = input.outboxEventType ?? eventType;

  return withTx(input.tx, async (tx) => {
    const created = await tx.padelMatch.create({
      data: input.data,
      ...(input.select ? { select: input.select } : {}),
      ...(input.include ? { include: input.include } : {}),
    });

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
      data: Prisma.PadelMatchUpdateInput | Prisma.PadelMatchUncheckedUpdateInput;
      beforeStatus?: string | null;
      select?: Prisma.PadelMatchSelect;
      include?: Prisma.PadelMatchInclude;
    },
): Promise<MatchCommandResult<unknown>> {
  const eventType = input.eventType ?? DEFAULT_UPDATED_EVENT;
  const outboxEventType = input.outboxEventType ?? eventType;

  return withTx(input.tx, async (tx) => {
    const updated = await tx.padelMatch.update({
      where: { id: input.matchId },
      data: input.data,
      ...(input.select ? { select: input.select } : {}),
      ...(input.include ? { include: input.include } : {}),
    });

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
    await tx.padelMatch.delete({ where: { id: input.matchId } });

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
