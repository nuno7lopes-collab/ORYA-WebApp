import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
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
  if (!serviceId) {
    return fail(400, "Serviço inválido.");
  }

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

    const writeAccess = ensureOrganizationWriteAccess(organization, {
      requireStripeForServices: true,
    });
    if (!writeAccess.ok) {
      return fail(403, writeAccess.error);
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true },
    });
    if (!service) {
      return fail(404, "Serviço não encontrado.");
    }

    const items = await prisma.serviceAddon.findMany({
      where: { serviceId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        label: true,
        description: true,
        deltaMinutes: true,
        deltaPriceCents: true,
        maxQty: true,
        category: true,
        sortOrder: true,
        isActive: true,
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/organizacao/servicos/[id]/addons error:", err);
    return fail(500, "Erro ao carregar add-ons.");
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  if (!serviceId) {
    return fail(400, "Serviço inválido.");
  }

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

    const writeAccess = ensureOrganizationWriteAccess(organization, {
      requireStripeForServices: true,
    });
    if (!writeAccess.ok) {
      return fail(403, writeAccess.error);
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true },
    });
    if (!service) {
      return fail(404, "Serviço não encontrado.");
    }

    const payload = await req.json().catch(() => ({}));
    const label = typeof payload?.label === "string" ? payload.label.trim() : "";
    const description = typeof payload?.description === "string" ? payload.description.trim() : "";
    const deltaMinutesRaw = Number(payload?.deltaMinutes ?? 0);
    const deltaPriceCentsRaw = Number(payload?.deltaPriceCents ?? payload?.deltaPrice ?? 0);
    const maxQtyRaw = payload?.maxQty ?? null;
    const category = typeof payload?.category === "string" ? payload.category.trim() : "";
    const sortOrderRaw = Number(payload?.sortOrder ?? 0);
    const isActive = payload?.isActive == null ? true : Boolean(payload.isActive);

    if (!label) {
      return fail(400, "Nome do add-on obrigatório.");
    }
    if (!Number.isFinite(deltaMinutesRaw) || deltaMinutesRaw < 0) {
      return fail(400, "Duração inválida.");
    }
    if (!Number.isFinite(deltaPriceCentsRaw) || deltaPriceCentsRaw < 0) {
      return fail(400, "Preço inválido.");
    }
    const maxQty =
      maxQtyRaw == null || maxQtyRaw === ""
        ? null
        : Number.isFinite(Number(maxQtyRaw))
          ? Math.max(1, Math.floor(Number(maxQtyRaw)))
          : null;

    const addon = await prisma.serviceAddon.create({
      data: {
        serviceId,
        label: label.slice(0, 120),
        description: description ? description.slice(0, 240) : null,
        deltaMinutes: Math.round(deltaMinutesRaw),
        deltaPriceCents: Math.round(deltaPriceCentsRaw),
        maxQty,
        category: category ? category.slice(0, 60) : null,
        sortOrder: Number.isFinite(sortOrderRaw) ? Math.round(sortOrderRaw) : 0,
        isActive,
      },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_ADDON_CREATED",
      metadata: {
        serviceId,
        addonId: addon.id,
        deltaMinutes: addon.deltaMinutes,
        deltaPriceCents: addon.deltaPriceCents,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, { addon }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/organizacao/servicos/[id]/addons error:", err);
    return fail(500, "Erro ao criar add-on.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
