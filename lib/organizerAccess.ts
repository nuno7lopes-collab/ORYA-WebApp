import { OrganizerMemberRole, StaffRole, StaffScope, StaffStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    return { allowed: false, reason: "EVENT_NOT_FOUND", membershipRole: null as OrganizerMemberRole | null };
  }

  const membership = await prisma.organizerMember.findUnique({
    where: { organizerId_userId: { organizerId: event.organizerId, userId } },
    select: { role: true },
  });

  const managerRoles: OrganizerMemberRole[] = [
    OrganizerMemberRole.OWNER,
    OrganizerMemberRole.CO_OWNER,
    OrganizerMemberRole.ADMIN,
  ];
  if (membership && managerRoles.includes(membership.role)) {
    return { allowed: true, membershipRole: membership.role, staffAssignmentId: null as number | null };
  }

  const staffAssignment = await prisma.staffAssignment.findFirst({
    where: {
      userId,
      status: StaffStatus.ACCEPTED,
      revokedAt: null,
      role: { in: [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.CHECKIN] },
      OR: [
        { scope: StaffScope.EVENT, eventId },
        { scope: StaffScope.GLOBAL, organizerId: event.organizerId },
      ],
    },
    select: { id: true, role: true },
  });

  if (staffAssignment) {
    return { allowed: true, membershipRole: membership?.role ?? null, staffAssignmentId: staffAssignment.id };
  }

  return { allowed: false, membershipRole: membership?.role ?? null, staffAssignmentId: null as number | null, reason: "NO_PERMISSION" };
}
