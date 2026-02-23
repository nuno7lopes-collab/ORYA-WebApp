import { CrmCampaignDeliveryChannel, CrmDeliveryStatus, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { markNotificationRead } from "@/domain/notifications/consumer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  buildOrganizationRelationFilter,
  ORGANIZATION_NOTIFICATION_TYPES,
  parseNotificationScope,
  parseOrganizationId,
} from "@/domain/notifications/scope";

async function _POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { notificationId, organizationId, scope: rawScope } = body as {
      notificationId?: string;
      organizationId?: number | null;
      scope?: string;
    };
    const scope = parseNotificationScope(rawScope);
    const orgId = parseOrganizationId(organizationId);

    if (scope === "organization" && !orgId) {
      return jsonWrap(
        {
          ok: false,
          code: "INVALID_ORGANIZATION",
          message: "organizationId e obrigatorio para scope=organization",
        },
        { status: 400 },
      );
    }

    if (!notificationId) {
      return jsonWrap(
        { ok: false, code: "INVALID_PAYLOAD", message: "notificationId é obrigatório" },
        { status: 400 },
      );
    }

    const where: Prisma.NotificationWhereInput = {
      id: notificationId,
      userId: user.id,
    };
    if (scope === "organization" && orgId) {
      where.AND = [
        { type: { in: ORGANIZATION_NOTIFICATION_TYPES } },
        buildOrganizationRelationFilter(orgId),
      ];
    }

    const notif = await prisma.notification.findFirst({
      where,
      select: { id: true, type: true, isRead: true, readAt: true },
    });
    if (!notif) {
      return jsonWrap(
        { ok: false, code: "NOT_FOUND", message: "Notificação não existe" },
        { status: 404 },
      );
    }

    if (!notif.isRead || !notif.readAt) {
      await markNotificationRead({ userId: user.id, notificationId: notif.id });
    }

    if (notif.type === "CRM_CAMPAIGN") {
      const delivery = await prisma.crmCampaignDelivery.findFirst({
        where: { notificationId: notif.id, channel: CrmCampaignDeliveryChannel.IN_APP },
        select: { id: true, campaignId: true, openedAt: true, clickedAt: true, status: true, sentAt: true },
      });
      if (delivery && !delivery.clickedAt && delivery.status !== CrmDeliveryStatus.FAILED) {
        const now = new Date();
        const shouldOpen = !delivery.openedAt;
        await prisma.$transaction(async (tx) => {
          await tx.crmCampaignDelivery.update({
            where: { id: delivery.id },
            data: {
              clickedAt: now,
              ...(shouldOpen ? { openedAt: now } : {}),
              ...(delivery.sentAt ? {} : { sentAt: now }),
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

    return jsonWrap({ ok: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[notifications][mark-click] erro inesperado", err);
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
