import { prisma } from "@/lib/prisma";

export const OUTBOX_MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;
const BASE_BACKOFF_MS = 5 * 60 * 1000;
const CLAIM_LOCK_MS = 60 * 1000;

function computeBackoffMs(attempts: number) {
  const backoff = attempts * BASE_BACKOFF_MS;
  return Math.min(backoff, 30 * 60 * 1000);
}

export async function publishOutboxBatch(params?: { now?: Date; batchSize?: number }) {
  const now = params?.now ?? new Date();
  const batchSize = params?.batchSize ?? BATCH_SIZE;

  const pending = await prisma.outboxEvent.findMany({
    where: {
      publishedAt: null,
      deadLetteredAt: null,
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  const results: { eventId: string; status: "PUBLISHED" | "RETRY" | "DEAD_LETTER" }[] = [];

  for (const event of pending) {
    const lockUntil = new Date(now.getTime() + CLAIM_LOCK_MS);
    let claimCount = 0;
    if (typeof prisma.outboxEvent.updateMany === "function") {
      const claim = await prisma.outboxEvent.updateMany({
        where: {
          eventId: event.eventId,
          publishedAt: null,
          deadLetteredAt: null,
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        data: { nextAttemptAt: lockUntil },
      });
      claimCount = claim.count;
    } else {
      await prisma.outboxEvent.update({
        where: { eventId: event.eventId },
        data: { nextAttemptAt: lockUntil },
      });
      claimCount = 1;
    }
    if (claimCount === 0) continue;

    if (event.attempts >= OUTBOX_MAX_ATTEMPTS) {
      await prisma.outboxEvent.update({
        where: { eventId: event.eventId },
        data: { deadLetteredAt: now, nextAttemptAt: null },
      });
      console.warn("[outbox] dead-letter", {
        eventId: event.eventId,
        eventType: event.eventType,
        attempts: event.attempts,
        correlationId: event.correlationId ?? null,
        registrationId:
          event.payload && typeof event.payload === "object"
            ? (event.payload as Record<string, unknown>).registrationId ?? null
            : null,
      });
      results.push({ eventId: event.eventId, status: "DEAD_LETTER" });
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.operation.upsert({
          where: { dedupeKey: `outbox:${event.eventId}` },
          update: {},
          create: {
            operationType: "OUTBOX_EVENT",
            dedupeKey: `outbox:${event.eventId}`,
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
          data: { publishedAt: now, nextAttemptAt: null },
        });
      });
      console.info("[outbox] published", {
        eventId: event.eventId,
        eventType: event.eventType,
        attempts: event.attempts,
        correlationId: event.correlationId ?? null,
        registrationId:
          event.payload && typeof event.payload === "object"
            ? (event.payload as Record<string, unknown>).registrationId ?? null
            : null,
      });
      results.push({ eventId: event.eventId, status: "PUBLISHED" });
    } catch (err) {
      const attempts = event.attempts + 1;
      const isDead = attempts >= OUTBOX_MAX_ATTEMPTS;
      await prisma.outboxEvent.update({
        where: { eventId: event.eventId },
        data: {
          attempts,
          nextAttemptAt: isDead ? null : new Date(now.getTime() + computeBackoffMs(attempts)),
          deadLetteredAt: isDead ? now : null,
        },
      });
      console.warn("[outbox] publish failed", {
        eventId: event.eventId,
        eventType: event.eventType,
        attempts,
        correlationId: event.correlationId ?? null,
        registrationId:
          event.payload && typeof event.payload === "object"
            ? (event.payload as Record<string, unknown>).registrationId ?? null
            : null,
        deadLettered: isDead,
      });
      results.push({ eventId: event.eventId, status: isDead ? "DEAD_LETTER" : "RETRY" });
    }
  }

  return results;
}
