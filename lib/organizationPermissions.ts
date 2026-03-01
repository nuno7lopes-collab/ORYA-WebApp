import { OrganizationMemberRole } from "@prisma/client";

const ROLE_WEIGHT: Partial<Record<OrganizationMemberRole, number>> = {
  [OrganizationMemberRole.STAFF]: 0,
  [OrganizationMemberRole.ADMIN]: 1,
  [OrganizationMemberRole.CO_OWNER]: 2,
  [OrganizationMemberRole.OWNER]: 3,
};

const ADMIN_MANAGEABLE = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
]);

const CO_OWNER_MANAGEABLE = new Set<OrganizationMemberRole>([
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
]);

export function isOrgOwner(role: OrganizationMemberRole | null | undefined) {
  return role === OrganizationMemberRole.OWNER;
}

export function isOrgCoOwnerOrAbove(role: OrganizationMemberRole | null | undefined) {
  return role ? (ROLE_WEIGHT[role] ?? -1) >= (ROLE_WEIGHT[OrganizationMemberRole.CO_OWNER] ?? 0) : false;
}

export function isOrgAdminOrAbove(role: OrganizationMemberRole | null | undefined) {
  return role ? (ROLE_WEIGHT[role] ?? -1) >= (ROLE_WEIGHT[OrganizationMemberRole.ADMIN] ?? 0) : false;
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
      desiredRole === OrganizationMemberRole.OWNER
    ) {
      return false;
    }
    const target = targetCurrentRole ?? desiredRole;
    if (target && !CO_OWNER_MANAGEABLE.has(target)) return false;
    return desiredRole ? CO_OWNER_MANAGEABLE.has(desiredRole) : true;
  }

  if (actorRole === OrganizationMemberRole.ADMIN) {
    const target = targetCurrentRole ?? desiredRole;
    if (target && !ADMIN_MANAGEABLE.has(target)) return false;
    return desiredRole ? ADMIN_MANAGEABLE.has(desiredRole) : true;
  }

  return false;
}

type PermissionResult = { ok: true } | { ok: false; error: string };

function denyPermission(): PermissionResult {
  return { ok: false, error: "Sem permissoes." };
}

export function ensureOrgOwner(role: OrganizationMemberRole | null | undefined): PermissionResult {
  return isOrgOwner(role) ? { ok: true } : denyPermission();
}

export function ensureOrgCoOwnerOrAbove(role: OrganizationMemberRole | null | undefined): PermissionResult {
  return isOrgCoOwnerOrAbove(role) ? { ok: true } : denyPermission();
}

export function ensureOrgAdminOrAbove(role: OrganizationMemberRole | null | undefined): PermissionResult {
  return isOrgAdminOrAbove(role) ? { ok: true } : denyPermission();
}
