"use server";

import { StaffRole, StaffScope, StaffStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Verifica se o utilizador tem permissão de staff (GLOBAL ou EVENT) para gerir padel no organizer.
 */
export async function isPadelStaff(userId: string, organizerId: number, eventId?: number | null) {
  if (!userId || !organizerId) return false;
  const scopeFilter =
    typeof eventId === "number"
      ? { OR: [{ scope: StaffScope.GLOBAL }, { scope: StaffScope.EVENT, eventId }] }
      : { scope: StaffScope.GLOBAL };
  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      userId,
      organizerId,
      status: StaffStatus.ACCEPTED,
      revokedAt: null,
      role: { in: [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.STAFF, StaffRole.CHECKIN] },
      ...scopeFilter,
    },
    select: { id: true },
  });
  return Boolean(assignment);
}
