import { prisma } from "@/lib/prisma";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

export const OUTBOX_MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 50;
const LOOKAHEAD_MULTIPLIER = 5;
const BASE_BACKOFF_MS = 5 * 60 * 1000;
const STALE_CLAIM_MS = 15 * 60 * 1000;

type OutboxCandidate = {
  eventId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
  publishedAt: Date | null;
  attempts: number;
  nextAttemptAt: Date | null;
  causationId: string | null;
  correlationId: string | null;
  deadLetteredAt: Date | null;
};

type OutboxOutcome = { eventId: string; status: "PUBLISHED" | "RETRY" | "DEAD_LETTER" | "SKIPPED" };

function resolveBatchSize(override?: number) {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) return override;
  const parsed = Number(process.env.OUTBOX_PUBLISH_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE;
  return parsed;
}

function resolveLookahead(batchSize: number) {
  const multiplier = Number(process.env.OUTBOX_PUBLISH_LOOKAHEAD_MULTIPLIER ?? LOOKAHEAD_MULTIPLIER);
  if (!Number.isFinite(multiplier) || multiplier <= 0) return batchSize;
  return Math.max(batchSize, Math.ceil(batchSize * multiplier));
}

function computeBackoffMs(attempts: number) {
  const backoff = attempts * BASE_BACKOFF_MS;
  return Math.min(backoff, 30 * 60 * 1000);
}

