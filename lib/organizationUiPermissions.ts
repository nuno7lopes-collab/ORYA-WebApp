export type OrganizationUiRole =
  | "OWNER"
  | "CO_OWNER"
  | "ADMIN"
  | "STAFF"
  | "PROMOTER";

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
  "PROMOTER",
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
  const normalizedPack = rolePack && ROLE_PACK_SET.has(rolePack as OrganizationUiRolePack)
    ? (rolePack as OrganizationUiRolePack)
    : null;
  const isOwner = normalized === "OWNER";
  const isCoOwner = normalized === "CO_OWNER";
  const isAdmin = normalized === "ADMIN";
  const isStaff = normalized === "STAFF";
  const isPromoter = normalized === "PROMOTER";
  const isAdminOrAbove = isOwner || isCoOwner || isAdmin;
  const isManager = isAdminOrAbove;
  const isPromoterOnly = isPromoter && !isAdminOrAbove;
  const isCoach = normalized === "STAFF" && normalizedPack === "COACH";
  return {
    role: normalized,
    rolePack: normalizedPack,
    isOwner,
    isCoOwner,
    isAdmin,
    isStaff,
    isTrainer: false,
    isCoach,
    isPromoter,
    isAdminOrAbove,
    isPromoterOnly,
    canViewFinance: isManager,
    canManageMembers: isManager,
    canEditOrg: isManager,
    canViewOperationalSettings: isManager,
    canViewTrainerHub: isCoach || isManager,
    // "Promote" aqui significa acesso a ferramenta/flows de marketing (nao "ser promotor").
    // PROMOTER nao tem comportamento/permissoes especiais por agora.
    canPromote: isAdminOrAbove,
  };
}
