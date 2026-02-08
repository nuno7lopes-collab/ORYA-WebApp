import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireUser, AuthRequiredError } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logInfo } from "@/lib/observability/logger";
import { Prisma } from "@prisma/client";

function parseId(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function _POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const organizationId = parseId(body?.organizationId);
    const eventId = parseId(body?.eventId);

    if (!organizationId && !eventId) {
      return jsonWrap(
        { ok: false, code: "INVALID_PAYLOAD", message: "organizationId ou eventId é obrigatório" },
        { status: 400 },
      );
    }

    try {
      await prisma.notificationMute.create({
        data: {
          userId: user.id,
          organizationId,
          eventId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Idempotency: mute already exists.
      } else {
        throw err;
      }
    }
    logInfo("notifications.mute", { userId: user.id, organizationId: organizationId ?? undefined, eventId: eventId ?? undefined });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[me][notifications][mute] erro inesperado", err);
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const organizationId = parseId(body?.organizationId);
    const eventId = parseId(body?.eventId);

    if (!organizationId && !eventId) {
      return jsonWrap(
        { ok: false, code: "INVALID_PAYLOAD", message: "organizationId ou eventId é obrigatório" },
        { status: 400 },
      );
    }

    await prisma.notificationMute.deleteMany({
      where: {
        userId: user.id,
        organizationId: organizationId ?? undefined,
        eventId: eventId ?? undefined,
      },
    });
    logInfo("notifications.unmute", { userId: user.id, organizationId: organizationId ?? undefined, eventId: eventId ?? undefined });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[me][notifications][mute][delete] erro inesperado", err);
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
