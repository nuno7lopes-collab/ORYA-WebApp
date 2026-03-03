import { OrganizationMemberRole, OrganizationRolePack } from "@prisma/client";

export const ROLE_PACK_LABELS: Record<OrganizationRolePack, string> = {
  CLUB_MANAGER: "Gestor de Clube",
  TOURNAMENT_DIRECTOR: "Diretor de Torneio",
  FRONT_DESK: "Receção",
  COACH: "Treinador",
  REFEREE: "Árbitro",
};

export const ROLE_PACK_DESCRIPTIONS: Record<OrganizationRolePack, string> = {
  CLUB_MANAGER: "Gestão transversal do clube: operação, CRM, marketing e supervisão.",
  TOURNAMENT_DIRECTOR: "Coordenação competitiva: torneios, inscrições e operação de prova.",
  FRONT_DESK: "Operação diária de balcão: reservas, inscrições e atendimento CRM.",
  COACH: "Execução técnica: aulas/treinos e acompanhamento operacional de atletas.",
  REFEREE: "Operação de jogo: validação competitiva, conflitos e integridade da prova.",
};

const ROLE_PACKS_BY_ROLE: Partial<Record<OrganizationMemberRole, readonly OrganizationRolePack[]>> = {
  OWNER: [],
  CO_OWNER: [],
  ADMIN: [],
  STAFF: [
    OrganizationRolePack.CLUB_MANAGER,
    OrganizationRolePack.TOURNAMENT_DIRECTOR,
    OrganizationRolePack.FRONT_DESK,
    OrganizationRolePack.COACH,
    OrganizationRolePack.REFEREE,
  ],
};

const DEFAULT_ROLE_PACK_BY_ROLE: Partial<Record<OrganizationMemberRole, OrganizationRolePack>> = {
  STAFF: OrganizationRolePack.FRONT_DESK,
};

export type RolePackPolicyErrorCode =
  | "INVALID_ROLE_PACK"
  | "ROLE_PACK_NOT_ALLOWED"
  | "ROLE_PACK_REQUIRED"
  | "ROLE_PACK_INCOMPATIBLE";

type ResolveRolePackOk = {
  ok: true;
  rolePack: OrganizationRolePack | null;
  usedDefault: boolean;
};

type ResolveRolePackErr = {
  ok: false;
  errorCode: RolePackPolicyErrorCode;
  allowedRolePacks: readonly OrganizationRolePack[];
};

export type ResolveRolePackResult = ResolveRolePackOk | ResolveRolePackErr;

export function getAllowedRolePacksForRole(role: OrganizationMemberRole) {
  return ROLE_PACKS_BY_ROLE[role] ?? [];
}

export function getDefaultRolePackForRole(role: OrganizationMemberRole) {
  return DEFAULT_ROLE_PACK_BY_ROLE[role] ?? null;
}

export function getRolePackLabel(rolePack: OrganizationRolePack) {
  return ROLE_PACK_LABELS[rolePack] ?? rolePack;
}

export function getRolePackDescription(rolePack: OrganizationRolePack) {
  return ROLE_PACK_DESCRIPTIONS[rolePack] ?? rolePack;
}

export function parseOrganizationRolePack(value: unknown): OrganizationRolePack | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (!Object.values(OrganizationRolePack).includes(normalized as OrganizationRolePack)) return null;
  return normalized as OrganizationRolePack;
}

export function resolveRolePackForRole(input: {
  role: OrganizationMemberRole;
  rolePackRaw: unknown;
  rolePackProvided: boolean;
  allowDefaultForLegacy?: boolean;
}): ResolveRolePackResult {
  const { role, rolePackRaw, rolePackProvided, allowDefaultForLegacy = false } = input;
  const allowedRolePacks = getAllowedRolePacksForRole(role);
  const parsedRolePack = parseOrganizationRolePack(rolePackRaw);
  const hasRawValue =
    rolePackRaw !== null &&
    rolePackRaw !== undefined &&
    (typeof rolePackRaw !== "string" || rolePackRaw.trim().length > 0);

  if (rolePackProvided && hasRawValue && !parsedRolePack) {
    return { ok: false, errorCode: "INVALID_ROLE_PACK", allowedRolePacks };
  }

  if (allowedRolePacks.length === 0) {
    if (parsedRolePack) {
      return { ok: false, errorCode: "ROLE_PACK_NOT_ALLOWED", allowedRolePacks };
    }
    return { ok: true, rolePack: null, usedDefault: false };
  }

  if (!parsedRolePack) {
    if (allowDefaultForLegacy) {
      const fallback = getDefaultRolePackForRole(role);
      if (fallback) {
        return { ok: true, rolePack: fallback, usedDefault: true };
      }
    }
    return { ok: false, errorCode: "ROLE_PACK_REQUIRED", allowedRolePacks };
  }

  if (!allowedRolePacks.includes(parsedRolePack)) {
    return { ok: false, errorCode: "ROLE_PACK_INCOMPATIBLE", allowedRolePacks };
  }

  return { ok: true, rolePack: parsedRolePack, usedDefault: false };
}
