import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";

async function _DELETE(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { notificationId } = body as { notificationId?: string };
    if (!notificationId) {
      return jsonWrap(
        { ok: false, code: "INVALID_PAYLOAD", message: "notificationId é obrigatório" },
        { status: 400 },
      );
    }

    const result = await prisma.notification.deleteMany({
      where: { id: notificationId, userId: user.id },
    });

    if (result.count === 0) {
      return jsonWrap(
        { ok: false, code: "NOT_FOUND", message: "Notificação não existe" },
        { status: 404 },
      );
    }

    return jsonWrap({ ok: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[me][notifications][DELETE] erro inesperado", {
      err,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      orgId: ctx.orgId,
    });
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const DELETE = withApiEnvelope(_DELETE);
