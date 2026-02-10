import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

// DLQ: listar via GET /api/internal/outbox/dlq; replay via POST /api/internal/outbox/replay.

function ensureInternalSecret(req: NextRequest, ctx: { requestId: string; correlationId: string }) {
  if (!requireInternalSecret(req)) {
    return respondError(
      ctx,
      { errorCode: "UNAUTHORIZED", message: "Unauthorized.", retryable: false },
      { status: 401 },
    );
  }
  return null;
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(100, Math.floor(parsed));
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const unauthorized = ensureInternalSecret(req, ctx);
  if (unauthorized) return unauthorized;

  const eventType = req.nextUrl.searchParams.get("eventType")?.trim() || null;
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
  const beforeParam = req.nextUrl.searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : null;

  const items = await prisma.outboxEvent.findMany({
    where: {
      deadLetteredAt: { not: null },
      publishedAt: null,
      ...(eventType ? { eventType } : {}),
      ...(before ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const nextBefore = items.length ? items[items.length - 1].createdAt.toISOString() : null;

  return respondOk(ctx, {
    items: items.map((evt) => ({
      eventId: evt.eventId,
      eventType: evt.eventType,
      attempts: evt.attempts,
      reasonCode: evt.reasonCode,
      errorClass: evt.errorClass,
      errorStack: evt.errorStack,
      firstSeenAt: evt.firstSeenAt,
      lastSeenAt: evt.lastSeenAt,
      nextAttemptAt: evt.nextAttemptAt,
      createdAt: evt.createdAt,
      deadLetteredAt: evt.deadLetteredAt,
      correlationId: evt.correlationId,
    })),
    nextBefore,
  });
}
export const GET = withApiEnvelope(_GET);
