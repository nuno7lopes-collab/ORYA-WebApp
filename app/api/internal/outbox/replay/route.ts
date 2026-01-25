import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

function requireInternalSecret(req: NextRequest) {
  const provided = req.headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const payload = (await req.json().catch(() => null)) as { eventId?: unknown } | null;
  const eventId = typeof payload?.eventId === "string" ? payload.eventId : null;
  if (!eventId) return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });

  const event = await prisma.outboxEvent.findUnique({ where: { eventId } });
  if (!event) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (!event.deadLetteredAt) {
    return NextResponse.json({ ok: false, error: "NOT_DEAD_LETTERED" }, { status: 400 });
  }
  if (event.publishedAt) {
    return NextResponse.json({ ok: false, error: "ALREADY_PUBLISHED" }, { status: 400 });
  }

  const now = new Date();
  await prisma.outboxEvent.update({
    where: { eventId },
    data: { deadLetteredAt: null, attempts: 0, nextAttemptAt: now },
  });

  return NextResponse.json({ ok: true, eventId, rearmedAt: now.toISOString() });
}
