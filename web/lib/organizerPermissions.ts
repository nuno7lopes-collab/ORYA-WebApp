import { OrganizerMemberRole } from "@prisma/client";

const ROLE_WEIGHT: Record<OrganizerMemberRole, number> = {
  [OrganizerMemberRole.VIEWER]: 0,
  [OrganizerMemberRole.STAFF]: 1,
  [OrganizerMemberRole.ADMIN]: 2,
  [OrganizerMemberRole.CO_OWNER]: 3,
  [OrganizerMemberRole.OWNER]: 4,
};

const ADMIN_MANAGEABLE = new Set<OrganizerMemberRole>([
  OrganizerMemberRole.STAFF,
  OrganizerMemberRole.VIEWER,
]);

const CO_OWNER_MANAGEABLE = new Set<OrganizerMemberRole>([
  OrganizerMemberRole.ADMIN,
  OrganizerMemberRole.STAFF,
  OrganizerMemberRole.VIEWER,
]);

export function isOrgOwner(role: OrganizerMemberRole | null | undefined) {
  return role === OrganizerMemberRole.OWNER;
}

export function isOrgCoOwnerOrAbove(role: OrganizerMemberRole | null | undefined) {
  return role ? ROLE_WEIGHT[role] >= ROLE_WEIGHT[OrganizerMemberRole.CO_OWNER] : false;
}

export function isOrgAdminOrAbove(role: OrganizerMemberRole | null | undefined) {
  return role ? ROLE_WEIGHT[role] >= ROLE_WEIGHT[OrganizerMemberRole.ADMIN] : false;
}

export function canManageEvents(role: OrganizerMemberRole | null | undefined) {
  return isOrgAdminOrAbove(role);
}

export function canManageBilling(role: OrganizerMemberRole | null | undefined) {
  return role === OrganizerMemberRole.OWNER;
}

export function canManageMembers(
  actorRole: OrganizerMemberRole | null | undefined,
  targetCurrentRole: OrganizerMemberRole | null | undefined,
  desiredRole: OrganizerMemberRole | null | undefined,
) {
  if (!actorRole) return false;
  if (actorRole === OrganizerMemberRole.OWNER) return true;

  if (actorRole === OrganizerMemberRole.CO_OWNER) {
    if (
      targetCurrentRole === OrganizerMemberRole.OWNER ||
      targetCurrentRole === OrganizerMemberRole.CO_OWNER ||
      desiredRole === OrganizerMemberRole.OWNER ||
      desiredRole === OrganizerMemberRole.CO_OWNER
    ) {
      return false;
    }
    const target = targetCurrentRole ?? desiredRole;
    return target ? CO_OWNER_MANAGEABLE.has(target) : true;
  }

  if (actorRole === OrganizerMemberRole.ADMIN) {
    const target = targetCurrentRole ?? desiredRole;
    if (target && !ADMIN_MANAGEABLE.has(target)) return false;
    return desiredRole ? ADMIN_MANAGEABLE.has(desiredRole) : true;
  }

  return false;
}
