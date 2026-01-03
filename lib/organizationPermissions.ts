import { OrganizationMemberRole } from "@prisma/client";

const ROLE_WEIGHT: Record<OrganizationMemberRole, number> = {
  [OrganizationMemberRole.VIEWER]: 0,
  [OrganizationMemberRole.PROMOTER]: 0,
  [OrganizationMemberRole.STAFF]: 1,
  [OrganizationMemberRole.ADMIN]: 2,
  [OrganizationMemberRole.CO_OWNER]: 3,
  [OrganizationMemberRole.OWNER]: 4,
};

const ADMIN_MANAGEABLE = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.STAFF,
  OrganizationMemberRole.PROMOTER,
  OrganizationMemberRole.VIEWER,
]);

const CO_OWNER_MANAGEABLE = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
  OrganizationMemberRole.PROMOTER,
  OrganizationMemberRole.VIEWER,
]);

export function isOrgOwner(role: OrganizationMemberRole | null | undefined) {
  return role === OrganizationMemberRole.OWNER;
}

export function isOrgCoOwnerOrAbove(role: OrganizationMemberRole | null | undefined) {
  return role ? ROLE_WEIGHT[role] >= ROLE_WEIGHT[OrganizationMemberRole.CO_OWNER] : false;
}

export function isOrgAdminOrAbove(role: OrganizationMemberRole | null | undefined) {
  return role ? ROLE_WEIGHT[role] >= ROLE_WEIGHT[OrganizationMemberRole.ADMIN] : false;
}

export function canManageEvents(role: OrganizationMemberRole | null | undefined) {
  return role === OrganizationMemberRole.STAFF || isOrgAdminOrAbove(role);
}

export function canManageBilling(role: OrganizationMemberRole | null | undefined) {
  return role === OrganizationMemberRole.OWNER;
}

export function canManageMembers(
  actorRole: OrganizationMemberRole | null | undefined,
  targetCurrentRole: OrganizationMemberRole | null | undefined,
  desiredRole: OrganizationMemberRole | null | undefined,
) {
  if (!actorRole) return false;
  if (actorRole === OrganizationMemberRole.OWNER) return true;

  if (actorRole === OrganizationMemberRole.CO_OWNER) {
    if (
      targetCurrentRole === OrganizationMemberRole.OWNER ||
      targetCurrentRole === OrganizationMemberRole.CO_OWNER ||
      desiredRole === OrganizationMemberRole.OWNER ||
      desiredRole === OrganizationMemberRole.CO_OWNER
    ) {
      return false;
    }
    const target = targetCurrentRole ?? desiredRole;
    return target ? CO_OWNER_MANAGEABLE.has(target) : true;
  }

  if (actorRole === OrganizationMemberRole.ADMIN) {
    const target = targetCurrentRole ?? desiredRole;
    if (target && !ADMIN_MANAGEABLE.has(target)) return false;
    return desiredRole ? ADMIN_MANAGEABLE.has(desiredRole) : true;
  }

  return false;
}
