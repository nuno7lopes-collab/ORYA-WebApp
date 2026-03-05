import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { prisma } from "@/lib/prisma";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { OrganizationMemberRole } from "@prisma/client";

const ADMIN_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
];

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
    { status },
  );
}

async function resolveAdminOrganization(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
  if (!profile) return null;

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
    organizationId: organizationId ?? undefined,
    roles: [...ADMIN_ROLES],
  });
  if (!organization || !membership) return null;

  const reservasAccess = await ensureReservasModuleAccess(organization);
  if (!reservasAccess.ok) {
    return { profile, organization, membership, reservasAccess };
  }

  return { profile, organization, membership, reservasAccess };
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const context = await resolveAdminOrganization(req);
    if (!context) return fail(ctx, 403, "FORBIDDEN");
    if (!context.reservasAccess.ok) {
      return fail(ctx, 403, context.reservasAccess.error ?? "RESERVAS_UNAVAILABLE", "RESERVAS_UNAVAILABLE");
    }

    const [courts, configs, courtServices, categories, resources, resourceSchedules] = await Promise.all([
      prisma.padelClubCourt.findMany({
        where: {
          club: {
            organizationId: context.organization.id,
            deletedAt: null,
          },
          deletedAt: null,
        },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          displayOrder: true,
          club: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.courtBookingConfig.findMany({
        where: { organizationId: context.organization.id },
        orderBy: [{ isActive: "desc" }, { courtId: "asc" }],
        select: {
          id: true,
          courtId: true,
          backingServiceId: true,
          categoryId: true,
          displayName: true,
          displayDescription: true,
          coverImageUrl: true,
          isActive: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              slug: true,
              label: true,
              domain: true,
            },
          },
          backingService: {
            select: {
              id: true,
              title: true,
              kind: true,
              isActive: true,
              category: {
                select: {
                  id: true,
                  slug: true,
                  label: true,
                  domain: true,
                },
              },
            },
          },
        },
      }),
      prisma.service.findMany({
        where: {
          organizationId: context.organization.id,
          kind: "COURT",
          isActive: true,
        },
        orderBy: [{ title: "asc" }],
        select: {
          id: true,
          title: true,
          category: {
            select: {
              id: true,
              slug: true,
              label: true,
              domain: true,
            },
          },
        },
      }),
      prisma.reservationCategory.findMany({
        where: {
          organizationId: context.organization.id,
          domain: "COURT",
        },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: {
          id: true,
          slug: true,
          label: true,
          domain: true,
          isActive: true,
        },
      }),
      prisma.reservationResource.findMany({
        where: {
          organizationId: context.organization.id,
          isActive: true,
        },
        select: {
          id: true,
          courtId: true,
        },
      }),
      prisma.availabilitySchedule.findMany({
        where: {
          organizationId: context.organization.id,
          scopeType: "RESOURCE",
        },
        select: {
          scopeId: true,
        },
      }),
    ]);

    const configByCourt = new Map(configs.map((config) => [config.courtId, config]));
    const resourceByCourtId = new Map(
      resources
        .filter((resource) => typeof resource.courtId === "number" && resource.courtId > 0)
        .map((resource) => [resource.courtId as number, resource.id]),
    );
    const resourceScopeIdsWithAvailability = new Set(
      resourceSchedules
        .map((schedule) => parsePositiveInt(schedule.scopeId))
        .filter((scopeId): scopeId is number => Boolean(scopeId)),
    );

    const items = courts.map((court) => {
      const config = configByCourt.get(court.id) ?? null;
      const resourceId = resourceByCourtId.get(court.id) ?? null;
      const hasResourceLinked = resourceId != null;
      const hasResourceSpecificAvailability =
        resourceId != null && resourceScopeIdsWithAvailability.has(resourceId);
      return {
        court: {
          id: court.id,
          name: court.name,
          description: court.description,
          isActive: court.isActive,
          displayOrder: court.displayOrder,
          club: court.club,
        },
        config,
        resourceId,
        availabilityScopeId: resourceId,
        hasResourceLinked,
        hasResourceSpecificAvailability,
        status: config ? (config.isActive ? "READY" : "INACTIVE") : "MISSING_CONFIG",
      };
    });

    return respondOk(ctx, {
      items,
      categories,
      courtServices,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(ctx, 401, "UNAUTHENTICATED");
    console.error("GET /api/org/[orgId]/reservas/campos/config error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

async function _PUT(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const context = await resolveAdminOrganization(req);
    if (!context) return fail(ctx, 403, "FORBIDDEN");
    if (!context.reservasAccess.ok) {
      return fail(ctx, 403, context.reservasAccess.error ?? "RESERVAS_UNAVAILABLE", "RESERVAS_UNAVAILABLE");
    }

    const payload = (await req.json().catch(() => null)) as
      | {
          courtId?: unknown;
          backingServiceId?: unknown;
          categoryId?: unknown;
          displayName?: unknown;
          displayDescription?: unknown;
          coverImageUrl?: unknown;
          isActive?: unknown;
        }
      | null;
    if (!payload) return fail(ctx, 400, "INVALID_PAYLOAD");

    const courtId = parsePositiveInt(payload.courtId);
    if (!courtId) return fail(ctx, 400, "INVALID_COURT");

    const court = await prisma.padelClubCourt.findFirst({
      where: {
        id: courtId,
        deletedAt: null,
        club: {
          organizationId: context.organization.id,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
    if (!court) return fail(ctx, 404, "COURT_NOT_FOUND");

    const existingConfig = await prisma.courtBookingConfig.findFirst({
      where: {
        organizationId: context.organization.id,
        courtId,
      },
      select: {
        id: true,
        backingServiceId: true,
        categoryId: true,
        displayName: true,
        displayDescription: true,
        coverImageUrl: true,
        isActive: true,
      },
    });

    const backingServiceIdInput =
      payload.backingServiceId === undefined
        ? null
        : payload.backingServiceId === null
          ? null
          : parsePositiveInt(payload.backingServiceId);

    let backingServiceId =
      backingServiceIdInput ??
      existingConfig?.backingServiceId ??
      null;

    if (!backingServiceId) {
      const fallbackService = await prisma.service.findFirst({
        where: {
          organizationId: context.organization.id,
          kind: "COURT",
          isActive: true,
        },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      backingServiceId = fallbackService?.id ?? null;
    }

    if (!backingServiceId) {
      return fail(ctx, 404, "SERVICE_NOT_FOUND");
    }

    const backingService = await prisma.service.findFirst({
      where: {
        id: backingServiceId,
        organizationId: context.organization.id,
        kind: "COURT",
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        categoryId: true,
        coverImageUrl: true,
      },
    });
    if (!backingService) {
      return fail(ctx, 404, "SERVICE_NOT_FOUND");
    }

    let categoryId: number | null = null;
    if (payload.categoryId === null) {
      categoryId = null;
    } else if (payload.categoryId !== undefined) {
      categoryId = parsePositiveInt(payload.categoryId);
      if (!categoryId) return fail(ctx, 400, "INVALID_CATEGORY");
    } else {
      categoryId = existingConfig?.categoryId ?? backingService.categoryId ?? null;
    }

    if (categoryId != null) {
      const category = await prisma.reservationCategory.findFirst({
        where: {
          id: categoryId,
          organizationId: context.organization.id,
          domain: "COURT",
        },
        select: { id: true },
      });
      if (!category) return fail(ctx, 404, "CATEGORY_NOT_FOUND");
    }

    const displayName =
      typeof payload.displayName === "string" && payload.displayName.trim()
        ? payload.displayName.trim().slice(0, 120)
        : existingConfig?.displayName ?? court.name;

    const displayDescription =
      payload.displayDescription === null
        ? null
        : typeof payload.displayDescription === "string"
          ? payload.displayDescription.trim().slice(0, 500) || null
          : existingConfig?.displayDescription ?? court.description ?? null;

    const coverImageUrl =
      payload.coverImageUrl === null
        ? null
        : typeof payload.coverImageUrl === "string"
          ? payload.coverImageUrl.trim().slice(0, 500) || null
          : existingConfig?.coverImageUrl ?? backingService.coverImageUrl ?? null;

    const isActive =
      typeof payload.isActive === "boolean"
        ? payload.isActive
        : existingConfig?.isActive ?? true;

    const config = await prisma.courtBookingConfig.upsert({
      where: {
        courtId,
      },
      create: {
        organizationId: context.organization.id,
        courtId,
        backingServiceId: backingService.id,
        categoryId,
        displayName,
        displayDescription,
        coverImageUrl,
        isActive,
      },
      update: {
        organizationId: context.organization.id,
        backingServiceId: backingService.id,
        categoryId,
        displayName,
        displayDescription,
        coverImageUrl,
        isActive,
      },
      select: {
        id: true,
        courtId: true,
        backingServiceId: true,
        categoryId: true,
        displayName: true,
        displayDescription: true,
        coverImageUrl: true,
        isActive: true,
        category: {
          select: {
            id: true,
            slug: true,
            label: true,
            domain: true,
          },
        },
        backingService: {
          select: {
            id: true,
            title: true,
            kind: true,
          },
        },
      },
    });

    await recordOrganizationAudit(prisma, {
      organizationId: context.organization.id,
      actorUserId: context.profile.id,
      action: "COURT_BOOKING_CONFIG_UPDATED",
      metadata: {
        courtId,
        configId: config.id,
        backingServiceId: config.backingServiceId,
        categoryId: config.categoryId,
        isActive: config.isActive,
      },
    });

    return respondOk(ctx, { config });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(ctx, 401, "UNAUTHENTICATED");
    console.error("PUT /api/org/[orgId]/reservas/campos/config error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const GET = withApiEnvelope(_GET);
export const PUT = withApiEnvelope(_PUT);
