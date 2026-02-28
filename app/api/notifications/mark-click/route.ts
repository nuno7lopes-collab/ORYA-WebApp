import { CrmCampaignDeliveryChannel, CrmDeliveryStatus, Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { markNotificationRead } from "@/domain/notifications/consumer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  buildOrganizationRelationFilterForMany,
  isMobileNotificationClient,
  listAccessibleOrganizationIdsForUser,
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
    const requestedScope = parseNotificationScope(rawScope);
    const explicitOrganizationScope = rawScope === "organization";
    const scope = isMobileNotificationClient(req.headers) ? requestedScope : "organization";
    const orgId = parseOrganizationId(organizationId);
    const allowLegacyOrganizationFilter = scope !== "organization" && Boolean(orgId);
    const accessibleOrganizationIds =
      scope === "organization" ? await listAccessibleOrganizationIdsForUser(user.id) : [];
    const organizationScopeIds =
      scope === "organization"
        ? orgId
          ? accessibleOrganizationIds.includes(orgId)
            ? [orgId]
            : []
          : accessibleOrganizationIds
        : [];

    if (explicitOrganizationScope && !orgId) {
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
    if (scope === "organization") {
      if (!organizationScopeIds.length) {
        return jsonWrap(
          { ok: false, code: "NOT_FOUND", message: "Notificação não existe" },
          { status: 404 },
        );
      }
      where.AND = [
        { type: { in: ORGANIZATION_NOTIFICATION_TYPES } },
        buildOrganizationRelationFilterForMany(organizationScopeIds),
      ];
    } else if (allowLegacyOrganizationFilter) {
      where.AND = [buildOrganizationRelationFilterForMany([orgId])];
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
