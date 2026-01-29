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

    const items = await prisma.servicePack.findMany({
      where: { serviceId },
      orderBy: [{ recommended: "desc" }, { quantity: "asc" }],
      select: { id: true, quantity: true, packPriceCents: true, label: true, recommended: true, isActive: true },
    });

    return respondOk(ctx, {items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/organizacao/servicos/[id]/packs error:", err);
    return fail(500, "Erro ao carregar packs.");
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

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true },
    });
    if (!service) {
      return fail(404, "Serviço não encontrado.");
    }

    const payload = await req.json().catch(() => ({}));
    const quantityRaw = Number(payload?.quantity);
    const packPriceCentsRaw = Number(payload?.packPriceCents ?? payload?.packPrice);
    const label = typeof payload?.label === "string" ? payload.label.trim() : "";
    const recommended = Boolean(payload?.recommended);

    if (!Number.isFinite(quantityRaw) || quantityRaw <= 0) {
      return fail(400, "Quantidade inválida.");
    }
    if (!Number.isFinite(packPriceCentsRaw) || packPriceCentsRaw <= 0) {
      return fail(400, "Preço inválido.");
    }

    const pack = await prisma.servicePack.create({
      data: {
        serviceId,
        quantity: Math.floor(quantityRaw),
        packPriceCents: Math.round(packPriceCentsRaw),
        label: label || null,
        recommended,
        isActive: true,
      },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_PACK_CREATED",
      metadata: {
        serviceId,
        packId: pack.id,
        quantity: pack.quantity,
        packPriceCents: pack.packPriceCents,
        recommended: pack.recommended,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, {pack }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/organizacao/servicos/[id]/packs error:", err);
    return fail(500, "Erro ao criar pack.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);