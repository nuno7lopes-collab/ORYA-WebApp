import { CrmDeliveryStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { markAllNotificationsRead, markNotificationRead } from "@/domain/notifications/consumer";
import { prisma } from "@/lib/prisma";

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
      await markAllNotificationsRead({ userId: user.id, organizationId: orgId });
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

    await markNotificationRead({ userId: user.id, notificationId });

    if (notif.type === "CRM_CAMPAIGN") {
      const delivery = await prisma.crmCampaignDelivery.findFirst({
        where: { notificationId: notif.id },
        select: { id: true, campaignId: true, openedAt: true },
      });
      if (delivery && !delivery.openedAt) {
        await prisma.$transaction(async (tx) => {
          await tx.crmCampaignDelivery.update({
            where: { id: delivery.id },
            data: { openedAt: new Date(), status: CrmDeliveryStatus.OPENED },
          });
          await tx.crmCampaign.update({
            where: { id: delivery.campaignId },
            data: { openedCount: { increment: 1 } },
          });
        });
      }
    }

    return NextResponse.json({ ok: true, updated: "single" });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[notifications][mark-read] erro inesperado", err);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
