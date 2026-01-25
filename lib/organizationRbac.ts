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
  RESERVAS: "Reservas",
  TORNEIOS: "Padel e torneios",
  STAFF: "Equipa",
  FINANCEIRO: "Financas",
  MENSAGENS: "Chat interno",
  CRM: "CRM",
  MARKETING: "Promocoes",
  LOJA: "Loja",
  ANALYTICS: "Analytics",
  DEFINICOES: "Definicoes",
  PERFIL_PUBLICO: "Perfil publico",
  INSCRICOES: "Formularios",
};

const ROLE_BASE_ACCESS: Record<OrganizationMemberRole, Partial<Record<OrganizationModule, ModuleAccessLevel>>> = {
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
    RESERVAS: "EDIT",
    TORNEIOS: "EDIT",
    MENSAGENS: "EDIT",
    LOJA: "EDIT",
    INSCRICOES: "EDIT",
  },
  TRAINER: {
    TORNEIOS: "EDIT",
    RESERVAS: "VIEW",
  },
  PROMOTER: {
    MARKETING: "EDIT",
  },
  VIEWER: {},
};

type RolePackAccess = {
  modules: Partial<Record<OrganizationModule, ModuleAccessLevel>>;
  checkin: CheckinAccessLevel;
};

const ROLE_PACK_ACCESS: Record<OrganizationRolePack, RolePackAccess> = {
  CLUB_MANAGER: {
    modules: {
      TORNEIOS: "EDIT",
      RESERVAS: "EDIT",
      CRM: "EDIT",
      STAFF: "VIEW",
      DEFINICOES: "VIEW",
    },
    checkin: "EDIT",
  },
  TOURNAMENT_DIRECTOR: {
    modules: {
      TORNEIOS: "EDIT",
      EVENTOS: "EDIT",
      RESERVAS: "VIEW",
    },
    checkin: "EDIT",
  },
  FRONT_DESK: {
    modules: {
      RESERVAS: "EDIT",
      EVENTOS: "VIEW",
      CRM: "VIEW",
    },
    checkin: "EDIT",
  },
  COACH: {
    modules: {
      RESERVAS: "EDIT",
      TORNEIOS: "VIEW",
      CRM: "VIEW",
    },
    checkin: "NONE",
  },
  REFEREE: {
    modules: {
      TORNEIOS: "EDIT",
      EVENTOS: "VIEW",
    },
    checkin: "VIEW",
  },
};

const ROLE_CHECKIN_ACCESS: Record<OrganizationMemberRole, CheckinAccessLevel> = {
  OWNER: "EDIT",
  CO_OWNER: "EDIT",
  ADMIN: "EDIT",
  STAFF: "EDIT",
  TRAINER: "NONE",
  PROMOTER: "NONE",
  VIEWER: "NONE",
};

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
  const access = rolePack ? getDefaultModuleAccessForRolePack(rolePack) : getDefaultModuleAccess(role);
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
  if (rolePack) {
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
