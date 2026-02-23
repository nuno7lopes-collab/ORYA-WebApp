import { CrmCampaignDeliveryChannel, CrmDeliveryStatus, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { markNotificationRead } from "@/domain/notifications/consumer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logInfo } from "@/lib/observability/logger";
import { NOTIFICATION_TYPES_BY_CATEGORY } from "@/domain/notifications/registry";
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
    const { notificationId, markAll, organizationId, scope: rawScope } = body as {
      notificationId?: string;
      markAll?: boolean;
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

    if (markAll) {
      const andFilters: Prisma.NotificationWhereInput[] = [];
      if (scope === "organization" && orgId) {
        andFilters.push(buildOrganizationRelationFilter(orgId));
      } else if (orgId) {
        // Compatibilidade com clientes antigos que enviam apenas organizationId
        andFilters.push(buildOrganizationRelationFilter(orgId));
      }
      const where: Prisma.NotificationWhereInput = {
        userId: user.id,
        isRead: false,
        type:
          scope === "organization"
            ? { in: ORGANIZATION_NOTIFICATION_TYPES }
            : { notIn: NOTIFICATION_TYPES_BY_CATEGORY.chat },
      };
      if (andFilters.length) {
        where.AND = andFilters;
      }
      const unreadCrmNotifications = await prisma.notification.findMany({
        where: {
          ...where,
          type: "CRM_CAMPAIGN",
        },
        select: { id: true },
      });
      const unreadCrmNotificationIds = unreadCrmNotifications.map((item) => item.id);

      await prisma.notification.updateMany({
        where,
        data: { isRead: true, readAt: new Date() },
      });

      if (unreadCrmNotificationIds.length) {
        const unopenedDeliveries = await prisma.crmCampaignDelivery.findMany({
          where: {
            notificationId: { in: unreadCrmNotificationIds },
            channel: CrmCampaignDeliveryChannel.IN_APP,
            openedAt: null,
            status: { in: [CrmDeliveryStatus.SENT, CrmDeliveryStatus.OPENED, CrmDeliveryStatus.CLICKED] },
          },
          select: { id: true, campaignId: true, status: true, sentAt: true },
        });

        if (unopenedDeliveries.length) {
          const now = new Date();
          const sentDeliveryIds = unopenedDeliveries
            .filter((delivery) => delivery.status === CrmDeliveryStatus.SENT)
            .map((delivery) => delivery.id);
          const alreadyOpenedIds = unopenedDeliveries
            .filter((delivery) => delivery.status !== CrmDeliveryStatus.SENT)
            .map((delivery) => delivery.id);
          const openedByCampaign = new Map<string, number>();
          for (const delivery of unopenedDeliveries) {
            openedByCampaign.set(delivery.campaignId, (openedByCampaign.get(delivery.campaignId) ?? 0) + 1);
          }

          await prisma.$transaction(async (tx) => {
            if (sentDeliveryIds.length) {
              await tx.crmCampaignDelivery.updateMany({
                where: {
                  id: { in: sentDeliveryIds },
                  openedAt: null,
                  status: CrmDeliveryStatus.SENT,
                },
                data: { openedAt: now, status: CrmDeliveryStatus.OPENED, sentAt: now },
              });
            }
            if (alreadyOpenedIds.length) {
              await tx.crmCampaignDelivery.updateMany({
                where: {
                  id: { in: alreadyOpenedIds },
                  openedAt: null,
                  status: { in: [CrmDeliveryStatus.OPENED, CrmDeliveryStatus.CLICKED] },
                },
                data: { openedAt: now },
              });
            }

            await Promise.all(
              Array.from(openedByCampaign.entries()).map(([campaignId, increment]) =>
                tx.crmCampaign.update({
                  where: { id: campaignId },
                  data: { openedCount: { increment } },
                }),
              ),
            );
          });
        }
      }

      logInfo("notifications.mark_read", {
        userId: user.id,
        mode: "all",
        scope,
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

    const singleWhere: Prisma.NotificationWhereInput = {
      id: notificationId,
      userId: user.id,
    };
    if (scope === "organization" && orgId) {
      singleWhere.AND = [
        { type: { in: ORGANIZATION_NOTIFICATION_TYPES } },
        buildOrganizationRelationFilter(orgId),
      ];
    }

    const notif = await prisma.notification.findFirst({ where: singleWhere });
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
      scope,
      organizationId: orgId ?? undefined,
      notificationId,
      type: notif.type,
    });

    if (notif.type === "CRM_CAMPAIGN") {
      const delivery = await prisma.crmCampaignDelivery.findFirst({
        where: { notificationId: notif.id, channel: CrmCampaignDeliveryChannel.IN_APP },
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
