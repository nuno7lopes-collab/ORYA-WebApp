"use server";

import { StaffRole, StaffScope, StaffStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Verifica se o utilizador tem permissão de staff (GLOBAL ou EVENT) para gerir padel no organizer.
 */
export async function isPadelStaff(userId: string, organizerId: number) {
  if (!userId || !organizerId) return false;
  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      userId,
      organizerId,
      status: StaffStatus.ACCEPTED,
      revokedAt: null,
      role: { in: [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.STAFF, StaffRole.CHECKIN] },
      scope: { in: [StaffScope.GLOBAL, StaffScope.EVENT] },
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

