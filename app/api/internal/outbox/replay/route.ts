import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

export async function POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

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
