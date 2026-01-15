import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { notificationId, markAll, organizationId } = body as {
      notificationId?: string;
      markAll?: boolean;
      organizationId?: number | null;
    };

    if (markAll) {
      const orgId = Number.isFinite(organizationId ?? NaN) ? Number(organizationId) : null;
      const where = {
        userId: user.id,
        isRead: false,
      } as {
        userId: string;
        isRead: boolean;
        AND?: Array<{ OR: Array<{ organizationId?: number; event?: { organizationId: number } }> }>;
      };
      if (orgId) {
        where.AND = [{ OR: [{ organizationId: orgId }, { event: { organizationId: orgId } }] }];
      }
      await prisma.notification.updateMany({
        where,
        data: { isRead: true, readAt: new Date() },
      });
      return NextResponse.json({ ok: true, updated: "all" });
    }

    if (!notificationId) {
      return NextResponse.json(
        { ok: false, code: "INVALID_PAYLOAD", message: "notificationId é obrigatório" },
        { status: 400 },
      );
    }

    const notif = await prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id },
    });
    if (!notif) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Notificação não existe" },
        { status: 404 },
      );
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({ ok: true, updated: "single" });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[notifications][mark-read] erro inesperado", err);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
