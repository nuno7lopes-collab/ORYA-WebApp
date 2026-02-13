export const ORGANIZATION_MODULES = [
  "EVENTOS",
  "RESERVAS",
  "TORNEIOS",
  "STAFF",
  "FINANCEIRO",
  "MENSAGENS",
  "CRM",
  "MARKETING",
  "LOJA",
  "ANALYTICS",
  "DEFINICOES",
  "PERFIL_PUBLICO",
  "INSCRICOES",
] as const;
export type OrganizationModule = (typeof ORGANIZATION_MODULES)[number];

export const OPERATION_MODULES = ["EVENTOS", "RESERVAS", "TORNEIOS"] as const;
export type OperationModule = (typeof OPERATION_MODULES)[number];

export const DEFAULT_PRIMARY_MODULE: OperationModule = "EVENTOS";
export const CORE_ORGANIZATION_MODULES: OrganizationModule[] = [
  "STAFF",
  "FINANCEIRO",
  "MARKETING",
  "DEFINICOES",
  "PERFIL_PUBLICO",
];
export const DEFAULT_ORGANIZATION_MODULES: OrganizationModule[] = [
  ...CORE_ORGANIZATION_MODULES,
  DEFAULT_PRIMARY_MODULE,
];

const operationModuleSet = new Set<OperationModule>(OPERATION_MODULES);
const organizationModuleSet = new Set<OrganizationModule>(ORGANIZATION_MODULES);

export function getDefaultOrganizationModules(
  primaryModule?: OperationModule | null,
): OrganizationModule[] {
  const resolvedPrimary = resolvePrimaryModule(primaryModule, null);
  const modules = [...CORE_ORGANIZATION_MODULES, resolvedPrimary];
  const unique = new Set<OrganizationModule>();
  const normalized: OrganizationModule[] = [];
  for (const entry of modules) {
    if (!unique.has(entry)) {
      unique.add(entry);
      normalized.push(entry);
    }
  }
  return normalized;
}

export function normalizePrimaryModule(value?: string | null): OperationModule {
  if (typeof value !== "string") return DEFAULT_PRIMARY_MODULE;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return DEFAULT_PRIMARY_MODULE;
  return operationModuleSet.has(normalized as OperationModule)
    ? (normalized as OperationModule)
    : DEFAULT_PRIMARY_MODULE;
}

export function parsePrimaryModule(value: unknown): OperationModule | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return operationModuleSet.has(normalized as OperationModule)
    ? (normalized as OperationModule)
    : null;
}

export function resolvePrimaryModule(
  primaryModule?: string | null,
  modules?: string[] | null,
): OperationModule {
  const parsed = parsePrimaryModule(primaryModule ?? null);
  if (parsed) return parsed;
  const fallback =
    Array.isArray(modules) &&
    modules
      .map((module) => module.trim().toUpperCase())
      .find((module) => operationModuleSet.has(module as OperationModule));
  return fallback ? (fallback as OperationModule) : DEFAULT_PRIMARY_MODULE;
}

export function parseOrganizationModules(value: unknown): OrganizationModule[] | null {
  if (!Array.isArray(value)) return null;
  const normalized: OrganizationModule[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    let candidate = entry.trim().toUpperCase();
    if (!candidate) return null;
    if (!organizationModuleSet.has(candidate as OrganizationModule)) return null;
    if (!normalized.includes(candidate as OrganizationModule)) {
      normalized.push(candidate as OrganizationModule);
    }
  }
  return normalized;
}
