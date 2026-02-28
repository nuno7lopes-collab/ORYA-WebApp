import { NotificationType, OrganizationStatus, type Prisma } from "@prisma/client";
import { parseOrganizationId } from "@/lib/organizationIdUtils";
import { listEffectiveOrganizationMembershipsForUser } from "@/lib/organizationMembers";

export { parseOrganizationId };

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

const MOBILE_PLATFORMS = new Set(["mobile", "ios", "android"]);

const normalizeOrganizationIds = (values: Array<number | null | undefined>) =>
  Array.from(
    new Set(
      values
        .map((value) => parseOrganizationId(value))
        .filter((value): value is number => Boolean(value)),
    ),
  );

export function isMobileNotificationClient(headers: Pick<Headers, "get">): boolean {
  const platform =
    headers.get("x-client-platform") ||
    headers.get("x-app-platform") ||
    headers.get("x-platform");
  return MOBILE_PLATFORMS.has(platform?.trim().toLowerCase() ?? "");
}

export function buildOrganizationRelationFilterForMany(
  organizationIds: Array<number | null | undefined>,
): Prisma.NotificationWhereInput {
  const validOrganizationIds = normalizeOrganizationIds(organizationIds);
  if (validOrganizationIds.length <= 1) {
    return buildOrganizationRelationFilter(validOrganizationIds[0] ?? -1);
  }
  return {
    OR: [
      { organizationId: { in: validOrganizationIds } },
      { event: { organizationId: { in: validOrganizationIds } } },
    ],
  };
}

export async function listAccessibleOrganizationIdsForUser(userId: string): Promise<number[]> {
  if (!userId) return [];
  const memberships = await listEffectiveOrganizationMembershipsForUser({
    userId,
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });
  return normalizeOrganizationIds(memberships.map((membership) => membership.organizationId));
}
