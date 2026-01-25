import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";
// DLQ: listar via GET /api/internal/outbox/dlq; replay via POST /api/internal/outbox/replay.

function requireInternalSecret(req: NextRequest) {
  const provided = req.headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(100, Math.floor(parsed));
}

export async function GET(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
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

  return NextResponse.json({
    ok: true,
    items: items.map((evt) => ({
      eventId: evt.eventId,
      eventType: evt.eventType,
      attempts: evt.attempts,
      lastError: null,
      createdAt: evt.createdAt,
      deadLetteredAt: evt.deadLetteredAt,
      correlationId: evt.correlationId,
    })),
    nextBefore,
  });
}
