import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { ensureOrganizationWriteAccess } from "@/lib/organizationWriteAccess";
import { getOrganizationBookingPolicy } from "@/lib/reservas/gridPolicy";
import {
  COURT_DURATION_CATALOG,
  listCourtDurationPrices,
  normalizeCourtDurationPricePayload,
  replaceCourtDurationPrices,
} from "@/lib/reservas/serviceDurationPrices";
import { OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function parseServiceId(idParam: string) {
  const parsed = Number(idParam);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

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

async function resolveContext(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
  if (!profile) return null;

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
  });

  if (!organization || !membership) return null;
  return { user, profile, organization };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };

  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  if (!serviceId) return fail(400, "Serviço inválido.");

  try {
    const context = await resolveContext(req);
    if (!context) return fail(403, "FORBIDDEN");

    const reservasAccess = await ensureReservasModuleAccess(context.organization);
    if (!reservasAccess.ok) return fail(403, reservasAccess.error ?? "RESERVAS_UNAVAILABLE", "RESERVAS_UNAVAILABLE");

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: context.organization.id,
      },
      select: {
        id: true,
        kind: true,
        currency: true,
      },
    });
    if (!service) return fail(404, "Serviço não encontrado.");
    if (service.kind !== "COURT") return fail(409, "SERVICE_KIND_NOT_COURT");

    const items = await listCourtDurationPrices({
      tx: prisma,
      serviceId: service.id,
      activeOnly: false,
    });

    return respondOk(ctx, {
      data: {
        serviceId: service.id,
        currency: service.currency,
        durationCatalog: [...COURT_DURATION_CATALOG],
        items,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(401, "UNAUTHENTICATED");
    console.error("GET /api/org/[orgId]/servicos/[id]/duration-prices error:", err);
    return fail(500, "INTERNAL_ERROR");
  }
}

async function _PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) }, { status });
  };

  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  if (!serviceId) return fail(400, "Serviço inválido.");

  try {
    const context = await resolveContext(req);
    if (!context) return fail(403, "FORBIDDEN");

    const reservasAccess = await ensureReservasModuleAccess(context.organization);
    if (!reservasAccess.ok) return fail(403, reservasAccess.error ?? "RESERVAS_UNAVAILABLE", "RESERVAS_UNAVAILABLE");

    const writeAccess = ensureOrganizationWriteAccess(context.organization, {
      requireStripeForServices: true,
    });
    if (!writeAccess.ok) return fail(403, writeAccess.errorCode ?? "FORBIDDEN");

    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: context.organization.id,
      },
      select: {
        id: true,
        kind: true,
        currency: true,
      },
    });
    if (!service) return fail(404, "Serviço não encontrado.");
    if (service.kind !== "COURT") return fail(409, "SERVICE_KIND_NOT_COURT");

    const payload = (await req.json().catch(() => null)) as
      | {
          items?: unknown;
          durationPrices?: unknown;
        }
      | null;
    if (!payload) return fail(400, "INVALID_DURATION_PRICES");

    const parsedRows = normalizeCourtDurationPricePayload(payload.items ?? payload.durationPrices);
    if (!parsedRows || parsedRows.length === 0) {
      return fail(400, "INVALID_DURATION_PRICES");
    }

    const bookingPolicy = await getOrganizationBookingPolicy({
      organizationId: context.organization.id,
      tx: prisma,
    });
    const activeSet = new Set(
      parsedRows.filter((row) => row.isActive !== false).map((row) => row.durationMinutes),
    );
    const missingActiveDuration = bookingPolicy.allowedDurations.find((duration) => !activeSet.has(duration));
    if (missingActiveDuration) {
      return fail(400, "MISSING_ACTIVE_DURATION_PRICE", "MISSING_ACTIVE_DURATION_PRICE", false, {
        missingDuration: missingActiveDuration,
        activeDurations: bookingPolicy.allowedDurations,
      });
    }

    await prisma.$transaction(async (tx) => {
      await replaceCourtDurationPrices({
        tx,
        serviceId: service.id,
        rows: parsedRows,
      });

      const { ip, userAgent } = getRequestMeta(req);
      await recordOrganizationAudit(tx, {
        organizationId: context.organization.id,
        actorUserId: context.profile.id,
        action: "SERVICE_DURATION_PRICES_REPLACED",
        entityType: "SERVICE_DURATION_PRICES",
        entityId: String(service.id),
        metadata: {
          serviceId: service.id,
          rows: parsedRows,
          activeDurations: bookingPolicy.allowedDurations,
        },
        ip,
        userAgent,
      });
    });

    return respondOk(ctx, {
      data: {
        serviceId: service.id,
        currency: service.currency,
        durationCatalog: [...COURT_DURATION_CATALOG],
        items: parsedRows,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) return fail(401, "UNAUTHENTICATED");
    console.error("PUT /api/org/[orgId]/servicos/[id]/duration-prices error:", err);
    return fail(500, "INTERNAL_ERROR");
  }
}

export const GET = withApiEnvelope(_GET);
export const PUT = withApiEnvelope(_PUT);
