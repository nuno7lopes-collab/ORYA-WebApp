export type OrganizerUiRole = "OWNER" | "CO_OWNER" | "ADMIN" | "STAFF" | "PROMOTER" | "VIEWER";

const ROLE_SET = new Set<OrganizerUiRole>([
  "OWNER",
  "CO_OWNER",
  "ADMIN",
  "STAFF",
  "PROMOTER",
  "VIEWER",
]);

export function normalizeOrganizerUiRole(role?: string | null): OrganizerUiRole | null {
  if (!role) return null;
  const normalized = role.toUpperCase() as OrganizerUiRole;
  return ROLE_SET.has(normalized) ? normalized : null;
}

export function getOrganizerRoleFlags(role?: string | null) {
  const normalized = normalizeOrganizerUiRole(role);
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
