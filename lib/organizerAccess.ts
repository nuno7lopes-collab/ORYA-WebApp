import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageEvents } from "@/lib/organizerPermissions";

export async function getOrganizerRole(userId: string, organizerId: number) {
  if (!userId || !organizerId) return null;
  const membership = await prisma.organizerMember.findUnique({
    where: { organizerId_userId: { organizerId, userId } },
    select: { role: true },
  });
  return membership?.role ?? null;
}

export async function canManageMembersDb(userId: string, organizerId: number) {
  const role = await getOrganizerRole(userId, organizerId);
  return role === OrganizerMemberRole.OWNER || role === OrganizerMemberRole.CO_OWNER || role === OrganizerMemberRole.ADMIN;
}

export async function canManageEventsDb(userId: string, organizerId: number) {
  const role = await getOrganizerRole(userId, organizerId);
  return (
    role === OrganizerMemberRole.OWNER ||
    role === OrganizerMemberRole.CO_OWNER ||
    role === OrganizerMemberRole.ADMIN ||
    role === OrganizerMemberRole.STAFF
  );
}

export async function canScanTickets(userId: string, eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });
  if (!event || !event.organizerId) {
    return {
      allowed: false,
      reason: "EVENT_NOT_FOUND",
      membershipRole: null as OrganizerMemberRole | null,
    };
  }

  const membership = await prisma.organizerMember.findUnique({
    where: { organizerId_userId: { organizerId: event.organizerId, userId } },
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
