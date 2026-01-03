import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageEvents } from "@/lib/organizationPermissions";

export async function getOrganizationRole(userId: string, organizationId: number) {
  if (!userId || !organizationId) return null;
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export async function canManageMembersDb(userId: string, organizationId: number) {
  const role = await getOrganizationRole(userId, organizationId);
  return role === OrganizationMemberRole.OWNER || role === OrganizationMemberRole.CO_OWNER || role === OrganizationMemberRole.ADMIN;
}

export async function canManageEventsDb(userId: string, organizationId: number) {
  const role = await getOrganizationRole(userId, organizationId);
  return (
    role === OrganizationMemberRole.OWNER ||
    role === OrganizationMemberRole.CO_OWNER ||
    role === OrganizationMemberRole.ADMIN ||
    role === OrganizationMemberRole.STAFF
  );
}

export async function canScanTickets(userId: string, eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!event || !event.organizationId) {
    return {
      allowed: false,
      reason: "EVENT_NOT_FOUND",
      membershipRole: null as OrganizationMemberRole | null,
    };
  }

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: event.organizationId, userId } },
    select: { role: true },
  });

  if (membership && canManageEvents(membership.role)) {
    return { allowed: true, membershipRole: membership.role };
  }

  return {
    allowed: false,
    membershipRole: membership?.role ?? null,
    reason: "NO_PERMISSION",
  };
}
