export type OrganizationUiRole = "OWNER" | "CO_OWNER" | "ADMIN" | "STAFF" | "PROMOTER" | "VIEWER";

const ROLE_SET = new Set<OrganizationUiRole>([
  "OWNER",
  "CO_OWNER",
  "ADMIN",
  "STAFF",
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
  const isPromoter = normalized === "PROMOTER";
  const isViewer = normalized === "VIEWER";
  const isAdminOrAbove = isOwner || isCoOwner || isAdmin;
  const isPromoterOnly = isPromoter && !isAdminOrAbove;

  return {
    role: normalized,
    isOwner,
    isCoOwner,
    isAdmin,
    isStaff,
    isPromoter,
    isViewer,
    isAdminOrAbove,
    isPromoterOnly,
    canManageEvents: isStaff || isAdminOrAbove,
    canViewFinance: isAdminOrAbove,
    canManageMembers: isAdminOrAbove,
    canEditOrg: isAdminOrAbove,
    canPromote: isAdminOrAbove || isPromoter,
  };
}
