export const ORGANIZATION_CATEGORIES = ["EVENTOS", "PADEL", "VOLUNTARIADO"] as const;
export type OrganizationCategory = (typeof ORGANIZATION_CATEGORIES)[number];

export const ORGANIZATION_MODULES = ["INSCRICOES"] as const;
export type OrganizationModule = (typeof ORGANIZATION_MODULES)[number];

export const DEFAULT_ORGANIZATION_CATEGORY: OrganizationCategory = "EVENTOS";
export const DEFAULT_ORGANIZATION_MODULES: OrganizationModule[] = ["INSCRICOES"];

const organizationCategorySet = new Set<OrganizationCategory>(ORGANIZATION_CATEGORIES);
const organizationModuleSet = new Set<OrganizationModule>(ORGANIZATION_MODULES);

export function parseOrganizationCategory(value: unknown): OrganizationCategory | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return organizationCategorySet.has(normalized as OrganizationCategory)
    ? (normalized as OrganizationCategory)
    : null;
}

export function parseOrganizationModules(value: unknown): OrganizationModule[] | null {
  if (!Array.isArray(value)) return null;
  const normalized: OrganizationModule[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const candidate = entry.trim().toUpperCase();
    if (!candidate) return null;
    if (!organizationModuleSet.has(candidate as OrganizationModule)) return null;
    if (!normalized.includes(candidate as OrganizationModule)) {
      normalized.push(candidate as OrganizationModule);
    }
  }
  return normalized;
}
