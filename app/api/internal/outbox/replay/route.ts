import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

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

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const unauthorized = ensureInternalSecret(req, ctx);
  if (unauthorized) return unauthorized;

  const payload = (await req.json().catch(() => null)) as { eventId?: unknown } | null;
  const eventId = typeof payload?.eventId === "string" ? payload.eventId : null;
  if (!eventId) {
    return respondError(
      ctx,
      { errorCode: "INVALID_PAYLOAD", message: "Payload inválido.", retryable: false },
      { status: 400 },
    );
  }

  const event = await prisma.outboxEvent.findUnique({ where: { eventId } });
  if (!event) {
    return respondError(
      ctx,
      { errorCode: "NOT_FOUND", message: "Evento não encontrado.", retryable: false },
      { status: 404 },
    );
  }
  if (!event.deadLetteredAt) {
    return respondError(
      ctx,
      { errorCode: "NOT_DEAD_LETTERED", message: "Evento não está em DLQ.", retryable: false },
      { status: 400 },
    );
  }
  if (event.publishedAt) {
    return respondError(
      ctx,
      { errorCode: "ALREADY_PUBLISHED", message: "Evento já publicado.", retryable: false },
      { status: 400 },
    );
  }

  const now = new Date();
  await prisma.outboxEvent.update({
    where: { eventId },
    data: { deadLetteredAt: null, attempts: 0, nextAttemptAt: now },
  });

  return respondOk(ctx, { eventId, rearmedAt: now.toISOString() });
}
