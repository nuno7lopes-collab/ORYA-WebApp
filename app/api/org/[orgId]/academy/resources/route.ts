import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveReservasScopesForMember } from "@/lib/reservas/memberScopes";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  const access = await resolveAcademyOrgAccess(req);
  if (!access.ok) return access.response;

  try {
    const includeCourts = (() => {
      const raw = req.nextUrl.searchParams.get("includeCourts");
      if (raw == null || raw === "") return true;
      return raw === "1" || raw === "true";
    })();

    const isStaff = access.membership.role === "STAFF";
    let allowedResourceIds: number[] | null = null;
    let allowedCourtIds: number[] | null = null;
    if (isStaff) {
      const scopes = await resolveReservasScopesForMember({
        organizationId: access.organization.id,
        userId: access.profile.id,
      });
      if (!scopes.hasAny) {
        return respondOk(access.ctx, { items: [] });
      }
      allowedResourceIds = scopes.resourceIds;
      allowedCourtIds = scopes.courtIds;
    }

    const staffScopeOr: Array<Record<string, unknown>> = [];
    if (isStaff) {
      if (allowedResourceIds && allowedResourceIds.length > 0) {
        staffScopeOr.push({ id: { in: allowedResourceIds } });
      }
      if (includeCourts && allowedCourtIds && allowedCourtIds.length > 0) {
        staffScopeOr.push({ courtId: { in: allowedCourtIds } });
      }
      if (staffScopeOr.length === 0) {
        return respondOk(access.ctx, { items: [] });
      }
    }

    const resources = await prisma.reservationResource.findMany({
      where: {
        organizationId: access.organization.id,
        ...(isStaff ? { OR: staffScopeOr } : {}),
      },
      orderBy: [{ capacity: "asc" }, { priority: "asc" }, { id: "asc" }],
      select: {
        id: true,
        label: true,
        capacity: true,
        isActive: true,
        priority: true,
        courtId: true,
        court: {
          select: {
            id: true,
            name: true,
            isActive: true,
            displayOrder: true,
            deletedAt: true,
            padelClubId: true,
            club: { select: { name: true, deletedAt: true } },
          },
        },
      },
    });

    const resourceItems = resources
      .filter((resource) => resource.courtId == null)
      .map((resource) => ({
        id: resource.id,
        label: resource.label,
        capacity: resource.capacity,
        isActive: resource.isActive,
        priority: resource.priority,
        resourceId: resource.id,
        availabilityScopeId: resource.id,
        sourceType: "RESOURCE" as const,
        courtId: null,
        padelClubId: null,
        clubName: null,
      }));

    if (!includeCourts) {
      return respondOk(access.ctx, { items: resourceItems });
    }

    const linkedCourtItems = resources
      .filter((resource) => resource.courtId != null)
      .map((resource) => {
        const court = resource.court;
        if (!court || court.deletedAt || court.club.deletedAt) return null;
        return {
          id: court.id,
          label: court.name,
          capacity: resource.capacity,
          isActive: Boolean(resource.isActive && court.isActive),
          priority: court.displayOrder ?? resource.priority ?? 0,
          sourceType: "COURT" as const,
          resourceId: resource.id,
          availabilityScopeId: resource.id,
          courtId: court.id,
          padelClubId: court.padelClubId,
          clubName: court.club.name ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);

    // Transitional fallback while older environments may still have courts not yet linked.
    const linkedCourtIds = new Set(linkedCourtItems.map((item) => item.courtId));
    const missingCourts = await prisma.padelClubCourt.findMany({
      where: {
        club: {
          organizationId: access.organization.id,
          deletedAt: null,
        },
        deletedAt: null,
        isActive: true,
        id: { notIn: Array.from(linkedCourtIds) },
        reservationResource: { is: null },
        ...(isStaff
          ? allowedCourtIds && allowedCourtIds.length > 0
            ? { id: { in: allowedCourtIds } }
            : { id: { in: [] } }
          : {}),
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        displayOrder: true,
        padelClubId: true,
        club: { select: { name: true } },
      },
    });

    const missingCourtItems = missingCourts.map((court) => ({
      id: court.id,
      label: court.name,
      capacity: 4,
      isActive: court.isActive,
      priority: court.displayOrder ?? 0,
      sourceType: "COURT" as const,
      resourceId: null,
      availabilityScopeId: null,
      courtId: court.id,
      padelClubId: court.padelClubId,
      clubName: court.club.name ?? null,
    }));

    return respondOk(access.ctx, { items: [...resourceItems, ...linkedCourtItems, ...missingCourtItems] });
  } catch (err) {
    console.error("GET /api/org/[orgId]/academy/resources error:", err);
    return respondError(
      access.ctx,
      {
        errorCode: "INTERNAL_ERROR",
        message: "Erro ao carregar recursos de Academia.",
        retryable: true,
      },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
