import { resolveServiceAssignmentMode } from "@/lib/reservas/serviceAssignment";
import { resolveServicePartySizeRules } from "@/lib/reservas/servicePartySize";

export const PUBLIC_ORGANIZATION_FIXED_SECTIONS = [
  "AGENDA_PUBLICA",
  "RESERVAS",
  "FORMULARIOS",
  "LOJA",
] as const;

export type PublicOrganizationFixedSection = (typeof PUBLIC_ORGANIZATION_FIXED_SECTIONS)[number];

type PublicStoreVisibilityInput = {
  status?: string | null;
  showOnProfile?: boolean | null;
  publicProductCount?: number | null;
};

type PublicStorefrontAvailabilityInput = PublicStoreVisibilityInput & {
  checkoutEnabled?: boolean | null;
  catalogLocked?: boolean | null;
  paymentsReady?: boolean | null;
};

type PublicReservasServiceInput = {
  kind?: string | null;
  assignmentMode?: string | null;
  partySizeRequired?: boolean | null;
  partySizeMin?: number | null;
  partySizeMax?: number | null;
  partySizeStep?: number | null;
  professionalLinks?: Array<{ professionalId?: number | null }> | null;
  resourceLinks?: Array<{ resourceId?: number | null }> | null;
};

type PublicReservasProfessionalInput = {
  id?: number | null;
};

type PublicReservasResourceInput = {
  id?: number | null;
  capacity?: number | null;
  courtId?: number | null;
};

type PublicReservasVisibilityInput = {
  moduleEnabled?: boolean | null;
  organizationAssignmentMode?: string | null;
  services?: PublicReservasServiceInput[] | null;
  professionals?: PublicReservasProfessionalInput[] | null;
  resources?: PublicReservasResourceInput[] | null;
};

function parsePositiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function uniquePositiveIds(values: unknown[]): number[] {
  const ids = new Set<number>();
  values.forEach((value) => {
    const id = parsePositiveInt(value);
    if (id) ids.add(id);
  });
  return Array.from(ids.values());
}

export function canOpenPublicStorefront(input: PublicStorefrontAvailabilityInput): boolean {
  const status = typeof input.status === "string" ? input.status.trim().toUpperCase() : "";
  const publicProductCount =
    typeof input.publicProductCount === "number" && Number.isFinite(input.publicProductCount)
      ? Math.max(0, Math.floor(input.publicProductCount))
      : 0;
  const checkoutEnabled = input.checkoutEnabled === true;
  const catalogLocked = input.catalogLocked === true;
  const paymentsReady = input.paymentsReady === true;
  return (
    status === "ACTIVE" &&
    input.showOnProfile === true &&
    checkoutEnabled &&
    !catalogLocked &&
    paymentsReady &&
    publicProductCount >= 1
  );
}

export function canShowPublicReservasSection(input: PublicReservasVisibilityInput): boolean {
  if (input.moduleEnabled !== true) return false;

  const services = Array.isArray(input.services) ? input.services : [];
  if (services.length === 0) return false;

  const activeProfessionalIds = new Set(
    uniquePositiveIds((input.professionals ?? []).map((professional) => professional?.id)),
  );

  const activeResourcesById = new Map<number, { capacity: number; courtId: number | null }>();
  (input.resources ?? []).forEach((resource) => {
    const id = parsePositiveInt(resource?.id);
    if (!id) return;
    const capacity = parsePositiveInt(resource?.capacity) ?? 1;
    const courtId = parsePositiveInt(resource?.courtId);
    activeResourcesById.set(id, { capacity, courtId });
  });

  return services.some((service) => {
    const assignment = resolveServiceAssignmentMode({
      organizationMode: input.organizationAssignmentMode ?? null,
      serviceMode: service.assignmentMode ?? null,
      serviceKind: service.kind ?? null,
    });
    const partySizeRules = resolveServicePartySizeRules({
      assignmentMode: assignment.assignmentMode,
      serviceKind: service.kind ?? null,
      partySizeRequired: service.partySizeRequired ?? undefined,
      partySizeMin: service.partySizeMin ?? undefined,
      partySizeMax: service.partySizeMax ?? undefined,
      partySizeStep: service.partySizeStep ?? undefined,
    });
    const minCapacityRequired =
      assignment.requiresResource && partySizeRules.partySizeRequired
        ? partySizeRules.partySizeMin
        : null;

    const resourceAllowed = (resource: { capacity: number; courtId: number | null }) => {
      if (assignment.isCourtService && resource.courtId == null) return false;
      if (minCapacityRequired != null && resource.capacity < minCapacityRequired) return false;
      return true;
    };

    const linkedProfessionalIds = uniquePositiveIds(
      (service.professionalLinks ?? []).map((link) => link?.professionalId),
    );
    const linkedResourceIds = uniquePositiveIds(
      (service.resourceLinks ?? []).map((link) => link?.resourceId),
    );

    const hasAvailableProfessional = assignment.requiresProfessional
      ? linkedProfessionalIds.length > 0
        ? linkedProfessionalIds.some((id) => activeProfessionalIds.has(id))
        : activeProfessionalIds.size > 0
      : true;

    const hasAvailableResource = assignment.requiresResource
      ? linkedResourceIds.length > 0
        ? linkedResourceIds.some((id) => {
            const resource = activeResourcesById.get(id);
            return resource ? resourceAllowed(resource) : false;
          })
        : Array.from(activeResourcesById.values()).some(resourceAllowed)
      : true;

    return hasAvailableProfessional && hasAvailableResource;
  });
}

export function canPublishStoreOnProfile(publicProductCount: number): { ok: true } | { ok: false; error: string } {
  const count = Number.isFinite(publicProductCount) ? Math.max(0, Math.floor(publicProductCount)) : 0;
  if (count >= 1) {
    return { ok: true };
  }
  return {
    ok: false,
    error: "Não foi possível publicar a loja: adiciona e publica pelo menos 1 produto público.",
  };
}
