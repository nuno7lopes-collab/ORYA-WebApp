import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { NotificationType } from "@prisma/client";
import { getUserFollowingSet } from "@/domain/social/follows";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

// Lista notificações com badge de não lidas; só o próprio utilizador pode ver
async function _GET(req: NextRequest) {
  let ctx = getRequestContext(req);
  try {
    const user = await requireUser();

    const requestedUserId = req.nextUrl.searchParams.get("userId");
    if (requestedUserId && requestedUserId !== user.id) {
      return jsonWrap(
        { ok: false, code: "FORBIDDEN", message: "Não podes ver notificações de outro utilizador." },
        { status: 403 },
      );
    }

    const status = (req.nextUrl.searchParams.get("status") ?? "all").toLowerCase();
    const typesParam = req.nextUrl.searchParams.get("types");
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 100);
    const orgIdRaw = req.nextUrl.searchParams.get("organizationId");
    const organizationId = orgIdRaw ? Number(orgIdRaw) : null;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;
    ctx = getRequestContext(req, { orgId: Number.isFinite(organizationId ?? NaN) ? organizationId : null });

    const validTypes = new Set(Object.values(NotificationType));
    const types = typesParam
      ? typesParam
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .filter((t) => validTypes.has(t as NotificationType))
      : [];

    const where = {
      userId: user.id,
      ...(status === "unread" ? { isRead: false } : {}),
      ...(types.length > 0 ? { type: { in: types as NotificationType[] } } : {}),
    };
    if (Number.isFinite(organizationId) && organizationId) {
      where.AND = [
        ...(where.AND ?? []),
        { OR: [{ organizationId }, { event: { organizationId } }] },
      ];
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const followSourceIds = notifications
      .filter((n) => n.type === "FOLLOWED_YOU" && n.fromUserId)
      .map((n) => n.fromUserId as string);
    const mutualSet = followSourceIds.length > 0
      ? await getUserFollowingSet(user.id, followSourceIds)
      : new Set<string>();

    const items = notifications.map((item) => {
      if (item.type === "FOLLOWED_YOU") {
        return {
          ...item,
          meta: { isMutual: mutualSet.has(item.fromUserId ?? "") },
        };
      }
      return item;
    });

    const unreadCountWhere = {
      userId: user.id,
      isRead: false,
    } as typeof where;
    if (Number.isFinite(organizationId) && organizationId) {
      unreadCountWhere.AND = [
        ...(unreadCountWhere.AND ?? []),
        { OR: [{ organizationId }, { event: { organizationId } }] },
      ];
    }
    const unreadCount = await prisma.notification.count({ where: unreadCountWhere });

    return jsonWrap({
      ok: true,
      unreadCount,
      notifications: items,
      items,
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap(
        { ok: false, code: "UNAUTHENTICATED", message: "Sessão em falta" },
        { status: err.status ?? 401 },
      );
    }

    console.error("[notifications][GET] erro inesperado", {
      err,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      orgId: ctx.orgId,
    });
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

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
    console.error("[notifications][DELETE] erro inesperado", {
      err,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      orgId: ctx.orgId,
    });
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const DELETE = withApiEnvelope(_DELETE);