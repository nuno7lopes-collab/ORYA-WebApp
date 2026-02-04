import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole, AvailabilityScopeType } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { buildScheduleDelayMap } from "@/lib/reservas/scheduleDelay";
import { queueImportantUpdateEmail } from "@/domain/notifications/email";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const MAX_DELAY_MINUTES = 480;
const DEFAULT_NOTIFY_WINDOW_HOURS = 24;

function formatDateTime(value: Date, timeZone?: string | null) {
  try {
    return new Intl.DateTimeFormat("pt-PT", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone || undefined,
    }).format(value);
  } catch {
    return value.toISOString();
  }
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

function parseScopeType(value: string | null): AvailabilityScopeType | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  if (normalized === "ORGANIZATION") return AvailabilityScopeType.ORGANIZATION;
  if (normalized === "PROFESSIONAL") return AvailabilityScopeType.PROFESSIONAL;
  if (normalized === "RESOURCE") return AvailabilityScopeType.RESOURCE;
  return null;
}

function parseScopeId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

async function _GET(req: NextRequest) {
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

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(403, reservasAccess.error);
    }

    const scopeType = parseScopeType(req.nextUrl.searchParams.get("scopeType"));
    const scopeId = parseScopeId(req.nextUrl.searchParams.get("scopeId"));

    if (scopeType && scopeId != null) {
      const delay = await prisma.scheduleDelay.findFirst({
        where: { organizationId: organization.id, scopeType, scopeId },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          scopeType: true,
          scopeId: true,
          delayMinutes: true,
          reason: true,
          effectiveFrom: true,
          createdAt: true,
        },
      });

      return respondOk(ctx, { delay: delay ?? null });
    }

    const delays = await prisma.scheduleDelay.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ scopeType: "asc" }, { scopeId: "asc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
        delayMinutes: true,
        reason: true,
        effectiveFrom: true,
        createdAt: true,
      },
    });

    const map = buildScheduleDelayMap(delays);
    return respondOk(ctx, { items: Array.from(map.values()) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/organizacao/reservas/delays error:", err);
    return fail(500, "Erro ao carregar atrasos.");
  }
}

async function _POST(req: NextRequest) {
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

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization) {
      return fail(403, "Sem permissões.");
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return fail(403, reservasAccess.error);
    }

    const payload = await req.json().catch(() => ({}));
    const scopeType = parseScopeType(payload?.scopeType ?? null);
    const scopeIdRaw = payload?.scopeId ?? null;
    const scopeId = scopeIdRaw == null ? null : Number(scopeIdRaw);
    if (!scopeType) {
      return fail(400, "Scope inválido.");
    }
    const scopeIdValue = scopeId ?? Number.NaN;
    if (scopeType !== AvailabilityScopeType.ORGANIZATION && (!Number.isFinite(scopeIdValue) || scopeIdValue <= 0)) {
      return fail(400, "Scope ID inválido.");
    }
    const normalizedScopeId = scopeType === AvailabilityScopeType.ORGANIZATION ? 0 : Math.round(scopeIdValue);

    const delayMinutesRaw = Number(payload?.delayMinutes ?? payload?.minutes ?? 0);
    if (!Number.isFinite(delayMinutesRaw) || delayMinutesRaw < 0) {
      return fail(400, "Minutos inválidos.");
    }
    const delayMinutes = Math.min(Math.round(delayMinutesRaw), MAX_DELAY_MINUTES);

    const reasonRaw = typeof payload?.reason === "string" ? payload.reason.trim() : "";
    const reason = reasonRaw ? reasonRaw.slice(0, 200) : null;
    const effectiveFromRaw = typeof payload?.effectiveFrom === "string" ? payload.effectiveFrom.trim() : "";
    const effectiveFrom = effectiveFromRaw ? new Date(effectiveFromRaw) : new Date();
    if (Number.isNaN(effectiveFrom.getTime())) {
      return fail(400, "Data inválida.");
    }

    const delay = await prisma.scheduleDelay.create({
      data: {
        organizationId: organization.id,
        scopeType,
        scopeId: normalizedScopeId,
        delayMinutes,
        reason,
        effectiveFrom,
        createdByUserId: profile.id,
      },
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
        delayMinutes: true,
        reason: true,
        effectiveFrom: true,
        createdAt: true,
      },
    });

    const notify = Boolean(payload?.notify);
    const notifyWindowHoursRaw = Number(payload?.notifyWindowHours ?? payload?.notifyWindow ?? DEFAULT_NOTIFY_WINDOW_HOURS);
    const notifyWindowHours =
      Number.isFinite(notifyWindowHoursRaw) && notifyWindowHoursRaw > 0
        ? Math.min(168, Math.round(notifyWindowHoursRaw))
        : DEFAULT_NOTIFY_WINDOW_HOURS;

    if (notify && delayMinutes > 0) {
      const windowEnd = new Date(effectiveFrom.getTime() + notifyWindowHours * 60 * 60 * 1000);
      const bookingWhere: Record<string, unknown> = {
        organizationId: organization.id,
        status: "CONFIRMED",
        startsAt: { gte: effectiveFrom, lt: windowEnd },
      };
      if (scopeType === AvailabilityScopeType.PROFESSIONAL) {
        bookingWhere.professionalId = normalizedScopeId;
      }
      if (scopeType === AvailabilityScopeType.RESOURCE) {
        bookingWhere.resourceId = normalizedScopeId;
      }

      const bookings = await prisma.booking.findMany({
        where: bookingWhere,
        select: {
          id: true,
          startsAt: true,
          userId: true,
          snapshotTimezone: true,
          service: { select: { title: true } },
        },
      });

      const orgName =
        (organization as { publicName?: string | null; businessName?: string | null }).publicName ||
        (organization as { businessName?: string | null }).businessName ||
        "Organização";
      const baseUrl = getAppBaseUrl().replace(/\/+$/, "");
      const ticketUrl = `${baseUrl}/me/reservas`;

      await Promise.allSettled(
        bookings.map((booking) => {
          const estimated = new Date(booking.startsAt.getTime() + delayMinutes * 60 * 1000);
          const serviceTitle = booking.service?.title || "Serviço";
          const message = `A tua reserva de ${serviceTitle} sofreu um atraso estimado de ${delayMinutes} min. Nova hora estimada: ${formatDateTime(
            estimated,
            booking.snapshotTimezone ?? null,
          )}.`;
          return queueImportantUpdateEmail({
            dedupeKey: `booking_delay:${booking.id}:${delay.id}`,
            userId: booking.userId,
            eventTitle: orgName,
            message,
            ticketUrl,
            correlations: { organizationId: organization.id },
          });
        }),
      );
    }

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SCHEDULE_DELAY_SET",
      metadata: {
        scopeType,
        scopeId: normalizedScopeId,
        delayMinutes,
        reason,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, { delay }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/organizacao/reservas/delays error:", err);
    return fail(500, "Erro ao atualizar atraso.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
