import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";

// Lista notificações com badge de não lidas; só o próprio utilizador pode ver
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();

    const requestedUserId = req.nextUrl.searchParams.get("userId");
    if (requestedUserId && requestedUserId !== user.id) {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "Não podes ver notificações de outro utilizador." },
        { status: 403 },
      );
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({ ok: true, unreadCount, notifications });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json(
        { ok: false, code: "UNAUTHENTICATED", message: "Sessão em falta" },
        { status: err.status ?? 401 },
      );
    }

    console.error("[notifications][GET] erro inesperado", err);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