export function buildFairOutboxBatch(events: OutboxCandidate[], batchSize: number) {
  if (events.length <= batchSize) return [...events];
  const buckets = new Map<string, OutboxCandidate[]>();
  for (const event of events) {
    const bucket = buckets.get(event.eventType) ?? [];
    bucket.push(event);
    buckets.set(event.eventType, bucket);
  }

  const typeOrder = Array.from(buckets.entries())
    .map(([eventType, items]) => ({
      eventType,
      createdAt: items[0]?.createdAt ?? new Date(0),
    }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.eventType.localeCompare(b.eventType));

  const result: OutboxCandidate[] = [];
  let added = true;
  while (result.length < batchSize && added) {
    added = false;
    for (const { eventType } of typeOrder) {
      const bucket = buckets.get(eventType);
      if (!bucket || bucket.length === 0) continue;
      result.push(bucket.shift() as OutboxCandidate);
      added = true;
      if (result.length >= batchSize) break;
    }
  }
  return result;
}

async function processClaimedOutboxEvent(params: {
  event: OutboxCandidate;
  processingToken: string;
  now: Date;
}): Promise<OutboxOutcome> {
  const { event, processingToken, now } = params;
  const operationKey = `outbox:${event.eventId}`;

  return prisma.$transaction(async (tx) => {
    const current = await tx.outboxEvent.findUnique({
      where: { eventId: event.eventId },
      select: { processingToken: true, attempts: true },
    });
    if (!current || current.processingToken !== processingToken) {
      return { eventId: event.eventId, status: "SKIPPED" as const };
    }

    const attempts = current.attempts ?? event.attempts;
    if (attempts >= OUTBOX_MAX_ATTEMPTS) {
      const update = await tx.outboxEvent.updateMany({
        where: { eventId: event.eventId, processingToken },
        data: { deadLetteredAt: now, nextAttemptAt: null },
      });
      if (update.count === 0) {
        return { eventId: event.eventId, status: "SKIPPED" as const };
      }
      logWarn(
        "outbox.dead-letter",
        {
          eventId: event.eventId,
          eventType: event.eventType,
          attempts,
          correlationId: event.correlationId ?? null,
          registrationId:
            event.payload && typeof event.payload === "object"
              ? (event.payload as Record<string, unknown>).registrationId ?? null
              : null,
        },
        { fallbackToRequestContext: false },
      );
      return { eventId: event.eventId, status: "DEAD_LETTER" as const };
    }

    try {
      const existingOp = await tx.operation.findUnique({
        where: { dedupeKey: operationKey },
        select: { status: true, updatedAt: true },
      });

      if (existingOp) {
        if (existingOp.status === "SUCCEEDED") {
          const update = await tx.outboxEvent.updateMany({
            where: { eventId: event.eventId, processingToken },
            data: {
              publishedAt: existingOp.updatedAt ?? now,
              nextAttemptAt: null,
            },
          });
          if (update.count === 0) {
            return { eventId: event.eventId, status: "SKIPPED" as const };
          }
          logInfo(
            "outbox.already-succeeded",
            {
              eventId: event.eventId,
              eventType: event.eventType,
              attempts,
              correlationId: event.correlationId ?? null,
            },
            { fallbackToRequestContext: false },
          );
          return { eventId: event.eventId, status: "PUBLISHED" as const };
        }
        if (existingOp.status === "DEAD_LETTER") {
          const update = await tx.outboxEvent.updateMany({
            where: { eventId: event.eventId, processingToken },
            data: { deadLetteredAt: now, nextAttemptAt: null },
          });
          if (update.count === 0) {
            return { eventId: event.eventId, status: "SKIPPED" as const };
          }
          logWarn(
            "outbox.dead-letter",
            {
              eventId: event.eventId,
              eventType: event.eventType,
              attempts,
              correlationId: event.correlationId ?? null,
            },
            { fallbackToRequestContext: false },
          );
          return { eventId: event.eventId, status: "DEAD_LETTER" as const };
        }

        await tx.outboxEvent.updateMany({
          where: { eventId: event.eventId, processingToken },
          data: {
            nextAttemptAt: new Date(now.getTime() + computeBackoffMs(Math.max(1, attempts))),
          },
        });
        return { eventId: event.eventId, status: "RETRY" as const };
      }

      await tx.operation.create({
        data: {
          operationType: "OUTBOX_EVENT",
          dedupeKey: operationKey,
          status: "PENDING",
          payload: {
            eventId: event.eventId,
            eventType: event.eventType,
            payload: event.payload,
            causationId: event.causationId,
            correlationId: event.correlationId,
          },
        },
      });

      await tx.outboxEvent.updateMany({
        where: { eventId: event.eventId, processingToken },
        data: {
          nextAttemptAt: new Date(now.getTime() + computeBackoffMs(Math.max(1, attempts))),
        },
      });

      logInfo(
        "outbox.enqueued",
        {
          eventId: event.eventId,
          eventType: event.eventType,
          attempts,
          correlationId: event.correlationId ?? null,
          registrationId:
            event.payload && typeof event.payload === "object"
              ? (event.payload as Record<string, unknown>).registrationId ?? null
              : null,
        },
        { fallbackToRequestContext: false },
      );
      return { eventId: event.eventId, status: "RETRY" as const };
    } catch (err) {
      const nextAttempts = attempts + 1;
      const isDead = nextAttempts >= OUTBOX_MAX_ATTEMPTS;
      await tx.outboxEvent.updateMany({
        where: { eventId: event.eventId, processingToken },
        data: {
          attempts: nextAttempts,
          nextAttemptAt: isDead ? null : new Date(now.getTime() + computeBackoffMs(nextAttempts)),
          deadLetteredAt: isDead ? now : null,
        },
      });
      logWarn(
        "outbox.publish-failed",
        {
          eventId: event.eventId,
          eventType: event.eventType,
          attempts: nextAttempts,
          correlationId: event.correlationId ?? null,
          registrationId:
            event.payload && typeof event.payload === "object"
              ? (event.payload as Record<string, unknown>).registrationId ?? null
              : null,
          deadLettered: isDead,
        },
        { fallbackToRequestContext: false },
      );
      const status: "DEAD_LETTER" | "RETRY" = isDead ? "DEAD_LETTER" : "RETRY";
      return { eventId: event.eventId, status };
    }
  });
}

export async function publishOutboxBatch(params?: { now?: Date; batchSize?: number }) {
  const now = params?.now ?? new Date();
  const batchSize = resolveBatchSize(params?.batchSize);
  if (batchSize <= 0) return [];

  const lookahead = resolveLookahead(batchSize);
  const claimed = await prisma.$transaction(async (tx) => {
    const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
    const candidates = await tx.$queryRaw<OutboxCandidate[]>(
      Prisma.sql`
        SELECT
          event_id as "eventId",
          event_type as "eventType",
          payload,
          created_at as "createdAt",
          published_at as "publishedAt",
          attempts,
          next_attempt_at as "nextAttemptAt",
          causation_id as "causationId",
          correlation_id as "correlationId",
          dead_lettered_at as "deadLetteredAt"
        FROM app_v3.outbox_events
        WHERE published_at IS NULL
          AND dead_lettered_at IS NULL
          AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
          AND (claimed_at IS NULL OR claimed_at <= ${staleBefore})
        ORDER BY created_at ASC, event_id ASC
        LIMIT ${lookahead}
        FOR UPDATE SKIP LOCKED
      `,
    );

    if (!candidates.length) return { processingToken: null, events: [] as OutboxCandidate[] };
    const events = buildFairOutboxBatch(candidates, batchSize);
    if (!events.length) return { processingToken: null, events: [] as OutboxCandidate[] };

    const processingToken = crypto.randomUUID();
    await tx.outboxEvent.updateMany({
      where: { eventId: { in: events.map((event) => event.eventId) } },
      data: { processingToken, claimedAt: now },
    });
    return { processingToken, events };
  });

  if (!claimed.processingToken || claimed.events.length === 0) {
    logInfo("outbox.batch.empty", { batchSize }, { fallbackToRequestContext: false });
    return [];
  }

  const results: OutboxOutcome[] = [];
  let published = 0;
  let retry = 0;
  let deadLettered = 0;
  let skipped = 0;

  for (const event of claimed.events) {
    const outcome = await processClaimedOutboxEvent({
      event,
      processingToken: claimed.processingToken,
      now,
    });
    results.push(outcome);
    if (outcome.status === "PUBLISHED") published += 1;
    if (outcome.status === "RETRY") retry += 1;
    if (outcome.status === "DEAD_LETTER") deadLettered += 1;
    if (outcome.status === "SKIPPED") skipped += 1;
  }

  logInfo(
    "outbox.batch",
    {
      batchSize,
      claimed: claimed.events.length,
      published,
      retry,
      deadLettered,
      skipped,
    },
    { fallbackToRequestContext: false },
  );

  return results;
}
