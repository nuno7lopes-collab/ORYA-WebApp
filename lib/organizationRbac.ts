import type {
  OrganizationMemberRole,
  OrganizationModule,
  OrganizationRolePack,
} from "@prisma/client";

export type ModuleAccessLevel = "NONE" | "VIEW" | "EDIT";

export type CheckinAccessLevel = ModuleAccessLevel;

export type MemberPermissionOverride = {
  moduleKey: OrganizationModule;
  accessLevel: ModuleAccessLevel | "VIEW" | "EDIT";
  scopeType?: string | null;
  scopeId?: string | null;
};

const ACCESS_ORDER: Record<ModuleAccessLevel, number> = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
};

export const ACCESS_LABELS: Record<ModuleAccessLevel, string> = {
  NONE: "Sem acesso",
  VIEW: "Ver",
  EDIT: "Editar",
};

export const MODULE_LABELS: Record<OrganizationModule, string> = {
  EVENTOS: "Eventos",
  RESERVAS: "Operação",
  TORNEIOS: "Torneios de Padel",
  STAFF: "Equipa",
  FINANCEIRO: "Financeiro",
  MENSAGENS: "Comunidade",
  CRM: "CRM",
  MARKETING: "Marketing",
  LOJA: "Loja",
  ANALYTICS: "Relatórios",
  DEFINICOES: "Configurações",
  PERFIL_PUBLICO: "Perfil do Clube",
  INSCRICOES: "Inscrições",
};

const ROLE_BASE_ACCESS: Partial<Record<OrganizationMemberRole, Partial<Record<OrganizationModule, ModuleAccessLevel>>>> = {
  OWNER: {
    EVENTOS: "EDIT",
    RESERVAS: "EDIT",
    TORNEIOS: "EDIT",
    STAFF: "EDIT",
    FINANCEIRO: "EDIT",
    MENSAGENS: "EDIT",
    CRM: "EDIT",
    MARKETING: "EDIT",
    LOJA: "EDIT",
    ANALYTICS: "EDIT",
    DEFINICOES: "EDIT",
    PERFIL_PUBLICO: "EDIT",
    INSCRICOES: "EDIT",
  },
  CO_OWNER: {
    EVENTOS: "EDIT",
    RESERVAS: "EDIT",
    TORNEIOS: "EDIT",
    STAFF: "EDIT",
    FINANCEIRO: "EDIT",
    MENSAGENS: "EDIT",
    CRM: "EDIT",
    MARKETING: "EDIT",
    LOJA: "EDIT",
    ANALYTICS: "EDIT",
    DEFINICOES: "EDIT",
    PERFIL_PUBLICO: "EDIT",
    INSCRICOES: "EDIT",
  },
  ADMIN: {
    EVENTOS: "EDIT",
    RESERVAS: "EDIT",
    TORNEIOS: "EDIT",
    STAFF: "EDIT",
    FINANCEIRO: "EDIT",
    MENSAGENS: "EDIT",
    CRM: "EDIT",
    MARKETING: "EDIT",
    LOJA: "EDIT",
    ANALYTICS: "EDIT",
    DEFINICOES: "EDIT",
    PERFIL_PUBLICO: "EDIT",
    INSCRICOES: "EDIT",
  },
  STAFF: {
    EVENTOS: "VIEW",
    RESERVAS: "VIEW",
    TORNEIOS: "VIEW",
    MENSAGENS: "VIEW",
    INSCRICOES: "VIEW",
  },
};

type RolePackAccess = {
  modules: Partial<Record<OrganizationModule, ModuleAccessLevel>>;
  checkin: CheckinAccessLevel;
};

const ROLE_PACK_ACCESS: Record<OrganizationRolePack, RolePackAccess> = {
  CLUB_MANAGER: {
    modules: {
      EVENTOS: "EDIT",
      TORNEIOS: "EDIT",
      RESERVAS: "EDIT",
      INSCRICOES: "EDIT",
      CRM: "EDIT",
      MARKETING: "EDIT",
      MENSAGENS: "EDIT",
      ANALYTICS: "VIEW",
      FINANCEIRO: "VIEW",
      LOJA: "VIEW",
      PERFIL_PUBLICO: "EDIT",
      STAFF: "VIEW",
      DEFINICOES: "VIEW",
    },
    checkin: "EDIT",
  },
  TOURNAMENT_DIRECTOR: {
    modules: {
      EVENTOS: "EDIT",
      TORNEIOS: "EDIT",
      INSCRICOES: "EDIT",
      RESERVAS: "VIEW",
      MENSAGENS: "EDIT",
      CRM: "VIEW",
      ANALYTICS: "VIEW",
    },
    checkin: "EDIT",
  },
  FRONT_DESK: {
    modules: {
      EVENTOS: "VIEW",
      RESERVAS: "EDIT",
      TORNEIOS: "VIEW",
      INSCRICOES: "EDIT",
      CRM: "EDIT",
      MENSAGENS: "EDIT",
      PERFIL_PUBLICO: "VIEW",
    },
    checkin: "EDIT",
  },
  COACH: {
    modules: {
      EVENTOS: "VIEW",
      RESERVAS: "EDIT",
      TORNEIOS: "VIEW",
      INSCRICOES: "VIEW",
      CRM: "VIEW",
      MENSAGENS: "VIEW",
    },
    checkin: "VIEW",
  },
  REFEREE: {
    modules: {
      EVENTOS: "VIEW",
      TORNEIOS: "EDIT",
      INSCRICOES: "EDIT",
      RESERVAS: "VIEW",
      MENSAGENS: "VIEW",
      ANALYTICS: "VIEW",
    },
    checkin: "VIEW",
  },
};

