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
import {
  BOOKING_DURATION_CATALOG,
  resolveBookingGridPolicy,
  validateBookingConfigInput,
} from "@/lib/reservas/gridPolicy";
import { OrganizationMemberRole } from "@prisma/client";

const ADMIN_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
];

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
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

function buildPolicyPayload(policy: { gridMinutes: number; allowedDurations: number[] }) {
  return {
    gridMinutes: policy.gridMinutes,
    durationCatalog: [...BOOKING_DURATION_CATALOG],
    activeDurations: policy.allowedDurations,
    allowedDurations: policy.allowedDurations,
    allowCustomDuration: false,
    presetDurations: policy.allowedDurations,
  };
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const context = await resolveAdminOrganization(req);
    if (!context) {
      return fail(ctx, 403, "FORBIDDEN");
    }
    if (!context.reservasAccess.ok) {
      return fail(ctx, 403, context.reservasAccess.error ?? "RESERVAS_UNAVAILABLE", "RESERVAS_UNAVAILABLE");
    }

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: context.organization.id },
      select: {
        bookingGridMinutes: true,
        bookingAllowedDurations: true,
        bookingAllowCustomDuration: true,
      },
    });

    const policy = resolveBookingGridPolicy({
      gridMinutes: settings?.bookingGridMinutes,
      allowedDurations: settings?.bookingAllowedDurations,
      allowCustomDuration: false,
    });

    return respondOk(ctx, {
      data: buildPolicyPayload(policy),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(ctx, 401, "UNAUTHENTICATED");
    console.error("GET /api/org/[orgId]/reservas/config error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

async function _PATCH(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const context = await resolveAdminOrganization(req);
    if (!context) {
      return fail(ctx, 403, "FORBIDDEN");
    }
    if (!context.reservasAccess.ok) {
      return fail(ctx, 403, context.reservasAccess.error ?? "RESERVAS_UNAVAILABLE", "RESERVAS_UNAVAILABLE");
    }

    const payload = (await req.json().catch(() => null)) as
      | {
          gridMinutes?: unknown;
          activeDurations?: unknown;
          allowedDurations?: unknown;
          allowCustomDuration?: unknown;
        }
      | null;
    if (!payload) {
      return fail(ctx, 400, "INVALID_BOOKING_CONFIG", "INVALID_BOOKING_CONFIG");
    }

    const validation = validateBookingConfigInput({
      gridMinutes: payload.gridMinutes,
      activeDurations: payload.activeDurations,
      allowedDurations: payload.allowedDurations,
      allowCustomDuration: payload.allowCustomDuration,
    });
    if (!validation.ok) {
      return fail(ctx, 400, validation.errorCode, validation.errorCode, false, {
        reason: validation.message,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const settings = await tx.organizationSettings.upsert({
        where: { organizationId: context.organization.id },
        update: {
          bookingGridMinutes: validation.data.gridMinutes,
          bookingAllowedDurations: validation.data.activeDurations,
          bookingAllowCustomDuration: false,
        },
        create: {
          organizationId: context.organization.id,
          bookingGridMinutes: validation.data.gridMinutes,
          bookingAllowedDurations: validation.data.activeDurations,
          bookingAllowCustomDuration: false,
        },
        select: {
          bookingGridMinutes: true,
          bookingAllowedDurations: true,
          bookingAllowCustomDuration: true,
        },
      });

      await recordOrganizationAudit(tx, {
        organizationId: context.organization.id,
        actorUserId: context.profile.id,
        action: "booking.config.updated",
        entityType: "BOOKING_CONFIG",
        entityId: String(context.organization.id),
        metadata: {
          gridMinutes: settings.bookingGridMinutes,
          durationCatalog: [...BOOKING_DURATION_CATALOG],
          activeDurations: settings.bookingAllowedDurations,
          allowCustomDuration: false,
        },
      });

      return settings;
    });

    const policy = resolveBookingGridPolicy({
      gridMinutes: updated.bookingGridMinutes,
      allowedDurations: updated.bookingAllowedDurations,
      allowCustomDuration: false,
    });

    return respondOk(ctx, {
      data: buildPolicyPayload(policy),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(ctx, 401, "UNAUTHENTICATED");
    console.error("PATCH /api/org/[orgId]/reservas/config error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
