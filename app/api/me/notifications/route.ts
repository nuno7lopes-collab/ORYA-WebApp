import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
    const user = await requireUser();

    const status = (req.nextUrl.searchParams.get("status") ?? "all").toLowerCase();
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 50);
    const cursor = req.nextUrl.searchParams.get("cursor");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const where = {
      userId: user.id,
      ...(status === "unread" ? { isRead: false } : {}),
    };

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });

    const nextCursor = notifications.length > 0 ? notifications[notifications.length - 1].id : null;

    return jsonWrap({
      ok: true,
      unreadCount,
      items: notifications,
      nextCursor,
    });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap(
        { ok: false, code: "UNAUTHENTICATED", message: "Sessão em falta" },
        { status: err.status ?? 401 },
      );
    }

    console.error("[me][notifications][GET] erro inesperado", err);
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);