const ROLE_CHECKIN_ACCESS: Partial<Record<OrganizationMemberRole, CheckinAccessLevel>> = {
  OWNER: "EDIT",
  CO_OWNER: "EDIT",
  ADMIN: "EDIT",
  STAFF: "NONE",
};

const ADMIN_ROLE_SET = new Set<OrganizationMemberRole>(["OWNER", "CO_OWNER", "ADMIN"]);
const ROLE_PACK_ROLE_SET = new Set<OrganizationMemberRole>(["STAFF"]);

function shouldUseRolePack(role: OrganizationMemberRole | null | undefined, rolePack?: OrganizationRolePack | null) {
  if (!rolePack) return false;
  if (!role) return false;
  if (ADMIN_ROLE_SET.has(role)) return false;
  return ROLE_PACK_ROLE_SET.has(role);
}

export function normalizeAccessLevel(value: string | null | undefined): ModuleAccessLevel | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  if (normalized === "NONE") return "NONE";
  if (normalized === "VIEW") return "VIEW";
  if (normalized === "EDIT") return "EDIT";
  return null;
}

export function getDefaultModuleAccess(role?: OrganizationMemberRole | null) {
  const base: Record<OrganizationModule, ModuleAccessLevel> = {
    EVENTOS: "NONE",
    RESERVAS: "NONE",
    TORNEIOS: "NONE",
    STAFF: "NONE",
    FINANCEIRO: "NONE",
    MENSAGENS: "NONE",
    CRM: "NONE",
    MARKETING: "NONE",
    LOJA: "NONE",
    ANALYTICS: "NONE",
    DEFINICOES: "NONE",
    PERFIL_PUBLICO: "NONE",
    INSCRICOES: "NONE",
  };

  if (!role) return base;
  const roleAccess = ROLE_BASE_ACCESS[role] ?? {};
  Object.entries(roleAccess).forEach(([key, value]) => {
    const moduleKey = key as OrganizationModule;
    base[moduleKey] = value ?? base[moduleKey];
  });

  return base;
}

export function getDefaultModuleAccessForRolePack(rolePack?: OrganizationRolePack | null) {
  const base: Record<OrganizationModule, ModuleAccessLevel> = {
    EVENTOS: "NONE",
    RESERVAS: "NONE",
    TORNEIOS: "NONE",
    STAFF: "NONE",
    FINANCEIRO: "NONE",
    MENSAGENS: "NONE",
    CRM: "NONE",
    MARKETING: "NONE",
    LOJA: "NONE",
    ANALYTICS: "NONE",
    DEFINICOES: "NONE",
    PERFIL_PUBLICO: "NONE",
    INSCRICOES: "NONE",
  };

  if (!rolePack) return base;
  const roleAccess = ROLE_PACK_ACCESS[rolePack]?.modules ?? {};
  Object.entries(roleAccess).forEach(([key, value]) => {
    const moduleKey = key as OrganizationModule;
    base[moduleKey] = value ?? base[moduleKey];
  });

  return base;
}

export function resolveMemberModuleAccess(input: {
  role: OrganizationMemberRole | null | undefined;
  rolePack?: OrganizationRolePack | null;
  overrides?: MemberPermissionOverride[];
}) {
  const { role, rolePack, overrides = [] } = input;
  const access = shouldUseRolePack(role, rolePack)
    ? getDefaultModuleAccessForRolePack(rolePack)
    : getDefaultModuleAccess(role);
  overrides.forEach((override) => {
    if (override.scopeType || override.scopeId) return;
    const normalized = normalizeAccessLevel(override.accessLevel);
    if (!normalized) return;
    access[override.moduleKey] = normalized;
  });
  return access;
}

export function resolveCheckinAccess(input: {
  role: OrganizationMemberRole | null | undefined;
  rolePack?: OrganizationRolePack | null;
}): CheckinAccessLevel {
  const { role, rolePack } = input;
  if (shouldUseRolePack(role, rolePack) && rolePack) {
    return ROLE_PACK_ACCESS[rolePack]?.checkin ?? "NONE";
  }
  if (!role) return "NONE";
  return ROLE_CHECKIN_ACCESS[role] ?? "NONE";
}

export function resolveModuleAccess(
  role: OrganizationMemberRole | null | undefined,
  overrides: MemberPermissionOverride[] = [],
) {
  const access = getDefaultModuleAccess(role);
  overrides.forEach((override) => {
    if (override.scopeType || override.scopeId) return;
    const normalized = normalizeAccessLevel(override.accessLevel);
    if (!normalized) return;
    access[override.moduleKey] = normalized;
  });
  return access;
}

export function accessLevelSatisfies(
  current: ModuleAccessLevel,
  required: ModuleAccessLevel = "VIEW",
) {
  return ACCESS_ORDER[current] >= ACCESS_ORDER[required];
}

export function hasModuleAccess(
  access: Record<OrganizationModule, ModuleAccessLevel>,
  moduleKey: OrganizationModule,
  required: ModuleAccessLevel = "VIEW",
) {
  const current = access[moduleKey] ?? "NONE";
  return ACCESS_ORDER[current] >= ACCESS_ORDER[required];
}

export function formatAccessLabel(level: ModuleAccessLevel) {
  return ACCESS_LABELS[level] ?? level;
}
