import { prisma } from "@/lib/prisma";
import { OrganizationModule, OrganizationPermissionLevel } from "@prisma/client";

export type ReservasScopes = {
  courtIds: number[];
  resourceIds: number[];
  professionalIds: number[];
  hasAny: boolean;
};

const toPositiveInt = (value: string | number | null) => {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
};

export async function resolveReservasScopesForMember(params: {
  organizationId: number;
  userId: string;
}): Promise<ReservasScopes> {
  const rows = await prisma.organizationMemberPermission.findMany({
    where: {
      organizationId: params.organizationId,
      userId: params.userId,
      moduleKey: OrganizationModule.RESERVAS,
      accessLevel: { in: [OrganizationPermissionLevel.VIEW, OrganizationPermissionLevel.EDIT] },
      scopeType: { in: ["COURT", "RESOURCE", "PROFESSIONAL"] },
    },
    select: { scopeType: true, scopeId: true },
  });

  const courtIds = new Set<number>();
  const resourceIds = new Set<number>();
  const professionalIds = new Set<number>();

  rows.forEach((row) => {
    const parsed = toPositiveInt(row.scopeId ?? null);
    if (!parsed) return;
    if (row.scopeType === "COURT") courtIds.add(parsed);
    if (row.scopeType === "RESOURCE") resourceIds.add(parsed);
    if (row.scopeType === "PROFESSIONAL") professionalIds.add(parsed);
  });

  const courts = Array.from(courtIds);
  const resources = Array.from(resourceIds);
  if (courts.length > 0 || resources.length > 0) {
    const linkedResources = await prisma.reservationResource.findMany({
      where: {
        organizationId: params.organizationId,
        OR: [
          ...(courts.length > 0 ? [{ courtId: { in: courts } }] : []),
          ...(resources.length > 0 ? [{ id: { in: resources } }] : []),
        ],
      },
      select: { id: true, courtId: true },
    });
    linkedResources.forEach((row) => {
      resourceIds.add(row.id);
      if (row.courtId) {
        courtIds.add(row.courtId);
      }
    });
  }
  const expandedCourts = Array.from(courtIds);
  const expandedResources = Array.from(resourceIds);
  const professionals = Array.from(professionalIds);

  return {
    courtIds: expandedCourts,
    resourceIds: expandedResources,
    professionalIds: professionals,
    hasAny: expandedCourts.length > 0 || expandedResources.length > 0 || professionals.length > 0,
  };
}

export async function resolveTrainerProfessionalIds(params: {
  organizationId: number;
  userId: string;
}) {
  const rows = await prisma.reservationProfessional.findMany({
    where: { organizationId: params.organizationId, userId: params.userId, isActive: true },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export function intersectIds(base: number[], filter?: number[] | null) {
  if (!filter || filter.length === 0) return base;
  const filterSet = new Set(filter);
  return base.filter((id) => filterSet.has(id));
}
