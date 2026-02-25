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
import { getOrganizationReservasOperationalState } from "@/lib/reservas/operationalState";
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

function buildPolicyPayload(
  policy: { gridMinutes: number; allowedDurations: number[] },
  params?: { acceptNewBookings?: boolean },
) {
  return {
    gridMinutes: policy.gridMinutes,
    durationCatalog: [...BOOKING_DURATION_CATALOG],
    activeDurations: policy.allowedDurations,
    allowedDurations: policy.allowedDurations,
    allowCustomDuration: false,
    presetDurations: policy.allowedDurations,
    acceptNewBookings: params?.acceptNewBookings ?? true,
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
        bookingAcceptNewReservations: true,
      },
    });

    const policy = resolveBookingGridPolicy({
      gridMinutes: settings?.bookingGridMinutes,
      allowedDurations: settings?.bookingAllowedDurations,
      allowCustomDuration: false,
    });

    return respondOk(ctx, {
      data: buildPolicyPayload(policy, {
        acceptNewBookings: settings?.bookingAcceptNewReservations ?? true,
      }),
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
          acceptNewBookings?: unknown;
        }
      | null;
    if (!payload) {
      return fail(ctx, 400, "INVALID_BOOKING_CONFIG", "INVALID_BOOKING_CONFIG");
    }

    const hasConfigInput =
      payload.gridMinutes !== undefined ||
      payload.activeDurations !== undefined ||
      payload.allowedDurations !== undefined ||
      payload.allowCustomDuration !== undefined;
    const hasOperationalInput = payload.acceptNewBookings !== undefined;
    if (!hasConfigInput && !hasOperationalInput) {
      return fail(ctx, 400, "INVALID_BOOKING_CONFIG", "INVALID_BOOKING_CONFIG");
    }

    if (hasOperationalInput && typeof payload.acceptNewBookings !== "boolean") {
      return fail(ctx, 400, "INVALID_BOOKING_CONFIG", "INVALID_BOOKING_CONFIG", false, {
        reason: "acceptNewBookings inválido.",
      });
    }

    let validation:
      | ReturnType<typeof validateBookingConfigInput>
      | { ok: true; data: { gridMinutes: number; activeDurations: number[]; allowCustomDuration: false } }
      | null = null;
    if (hasConfigInput) {
      validation = validateBookingConfigInput({
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
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existingSettings = await tx.organizationSettings.findUnique({
        where: { organizationId: context.organization.id },
        select: {
          bookingGridMinutes: true,
          bookingAllowedDurations: true,
          bookingAllowCustomDuration: true,
          bookingAcceptNewReservations: true,
        },
      });
      const existingPolicy = resolveBookingGridPolicy({
        gridMinutes: existingSettings?.bookingGridMinutes,
        allowedDurations: existingSettings?.bookingAllowedDurations,
        allowCustomDuration: false,
      });
      const nextGridMinutes = validation?.ok ? validation.data.gridMinutes : existingPolicy.gridMinutes;
      const nextActiveDurations = validation?.ok
        ? validation.data.activeDurations
        : existingPolicy.allowedDurations;
      const previousAcceptNewBookings = existingSettings?.bookingAcceptNewReservations ?? true;
      const nextAcceptNewBookings =
        typeof payload.acceptNewBookings === "boolean"
          ? payload.acceptNewBookings
          : previousAcceptNewBookings;

      const settings = await tx.organizationSettings.upsert({
        where: { organizationId: context.organization.id },
        update: {
          bookingGridMinutes: nextGridMinutes,
          bookingAllowedDurations: nextActiveDurations,
          bookingAllowCustomDuration: false,
          bookingAcceptNewReservations: nextAcceptNewBookings,
        },
        create: {
          organizationId: context.organization.id,
          bookingGridMinutes: nextGridMinutes,
          bookingAllowedDurations: nextActiveDurations,
          bookingAllowCustomDuration: false,
          bookingAcceptNewReservations: nextAcceptNewBookings,
        },
        select: {
          bookingGridMinutes: true,
          bookingAllowedDurations: true,
          bookingAllowCustomDuration: true,
          bookingAcceptNewReservations: true,
        },
      });

      if (hasConfigInput) {
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
      }

      if (previousAcceptNewBookings !== nextAcceptNewBookings) {
        await recordOrganizationAudit(tx, {
          organizationId: context.organization.id,
          actorUserId: context.profile.id,
          action: "booking.operational.updated",
          entityType: "BOOKING_OPERATIONAL_STATE",
          entityId: String(context.organization.id),
          metadata: {
            acceptNewBookings: nextAcceptNewBookings,
          },
        });
      }

      return settings;
    });

    const policy = resolveBookingGridPolicy({
      gridMinutes: updated.bookingGridMinutes,
      allowedDurations: updated.bookingAllowedDurations,
      allowCustomDuration: false,
    });
    const operationalState = await getOrganizationReservasOperationalState({
      organizationId: context.organization.id,
      tx: prisma,
    });

    return respondOk(ctx, {
      data: buildPolicyPayload(policy, {
        acceptNewBookings: operationalState.acceptNewBookings,
      }),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(ctx, 401, "UNAUTHENTICATED");
    console.error("PATCH /api/org/[orgId]/reservas/config error:", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
