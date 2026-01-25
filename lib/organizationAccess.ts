import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureGroupMemberCheckinAccess } from "@/lib/organizationMemberAccess";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";

export async function getOrganizationRole(userId: string, organizationId: number) {
  if (!userId || !organizationId) return null;
  const membership = await resolveGroupMemberForOrg({ organizationId, userId });
  return membership?.role ?? null;
}

export async function canManageMembersDb(userId: string, organizationId: number) {
  const role = await getOrganizationRole(userId, organizationId);
  return role === OrganizationMemberRole.OWNER || role === OrganizationMemberRole.CO_OWNER || role === OrganizationMemberRole.ADMIN;
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

  const access = await ensureGroupMemberCheckinAccess({
    organizationId: event.organizationId,
    userId,
    required: "EDIT",
    membership: await resolveGroupMemberForOrg({ organizationId: event.organizationId, userId }),
  });
  if (access.ok) {
    return { allowed: true, membershipRole: access.membership.role };
  }

  return {
    allowed: false,
    membershipRole: null,
    reason: "NO_PERMISSION",
  };
}
