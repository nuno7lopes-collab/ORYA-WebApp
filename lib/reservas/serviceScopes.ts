type ActiveRelationLike = { isActive?: boolean | null } | null | undefined;

export type ServiceProfessionalLinkLike = {
  professionalId: number;
  professional?: ActiveRelationLike;
};

export type ServiceResourceLinkLike = {
  resourceId: number;
  resource?: (ActiveRelationLike & { courtId?: number | null }) | null;
};

function dedupePositiveInts(values: number[]) {
  const set = new Set<number>();
  values.forEach((value) => {
    if (!Number.isFinite(value) || value <= 0) return;
    set.add(Math.trunc(value));
  });
  return Array.from(set);
}

function isLinkActive(relation: ActiveRelationLike) {
  if (!relation) return true;
  if (typeof relation.isActive !== "boolean") return true;
  return relation.isActive;
}

export function resolveAllowedServiceProfessionalIds(
  links: ServiceProfessionalLinkLike[],
) {
  if (links.length === 0) return null;
  const ids = dedupePositiveInts(
    links
      .filter((link) => isLinkActive(link.professional))
      .map((link) => link.professionalId),
  );
  return ids;
}

export function resolveAllowedServiceResourceIds(
  links: ServiceResourceLinkLike[],
) {
  if (links.length === 0) return null;
  const ids = dedupePositiveInts(
    links
      .filter((link) => isLinkActive(link.resource))
      .map((link) => link.resourceId),
  );
  return ids;
}

export function resolveAllowedServiceCourtIds(
  links: ServiceResourceLinkLike[],
) {
  if (links.length === 0) return null;
  const courtIds = dedupePositiveInts(
    links
      .filter((link) => isLinkActive(link.resource))
      .map((link) => Number(link.resource?.courtId ?? 0)),
  );
  return courtIds;
}

export function resolveAllowedServiceScopeIds(params: {
  professionalLinks: ServiceProfessionalLinkLike[];
  resourceLinks: ServiceResourceLinkLike[];
}) {
  return {
    allowedProfessionalIds: resolveAllowedServiceProfessionalIds(params.professionalLinks),
    allowedResourceIds: resolveAllowedServiceResourceIds(params.resourceLinks),
    allowedCourtIds: resolveAllowedServiceCourtIds(params.resourceLinks),
  };
}
