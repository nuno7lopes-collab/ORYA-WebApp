import { CrmDeliveryStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { markNotificationRead } from "@/domain/notifications/consumer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logInfo } from "@/lib/observability/logger";
import { NOTIFICATION_TYPES_BY_CATEGORY } from "@/domain/notifications/registry";

async function _POST(req: NextRequest) {
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
        type?: { in?: string[]; notIn?: string[] };
        AND?: Array<{ OR: Array<{ organizationId?: number; event?: { organizationId: number } }> }>;
      };
      where.type = { notIn: NOTIFICATION_TYPES_BY_CATEGORY.chat };
      if (orgId) {
        where.AND = [{ OR: [{ organizationId: orgId }, { event: { organizationId: orgId } }] }];
      }
      await prisma.notification.updateMany({
        where,
        data: { isRead: true, readAt: new Date() },
      });
      logInfo("notifications.mark_read", {
        userId: user.id,
        mode: "all",
        organizationId: orgId ?? undefined,
      });
      return jsonWrap({ ok: true, updated: "all" });
    }

    if (!notificationId) {
      return jsonWrap(
        { ok: false, code: "INVALID_PAYLOAD", message: "notificationId é obrigatório" },
        { status: 400 },
      );
    }

    const notif = await prisma.notification.findFirst({
      where: { id: notificationId, userId: user.id },
    });
    if (!notif) {
      return jsonWrap(
        { ok: false, code: "NOT_FOUND", message: "Notificação não existe" },
        { status: 404 },
      );
    }

    await markNotificationRead({ userId: user.id, notificationId });
    logInfo("notifications.mark_read", {
      userId: user.id,
      mode: "single",
      notificationId,
      type: notif.type,
    });

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

    return jsonWrap({ ok: true, updated: "single" });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[notifications][mark-read] erro inesperado", err);
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
