import { prisma } from "@/lib/prisma";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

export const OUTBOX_MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;
const BASE_BACKOFF_MS = 5 * 60 * 1000;
const STALE_CLAIM_MS = 15 * 60 * 1000;

function computeBackoffMs(attempts: number) {
  const backoff = attempts * BASE_BACKOFF_MS;
  return Math.min(backoff, 30 * 60 * 1000);
}

export async function publishOutboxBatch(params?: { now?: Date; batchSize?: number }) {
  const now = params?.now ?? new Date();
  const batchSize = params?.batchSize ?? BATCH_SIZE;

  const results: { eventId: string; status: "PUBLISHED" | "RETRY" | "DEAD_LETTER" }[] = [];

  for (let i = 0; i < batchSize; i += 1) {
    const outcome = await prisma.$transaction(async (tx) => {
      const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
      const rows = await tx.$queryRaw<
        Array<{
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
        }>
      >(
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
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `,
      );

      if (!rows.length) return null;
      const event = rows[0];
      const processingToken = crypto.randomUUID();
      const claimedAt = now;
      const operationKey = `outbox:${event.eventId}`;

      if (event.attempts >= OUTBOX_MAX_ATTEMPTS) {
        await tx.outboxEvent.update({
          where: { eventId: event.eventId },
          data: { deadLetteredAt: now, nextAttemptAt: null, processingToken, claimedAt },
        });
        logWarn(
          "outbox.dead-letter",
          {
            eventId: event.eventId,
            eventType: event.eventType,
            attempts: event.attempts,
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
            await tx.outboxEvent.update({
              where: { eventId: event.eventId },
              data: {
                publishedAt: existingOp.updatedAt ?? now,
                nextAttemptAt: null,
                processingToken,
                claimedAt,
              },
            });
            logInfo(
              "outbox.already-succeeded",
              {
                eventId: event.eventId,
                eventType: event.eventType,
                attempts: event.attempts,
                correlationId: event.correlationId ?? null,
              },
              { fallbackToRequestContext: false },
            );
            return { eventId: event.eventId, status: "PUBLISHED" as const };
          }
          if (existingOp.status === "DEAD_LETTER") {
            await tx.outboxEvent.update({
              where: { eventId: event.eventId },
              data: { deadLetteredAt: now, nextAttemptAt: null, processingToken, claimedAt },
            });
            logWarn(
              "outbox.dead-letter",
              {
                eventId: event.eventId,
                eventType: event.eventType,
                attempts: event.attempts,
                correlationId: event.correlationId ?? null,
              },
              { fallbackToRequestContext: false },
            );
            return { eventId: event.eventId, status: "DEAD_LETTER" as const };
          }

          await tx.outboxEvent.update({
            where: { eventId: event.eventId },
            data: {
              nextAttemptAt: new Date(now.getTime() + computeBackoffMs(Math.max(1, event.attempts))),
              processingToken,
              claimedAt,
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

        await tx.outboxEvent.update({
          where: { eventId: event.eventId },
          data: {
            nextAttemptAt: new Date(now.getTime() + computeBackoffMs(Math.max(1, event.attempts))),
            processingToken,
            claimedAt,
          },
        });

        logInfo(
          "outbox.enqueued",
          {
            eventId: event.eventId,
            eventType: event.eventType,
            attempts: event.attempts,
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
        const attempts = event.attempts + 1;
        const isDead = attempts >= OUTBOX_MAX_ATTEMPTS;
        await tx.outboxEvent.update({
          where: { eventId: event.eventId },
          data: {
            attempts,
            nextAttemptAt: isDead ? null : new Date(now.getTime() + computeBackoffMs(attempts)),
            deadLetteredAt: isDead ? now : null,
            processingToken,
            claimedAt,
          },
        });
        logWarn(
          "outbox.publish-failed",
          {
            eventId: event.eventId,
            eventType: event.eventType,
            attempts,
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

    if (!outcome) break;
    results.push(outcome);
  }

  return results;
}
