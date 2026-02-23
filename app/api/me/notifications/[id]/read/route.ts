import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { markNotificationRead } from "@/domain/notifications/consumer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";
import { CrmCampaignDeliveryChannel, CrmDeliveryStatus } from "@prisma/client";

async function _POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const notificationId = params.id;
    if (!notificationId) {
      return jsonWrap(
        { ok: false, code: "INVALID_PAYLOAD", message: "notificationId é obrigatório" },
        { status: 400 },
      );
    }

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id },
      select: { id: true, type: true },
    });
    if (!notification) {
      return jsonWrap({ ok: false, code: "NOT_FOUND", message: "Notificação não existe" }, { status: 404 });
    }

    await markNotificationRead({ userId: user.id, notificationId: notification.id });
    if (notification.type === "CRM_CAMPAIGN") {
      const delivery = await prisma.crmCampaignDelivery.findFirst({
        where: { notificationId: notification.id, channel: CrmCampaignDeliveryChannel.IN_APP },
        select: { id: true, campaignId: true, openedAt: true, status: true, sentAt: true },
      });
      if (delivery && !delivery.openedAt && delivery.status !== CrmDeliveryStatus.FAILED) {
        const openedAt = new Date();
        const nextStatus =
          delivery.status === CrmDeliveryStatus.SENT ? CrmDeliveryStatus.OPENED : delivery.status;
        await prisma.$transaction(async (tx) => {
          await tx.crmCampaignDelivery.update({
            where: { id: delivery.id },
            data: {
              openedAt,
              status: nextStatus,
              ...(delivery.sentAt ? {} : { sentAt: openedAt }),
            },
          });
          await tx.crmCampaign.update({
            where: { id: delivery.campaignId },
            data: { openedCount: { increment: 1 } },
          });
        });
      }
    }

    return jsonWrap({ ok: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[me][notifications][read] erro inesperado", err);
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
