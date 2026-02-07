import { prisma } from "@/lib/prisma";
import { logInfo, logWarn } from "@/lib/observability/logger";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

export const OUTBOX_MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 50;
const LOOKAHEAD_MULTIPLIER = 5;
const BASE_BACKOFF_MS = 5 * 60 * 1000;
const STALE_CLAIM_MS = 15 * 60 * 1000;
const DEFAULT_TX_TIMEOUT_MS = 60_000;
const DEFAULT_TX_MAX_WAIT_MS = 5_000;

type OutboxCandidate = {
  eventId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
  publishedAt: Date | null;
  attempts: number;
  nextAttemptAt: Date | null;
  reasonCode: string | null;
  errorClass: string | null;
  errorStack: string | null;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
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

function resolveTxTimeoutMs() {
  const raw = Number(process.env.OUTBOX_PUBLISH_TX_TIMEOUT_MS ?? DEFAULT_TX_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TX_TIMEOUT_MS;
  return Math.max(5_000, Math.floor(raw));
}

function resolveTxMaxWaitMs() {
  const raw = Number(process.env.OUTBOX_PUBLISH_TX_MAX_WAIT_MS ?? DEFAULT_TX_MAX_WAIT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TX_MAX_WAIT_MS;
  return Math.max(1_000, Math.floor(raw));
}

function shouldSkipOutboxTransaction() {
  if (process.env.OUTBOX_PUBLISH_SKIP_TX === "true") return true;
  const urls = [process.env.DATABASE_URL, process.env.DIRECT_URL].filter(Boolean) as string[];
  if (urls.length === 0) return false;
  for (const raw of urls) {
    try {
      const parsed = new URL(raw);
      if (parsed.port === "6543") return true;
    } catch {
      if (raw.includes(":6543")) return true;
    }
  }
  return false;
}

function summarizeError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const errorClass = err instanceof Error ? err.name : "UnknownError";
  const reasonCode =
    err && typeof err === "object" && "code" in err && typeof (err as { code?: unknown }).code === "string"
      ? String((err as { code?: unknown }).code)
      : errorClass;
  const stackSummary =
    err instanceof Error && err.stack
      ? err.stack.split("\n").slice(0, 6).join("\n")
      : null;
  return { message, errorClass, reasonCode, stackSummary };
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

  let current: { processingToken: string | null; attempts: number | null } | null = null;
  try {
    current = await prisma.outboxEvent.findUnique({
      where: { eventId: event.eventId },
      select: { processingToken: true, attempts: true },
    });
  } catch (err) {
    const { message, errorClass, reasonCode, stackSummary } = summarizeError(err);
    const attempts = typeof event.attempts === "number" ? event.attempts + 1 : 1;
    await prisma.outboxEvent.updateMany({
      where: { eventId: event.eventId, processingToken },
      data: {
        attempts,
        nextAttemptAt: new Date(now.getTime() + computeBackoffMs(attempts)),
        reasonCode,
        errorClass,
        errorStack: stackSummary,
        firstSeenAt: event.firstSeenAt ?? now,
        lastSeenAt: now,
      },
    });
    logWarn(
      "outbox.publish-failed",
      {
        eventId: event.eventId,
        eventType: event.eventType,
        attempts,
        correlationId: event.correlationId ?? null,
        errorClass,
        reasonCode,
        error: message,
      },
      { fallbackToRequestContext: false },
    );
    return { eventId: event.eventId, status: "RETRY" as const };
  }
  if (!current || current.processingToken !== processingToken) {
    return { eventId: event.eventId, status: "SKIPPED" as const };
  }

  const attempts =
    typeof current.attempts === "number"
      ? current.attempts
      : typeof event.attempts === "number"
        ? event.attempts
        : 0;

  const handleExistingOperation = async (existingOp: { status: string; updatedAt: Date | null }) => {
    if (existingOp.status === "SUCCEEDED") {
      const update = await prisma.outboxEvent.updateMany({
        where: { eventId: event.eventId, processingToken },
        data: {
          publishedAt: existingOp.updatedAt ?? now,
          nextAttemptAt: null,
          reasonCode: null,
          errorClass: null,
          errorStack: null,
          firstSeenAt: null,
          lastSeenAt: null,
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
      const firstSeenAt = event.firstSeenAt ?? now;
      const update = await prisma.outboxEvent.updateMany({
        where: { eventId: event.eventId, processingToken },
        data: {
          deadLetteredAt: now,
          nextAttemptAt: null,
          reasonCode: event.reasonCode ?? "OPERATION_DEAD_LETTER",
          errorClass: event.errorClass ?? "OutboxOperationDeadLetter",
          errorStack: event.errorStack ?? null,
          firstSeenAt,
          lastSeenAt: now,
        },
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

    await prisma.outboxEvent.updateMany({
      where: { eventId: event.eventId, processingToken },
      data: {
        nextAttemptAt: new Date(now.getTime() + computeBackoffMs(Math.max(1, attempts))),
        reasonCode: event.reasonCode ?? null,
        errorClass: event.errorClass ?? null,
        errorStack: event.errorStack ?? null,
        firstSeenAt: event.firstSeenAt ?? now,
        lastSeenAt: now,
      },
    });
    return { eventId: event.eventId, status: "RETRY" as const };
  };

  if (attempts >= OUTBOX_MAX_ATTEMPTS) {
    const firstSeenAt = event.firstSeenAt ?? now;
    const update = await prisma.outboxEvent.updateMany({
      where: { eventId: event.eventId, processingToken },
      data: {
        deadLetteredAt: now,
        nextAttemptAt: null,
        reasonCode: event.reasonCode ?? "MAX_ATTEMPTS",
        errorClass: event.errorClass ?? "OutboxMaxAttempts",
        errorStack: event.errorStack ?? null,
        firstSeenAt,
        lastSeenAt: now,
      },
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
    const existingOp = await prisma.operation.findUnique({
      where: { dedupeKey: operationKey },
      select: { status: true, updatedAt: true },
    });
    if (existingOp) {
      return await handleExistingOperation(existingOp);
    }

    try {
      await prisma.operation.create({
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
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const op = await prisma.operation.findUnique({
          where: { dedupeKey: operationKey },
          select: { status: true, updatedAt: true },
        });
        if (op) {
          return await handleExistingOperation(op);
        }
      }
      throw err;
    }

    const update = await prisma.outboxEvent.updateMany({
      where: { eventId: event.eventId, processingToken },
      data: {
        nextAttemptAt: new Date(now.getTime() + computeBackoffMs(Math.max(1, attempts))),
      },
    });
    if (update.count === 0) {
      return { eventId: event.eventId, status: "SKIPPED" as const };
    }

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
    const { message, errorClass, reasonCode, stackSummary } = summarizeError(err);
    const nextAttempts = attempts + 1;
    const isDead = nextAttempts >= OUTBOX_MAX_ATTEMPTS;
    const firstSeenAt = event.firstSeenAt ?? now;
    await prisma.outboxEvent.updateMany({
      where: { eventId: event.eventId, processingToken },
      data: {
        attempts: nextAttempts,
        nextAttemptAt: isDead ? null : new Date(now.getTime() + computeBackoffMs(nextAttempts)),
        deadLetteredAt: isDead ? now : null,
        reasonCode,
        errorClass,
        errorStack: stackSummary,
        firstSeenAt,
        lastSeenAt: now,
      },
    });
    logWarn(
      "outbox.publish-failed",
      {
        eventId: event.eventId,
        eventType: event.eventType,
        attempts: nextAttempts,
        correlationId: event.correlationId ?? null,
        errorClass,
        reasonCode,
        error: message,
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
}

async function claimOutboxBatchWithTransaction(params: {
  now: Date;
  batchSize: number;
  lookahead: number;
}) {
  const { now, batchSize, lookahead } = params;
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
          reason_code as "reasonCode",
          error_class as "errorClass",
          error_stack as "errorStack",
          first_seen_at as "firstSeenAt",
          last_seen_at as "lastSeenAt",
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
  }, { timeout: resolveTxTimeoutMs(), maxWait: resolveTxMaxWaitMs() });

  return claimed;
}

async function claimOutboxBatchWithoutTransaction(params: {
  now: Date;
  batchSize: number;
  lookahead: number;
}) {
  const { now, batchSize, lookahead } = params;
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const candidates = await prisma.$queryRaw<OutboxCandidate[]>(
    Prisma.sql`
      SELECT
        event_id as "eventId",
        event_type as "eventType",
        payload,
        created_at as "createdAt",
        published_at as "publishedAt",
        attempts,
        next_attempt_at as "nextAttemptAt",
        reason_code as "reasonCode",
        error_class as "errorClass",
        error_stack as "errorStack",
        first_seen_at as "firstSeenAt",
        last_seen_at as "lastSeenAt",
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
    `,
  );

  if (!candidates.length) return { processingToken: null, events: [] as OutboxCandidate[] };
  const events = buildFairOutboxBatch(candidates, batchSize);
  if (!events.length) return { processingToken: null, events: [] as OutboxCandidate[] };

  const processingToken = crypto.randomUUID();
  const eventIds = events.map((event) => event.eventId);
  const claimed = await prisma.$queryRaw<OutboxCandidate[]>(
    Prisma.sql`
      UPDATE app_v3.outbox_events
      SET processing_token = ${processingToken},
          claimed_at = ${now}
      WHERE event_id IN (${Prisma.join(eventIds)})
        AND published_at IS NULL
        AND dead_lettered_at IS NULL
        AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
        AND (claimed_at IS NULL OR claimed_at <= ${staleBefore})
      RETURNING
        event_id as "eventId",
        event_type as "eventType",
        payload,
        created_at as "createdAt",
        published_at as "publishedAt",
        attempts,
        next_attempt_at as "nextAttemptAt",
        reason_code as "reasonCode",
        error_class as "errorClass",
        error_stack as "errorStack",
        first_seen_at as "firstSeenAt",
        last_seen_at as "lastSeenAt",
        causation_id as "causationId",
        correlation_id as "correlationId",
        dead_lettered_at as "deadLetteredAt"
    `,
  );

  if (!claimed.length) return { processingToken: null, events: [] as OutboxCandidate[] };
  return { processingToken, events: claimed };
}

export async function publishOutboxBatch(params?: { now?: Date; batchSize?: number }) {
  const now = params?.now ?? new Date();
  const batchSize = resolveBatchSize(params?.batchSize);
  if (batchSize <= 0) return [];

  const lookahead = resolveLookahead(batchSize);
  let claimed: { processingToken: string | null; events: OutboxCandidate[] };
  if (shouldSkipOutboxTransaction()) {
    claimed = await claimOutboxBatchWithoutTransaction({ now, batchSize, lookahead });
  } else {
    try {
      claimed = await claimOutboxBatchWithTransaction({ now, batchSize, lookahead });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logWarn(
        "outbox.claim.fallback",
        { error: message },
        { fallbackToRequestContext: false },
      );
      claimed = await claimOutboxBatchWithoutTransaction({ now, batchSize, lookahead });
    }
  }

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
