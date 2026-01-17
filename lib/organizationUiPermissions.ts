export type OrganizationUiRole =
  | "OWNER"
  | "CO_OWNER"
  | "ADMIN"
  | "STAFF"
  | "TRAINER"
  | "PROMOTER"
  | "VIEWER";

const ROLE_SET = new Set<OrganizationUiRole>([
  "OWNER",
  "CO_OWNER",
  "ADMIN",
  "STAFF",
  "TRAINER",
  "PROMOTER",
  "VIEWER",
]);

export function normalizeOrganizationUiRole(role?: string | null): OrganizationUiRole | null {
  if (!role) return null;
  const normalized = role.toUpperCase() as OrganizationUiRole;
  return ROLE_SET.has(normalized) ? normalized : null;
}

export function getOrganizationRoleFlags(role?: string | null) {
  const normalized = normalizeOrganizationUiRole(role);
  const isOwner = normalized === "OWNER";
  const isCoOwner = normalized === "CO_OWNER";
  const isAdmin = normalized === "ADMIN";
  const isStaff = normalized === "STAFF";
  const isTrainer = normalized === "TRAINER";
  const isPromoter = normalized === "PROMOTER";
  const isViewer = normalized === "VIEWER";
  const isAdminOrAbove = isOwner || isCoOwner || isAdmin;
  const isManager = isAdminOrAbove;
  const isPromoterOnly = isPromoter && !isAdminOrAbove;

  return {
    role: normalized,
    isOwner,
    isCoOwner,
    isAdmin,
    isStaff,
    isTrainer,
    isPromoter,
    isViewer,
    isAdminOrAbove,
    isPromoterOnly,
    canManageEvents: isStaff || isManager,
    canViewFinance: isManager,
    canManageMembers: isManager,
    canEditOrg: isManager,
    canAccessOperationalSettings: isManager,
    canAccessTrainerHub: isTrainer || isManager,
    canPromote: isAdminOrAbove || isPromoter,
  };
}
