import { CrmDeliveryStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { markNotificationRead } from "@/domain/notifications/consumer";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { notificationId } = body as { notificationId?: string };

    if (!notificationId) {
      return NextResponse.json(
        { ok: false, code: "INVALID_PAYLOAD", message: "notificationId é obrigatório" },
        { status: 400 },
      );
    }

    const notif = await prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id },
      select: { id: true, type: true, isRead: true, readAt: true },
    });
    if (!notif) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Notificação não existe" },
        { status: 404 },
      );
    }

    if (!notif.isRead || !notif.readAt) {
      await markNotificationRead({ userId: user.id, notificationId: notif.id });
    }

    if (notif.type === "CRM_CAMPAIGN") {
      const delivery = await prisma.crmCampaignDelivery.findFirst({
        where: { notificationId: notif.id },
        select: { id: true, campaignId: true, openedAt: true, clickedAt: true },
      });
      if (delivery && !delivery.clickedAt) {
        const now = new Date();
        const shouldOpen = !delivery.openedAt;
        await prisma.$transaction(async (tx) => {
          await tx.crmCampaignDelivery.update({
            where: { id: delivery.id },
            data: {
              clickedAt: now,
              ...(shouldOpen ? { openedAt: now } : {}),
              status: CrmDeliveryStatus.CLICKED,
            },
          });
          await tx.crmCampaign.update({
            where: { id: delivery.campaignId },
            data: {
              clickedCount: { increment: 1 },
              ...(shouldOpen ? { openedCount: { increment: 1 } } : {}),
            },
          });
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[notifications][mark-click] erro inesperado", err);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
