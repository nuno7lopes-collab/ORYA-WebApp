import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureDefaultPolicies } from "@/lib/organizationPolicies";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { ensureOrganizationWriteAccess } from "@/lib/organizationWriteAccess";
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

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

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

    const items = await prisma.service.findMany({
      where: {
        organizationId: organization.id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        policy: {
          select: {
            id: true,
            name: true,
            policyType: true,
            cancellationWindowMinutes: true,
          },
        },
        instructor: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
        professionalLinks: { select: { professionalId: true } },
        resourceLinks: { select: { resourceId: true } },
        _count: {
          select: { bookings: true, availabilities: true },
        },
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/organizacao/servicos error:", err);
    return fail(500, "Erro ao carregar serviços.");
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

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

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

    const writeAccess = ensureOrganizationWriteAccess(organization, {
      requireStripeForServices: true,
    });
    if (!writeAccess.ok) {
      return fail(403, writeAccess.error);
    }

    await ensureDefaultPolicies(prisma, organization.id);

    const payload = await req.json().catch(() => ({}));
    const title = String(payload?.title ?? payload?.name ?? "").trim();
    const description = String(payload?.description ?? "").trim();
    const durationMinutes = Number(payload?.durationMinutes);
    const unitPriceCents = Number(payload?.unitPriceCents ?? payload?.price);
    const currency = String(payload?.currency ?? "EUR").trim().toUpperCase();
    const policyIdRaw = Number(payload?.policyId);
    const categoryTag = typeof payload?.categoryTag === "string" ? payload.categoryTag.trim() : "";
    const locationModeRaw = typeof payload?.locationMode === "string" ? payload.locationMode.trim().toUpperCase() : "FIXED";
    const defaultLocationText = typeof payload?.defaultLocationText === "string" ? payload.defaultLocationText.trim() : "";
    const coverImageUrl = typeof payload?.coverImageUrl === "string" ? payload.coverImageUrl.trim() : "";

    const allowedDurations = new Set([30, 60, 90, 120]);
    if (!title || !Number.isFinite(durationMinutes) || !allowedDurations.has(durationMinutes)) {
      return fail(400, "Duração inválida (30/60/90/120 min).");
    }
    if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
      return fail(400, "Dados inválidos.");
    }

    let policyId: number | null = null;
    if (Number.isFinite(policyIdRaw)) {
      const policy = await prisma.organizationPolicy.findFirst({
        where: { id: policyIdRaw, organizationId: organization.id },
        select: { id: true },
      });
      if (!policy) {
        return fail(400, "Política inválida.");
      }
      policyId = policy.id;
    } else {
      const defaultPolicy = await prisma.organizationPolicy.findFirst({
        where: { organizationId: organization.id, policyType: "MODERATE" },
        select: { id: true },
      });
      policyId = defaultPolicy?.id ?? null;
    }

    if (!["FIXED", "CHOOSE_AT_BOOKING"].includes(locationModeRaw)) {
      return fail(400, "Localização inválida.");
    }

    const service = await prisma.service.create({
      data: {
        organizationId: organization.id,
        policyId,
        kind: "GENERAL",
        instructorId: null,
        title,
        description: description || null,
        durationMinutes,
        unitPriceCents: Math.round(unitPriceCents),
        currency: currency || "EUR",
        categoryTag: categoryTag || null,
        coverImageUrl: coverImageUrl || null,
        locationMode: locationModeRaw as "FIXED" | "CHOOSE_AT_BOOKING",
        defaultLocationText: defaultLocationText || null,
      },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_CREATED",
      metadata: {
        serviceId: service.id,
        title,
        durationMinutes,
        unitPriceCents: Math.round(unitPriceCents),
        currency: currency || "EUR",
        categoryTag: categoryTag || null,
        coverImageUrl: coverImageUrl || null,
        locationMode: locationModeRaw,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, { service }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/organizacao/servicos error:", err);
    return fail(500, "Erro ao criar serviço.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
