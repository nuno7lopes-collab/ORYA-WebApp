import { PadelClubStaffRole, PadelTournamentRole, Prisma } from "@prisma/client";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";

type SyncTournamentRolesFromStaffParams = {
  tx: Prisma.TransactionClient;
  organizationId: number;
  eventId: number;
  staffIds: number[];
  padelClubId?: number | null;
  includeAdminClubAsDirector?: boolean;
};

const normalizeStaffIds = (ids: number[]) =>
  Array.from(new Set(ids.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.floor(id))));

function mapClubStaffRoleToTournamentRoles(
  role: PadelClubStaffRole,
  includeAdminClubAsDirector: boolean,
): PadelTournamentRole[] {
  if (role === "DIRETOR_PROVA") return [PadelTournamentRole.DIRETOR_PROVA];
  if (role === "ADMIN_CLUBE" && includeAdminClubAsDirector) return [PadelTournamentRole.DIRETOR_PROVA];
  return [];
}

export async function syncTournamentOperationalRolesFromClubStaff(
  params: SyncTournamentRolesFromStaffParams,
): Promise<{ attempted: number; created: number; mappedUsers: number }> {
  const {
    tx,
    organizationId,
    eventId,
    staffIds,
    padelClubId = null,
    includeAdminClubAsDirector = true,
  } = params;
  const normalizedStaffIds = normalizeStaffIds(staffIds);
  if (normalizedStaffIds.length === 0) return { attempted: 0, created: 0, mappedUsers: 0 };

  const staffRows = await tx.padelClubStaff.findMany({
    where: {
      id: { in: normalizedStaffIds },
      isActive: true,
      deletedAt: null,
      ...(padelClubId ? { padelClubId } : {}),
    },
    select: { id: true, userId: true, role: true },
  });
  if (staffRows.length === 0) return { attempted: normalizedStaffIds.length, created: 0, mappedUsers: 0 };

  const members = await listEffectiveOrganizationMembers({
    organizationId,
    client: tx,
    userIds: Array.from(new Set(staffRows.map((row) => row.userId))),
  });
  const memberUserIds = new Set(members.map((member) => member.userId));
  if (memberUserIds.size === 0) {
    return { attempted: normalizedStaffIds.length, created: 0, mappedUsers: 0 };
  }

  const assignments = new Map<string, { userId: string; role: PadelTournamentRole }>();
  for (const row of staffRows) {
    if (!memberUserIds.has(row.userId)) continue;
    const mappedRoles = mapClubStaffRoleToTournamentRoles(row.role, includeAdminClubAsDirector);
    for (const role of mappedRoles) {
      assignments.set(`${row.userId}:${role}`, { userId: row.userId, role });
    }
  }

  if (assignments.size === 0) {
    return { attempted: normalizedStaffIds.length, created: 0, mappedUsers: 0 };
  }

  const created = await tx.padelTournamentRoleAssignment.createMany({
    data: Array.from(assignments.values()).map((item) => ({
      eventId,
      organizationId,
      userId: item.userId,
      role: item.role,
    })),
    skipDuplicates: true,
  });

  return {
    attempted: normalizedStaffIds.length,
    created: created.count,
    mappedUsers: new Set(Array.from(assignments.values()).map((item) => item.userId)).size,
  };
}
