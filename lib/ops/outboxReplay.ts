import { prisma } from "@/lib/prisma";

const DEFAULT_MAX_REPLAY = 100;
const DEFAULT_REPLAY_RATE_LIMIT_MS = 30 * 60 * 1000;

export type OutboxReplayResult = {
  ok: true;
  requestId: string | null;
  rearmed: number;
  skipped: number;
  notFound: number;
  rearmedIds: string[];
  skippedIds: Array<{ eventId: string; reason: string }>;
  notFoundIds: string[];
  idempotent?: boolean;
};

export async function replayOutboxEvents(params: {
  eventIds: string[];
  requestId?: string | null;
  maxReplay?: number;
}): Promise<
  | OutboxReplayResult
  | { ok: false; error: string; requestId: string | null; max?: number; retryAfterSec?: number }
> {
  const requestId = params.requestId ?? null;
  const maxReplay = params.maxReplay ?? DEFAULT_MAX_REPLAY;
  const eventIds = Array.from(
    new Set(params.eventIds.map((id) => id.trim()).filter(Boolean)),
  );
  if (eventIds.length === 0) {
    return { ok: false, error: "INVALID_PAYLOAD", requestId };
  }
  if (eventIds.length > maxReplay) {
    return { ok: false, error: "LIMIT_EXCEEDED", requestId, max: maxReplay };
  }

  if (requestId) {
    const dedupeKey = `admin_outbox_replay:${requestId}`;
    const existing = await prisma.operation.findUnique({
      where: { dedupeKey },
      select: { payload: true },
    });
    if (existing?.payload && typeof existing.payload === "object") {
      return {
        ok: true,
        idempotent: true,
        requestId,
        ...(existing.payload as Omit<OutboxReplayResult, "ok" | "requestId">),
      };
    }
  }

  const rateLimitMs = Number(
    process.env.OUTBOX_REPLAY_RATE_LIMIT_MS || DEFAULT_REPLAY_RATE_LIMIT_MS,
  );
  if (Number.isFinite(rateLimitMs) && rateLimitMs > 0) {
    const latestReplay = await prisma.operation.findFirst({
      where: { operationType: "ADMIN_OUTBOX_REPLAY" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (latestReplay?.createdAt) {
      const elapsed = Date.now() - latestReplay.createdAt.getTime();
      if (elapsed < rateLimitMs) {
        return {
          ok: false,
          error: "RATE_LIMITED",
          requestId,
          retryAfterSec: Math.max(1, Math.ceil((rateLimitMs - elapsed) / 1000)),
        };
      }
    }
  }

  const events = await prisma.outboxEvent.findMany({
    where: { eventId: { in: eventIds } },
    select: { eventId: true, deadLetteredAt: true, publishedAt: true },
  });
  const eventById = new Map(events.map((evt) => [evt.eventId, evt]));

  const now = new Date();
  const rearmedIds: string[] = [];
  const skippedIds: Array<{ eventId: string; reason: string }> = [];
  const notFoundIds: string[] = [];

  for (const eventId of eventIds) {
    const event = eventById.get(eventId);
    if (!event) {
      notFoundIds.push(eventId);
      continue;
    }
    if (event.publishedAt) {
      skippedIds.push({ eventId, reason: "ALREADY_PUBLISHED" });
      continue;
    }
    if (!event.deadLetteredAt) {
      skippedIds.push({ eventId, reason: "NOT_DEAD_LETTERED" });
      continue;
    }
    await prisma.outboxEvent.update({
      where: { eventId },
      data: {
        deadLetteredAt: null,
        attempts: 0,
        nextAttemptAt: now,
        reasonCode: null,
        errorClass: null,
        errorStack: null,
        firstSeenAt: null,
        lastSeenAt: null,
      },
    });
    rearmedIds.push(eventId);
  }

  const responsePayload = {
    rearmed: rearmedIds.length,
    skipped: skippedIds.length,
    notFound: notFoundIds.length,
    rearmedIds,
    skippedIds,
    notFoundIds,
  };

  if (requestId) {
    const dedupeKey = `admin_outbox_replay:${requestId}`;
    try {
      await prisma.operation.create({
        data: {
          operationType: "ADMIN_OUTBOX_REPLAY",
          dedupeKey,
          status: "SUCCEEDED",
          payload: responsePayload,
        },
      });
    } catch {
      // ignore dedupe conflict
    }
  }

  return { ok: true, requestId, ...responsePayload };
}
