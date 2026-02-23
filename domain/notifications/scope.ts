import { NotificationType, type Prisma } from "@prisma/client";
export { parseOrganizationId } from "@/lib/organizationIdUtils";

export type NotificationScope = "user" | "organization";

export const ORGANIZATION_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.ORGANIZATION_INVITE,
  NotificationType.ORGANIZATION_TRANSFER,
  NotificationType.CLUB_INVITE,
  NotificationType.CLUB_STAFF_INVITE,
  NotificationType.TEAM_MEMBER_INVITE,
  NotificationType.EVENT_SALE,
  NotificationType.EVENT_PAYOUT_STATUS,
  NotificationType.STRIPE_STATUS,
  NotificationType.BOOKING_CHANGE_REQUEST,
  NotificationType.BOOKING_CHANGE_RESPONSE,
  NotificationType.CRM_CAMPAIGN,
  NotificationType.SYSTEM_ANNOUNCE,
];

const organizationTypeSet = new Set<NotificationType>(ORGANIZATION_NOTIFICATION_TYPES);

export function isOrganizationNotificationType(type: NotificationType): boolean {
  return organizationTypeSet.has(type);
}

export function parseNotificationScope(raw: unknown): NotificationScope {
  return raw === "organization" ? "organization" : "user";
}

export function buildOrganizationRelationFilter(
  organizationId: number,
): Prisma.NotificationWhereInput {
  return {
    OR: [{ organizationId }, { event: { organizationId } }],
  };
}
