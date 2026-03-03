export type OrganizationUiRole =
  | "OWNER"
  | "CO_OWNER"
  | "ADMIN"
  | "STAFF";

type OrganizationUiRolePack =
  | "CLUB_MANAGER"
  | "TOURNAMENT_DIRECTOR"
  | "FRONT_DESK"
  | "COACH"
  | "REFEREE";

const ROLE_SET = new Set<OrganizationUiRole>([
  "OWNER",
  "CO_OWNER",
  "ADMIN",
  "STAFF",
]);

const ROLE_PACK_SET = new Set<OrganizationUiRolePack>([
  "CLUB_MANAGER",
  "TOURNAMENT_DIRECTOR",
  "FRONT_DESK",
  "COACH",
  "REFEREE",
]);

export function normalizeOrganizationUiRole(role?: string | null): OrganizationUiRole | null {
  if (!role) return null;
  const normalized = role.toUpperCase() as OrganizationUiRole;
  return ROLE_SET.has(normalized) ? normalized : null;
}

export function getOrganizationRoleFlags(role?: string | null, rolePack?: string | null) {
  const normalized = normalizeOrganizationUiRole(role);
  const normalizedRolePackRaw = typeof rolePack === "string" ? rolePack.trim().toUpperCase() : null;
  const normalizedPack =
    normalizedRolePackRaw && ROLE_PACK_SET.has(normalizedRolePackRaw as OrganizationUiRolePack)
      ? (normalizedRolePackRaw as OrganizationUiRolePack)
      : null;
  const isOwner = normalized === "OWNER";
  const isCoOwner = normalized === "CO_OWNER";
  const isAdmin = normalized === "ADMIN";
  const isStaff = normalized === "STAFF";
  const isAdminOrAbove = isOwner || isCoOwner || isAdmin;
  const isClubManager = isStaff && normalizedPack === "CLUB_MANAGER";
  const isTournamentDirector = isStaff && normalizedPack === "TOURNAMENT_DIRECTOR";
  const isFrontDesk = isStaff && normalizedPack === "FRONT_DESK";
  const isCoach = normalized === "STAFF" && normalizedPack === "COACH";
  const isReferee = normalized === "STAFF" && normalizedPack === "REFEREE";
  const isOperationalLead = isAdminOrAbove || isClubManager || isTournamentDirector;
  return {
    role: normalized,
    rolePack: normalizedPack,
    isOwner,
    isCoOwner,
    isAdmin,
    isStaff,
    isClubManager,
    isTournamentDirector,
    isFrontDesk,
    isCoach,
    isReferee,
    isAdminOrAbove,
    canViewFinance: isAdminOrAbove || isClubManager,
    canManageMembers: isAdminOrAbove,
    canEditOrg: isAdminOrAbove,
    canViewOperationalSettings: isAdminOrAbove || isClubManager,
    canViewCoachHub: isCoach || isOperationalLead,
    // "Promote" aqui significa acesso a ferramenta/flows de marketing.
    canPromote: isAdminOrAbove || isClubManager,
  };
}
