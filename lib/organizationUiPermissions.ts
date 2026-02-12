import { OrganizationRolePack } from "@prisma/client";

export type OrganizationUiRole =
  | "OWNER"
  | "CO_OWNER"
  | "ADMIN"
  | "STAFF"
  | "TRAINER"
  | "PROMOTER";

const ROLE_SET = new Set<OrganizationUiRole>([
  "OWNER",
  "CO_OWNER",
  "ADMIN",
  "STAFF",
  "TRAINER",
  "PROMOTER",
]);

const ROLE_PACK_SET = new Set<OrganizationRolePack>([
  OrganizationRolePack.CLUB_MANAGER,
  OrganizationRolePack.TOURNAMENT_DIRECTOR,
  OrganizationRolePack.FRONT_DESK,
  OrganizationRolePack.COACH,
  OrganizationRolePack.REFEREE,
]);

export function normalizeOrganizationUiRole(role?: string | null): OrganizationUiRole | null {
  if (!role) return null;
  const normalized = role.toUpperCase() as OrganizationUiRole;
  return ROLE_SET.has(normalized) ? normalized : null;
}

export function getOrganizationRoleFlags(role?: string | null, rolePack?: string | null) {
  const normalized = normalizeOrganizationUiRole(role);
  const normalizedPack = rolePack && ROLE_PACK_SET.has(rolePack as OrganizationRolePack)
    ? (rolePack as OrganizationRolePack)
    : null;
  const isOwner = normalized === "OWNER";
  const isCoOwner = normalized === "CO_OWNER";
  const isAdmin = normalized === "ADMIN";
  const isStaff = normalized === "STAFF";
  const isTrainer = normalized === "TRAINER";
  const isPromoter = normalized === "PROMOTER";
  const isAdminOrAbove = isOwner || isCoOwner || isAdmin;
  const isManager = isAdminOrAbove;
  const isPromoterOnly = isPromoter && !isAdminOrAbove;
  return {
    role: normalized,
    rolePack: normalizedPack,
    isOwner,
    isCoOwner,
    isAdmin,
    isStaff,
    isTrainer,
    isPromoter,
    isAdminOrAbove,
    isPromoterOnly,
    canViewFinance: isManager,
    canManageMembers: isManager,
    canEditOrg: isManager,
    canViewOperationalSettings: isManager,
    canViewTrainerHub: isTrainer || isManager,
    canPromote: isAdminOrAbove || isPromoter,
  };
}
