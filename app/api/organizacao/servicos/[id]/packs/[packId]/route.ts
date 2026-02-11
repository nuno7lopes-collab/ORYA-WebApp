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

function parseId(value: string) {
  const parsed = Number(value);
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
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
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
  const serviceId = parseId(resolved.id);
  const packId = parseId(resolved.packId);
  if (!serviceId || !packId) {
    return fail(400, "Dados inválidos.");
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
      return fail(403, writeAccess.errorCode);
    }

    const pack = await prisma.servicePack.findFirst({
      where: { id: packId, serviceId, service: { organizationId: organization.id } },
      select: { id: true, packPriceCents: true, isActive: true },
    });
    if (!pack) {
      return fail(404, "Pack não encontrado.");
    }

    const payload = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (Number.isFinite(Number(payload?.quantity))) {
      const quantity = Math.floor(Number(payload.quantity));
      if (quantity <= 0) {
        return fail(400, "Quantidade inválida.");
      }
      updates.quantity = quantity;
    }
    if (Number.isFinite(Number(payload?.packPriceCents ?? payload?.packPrice))) {
      const packPriceCents = Math.round(Number(payload.packPriceCents ?? payload.packPrice));
      if (packPriceCents <= 0) {
        return fail(400, "Preço inválido.");
      }
      updates.packPriceCents = packPriceCents;
    }
    if (typeof payload?.label === "string") {
      const label = payload.label.trim();
      updates.label = label ? label.slice(0, 80) : null;
    }
    if (typeof payload?.recommended === "boolean") updates.recommended = payload.recommended;
    if (typeof payload?.isActive === "boolean") updates.isActive = payload.isActive;

    if (Object.keys(updates).length === 0) {
      return fail(400, "Sem alterações.");
    }

    const updated = await prisma.servicePack.update({
      where: { id: packId },
      data: updates,
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_PACK_UPDATED",
      metadata: { serviceId, packId, updates },
      ip,
      userAgent,
    });

    return respondOk(ctx, {pack: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("PATCH /api/organizacao/servicos/[id]/packs/[packId] error:", err);
    return fail(500, "Erro ao atualizar pack.");
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
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
  const serviceId = parseId(resolved.id);
  const packId = parseId(resolved.packId);
  if (!serviceId || !packId) {
    return fail(400, "Dados inválidos.");
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

    const pack = await prisma.servicePack.findFirst({
      where: { id: packId, serviceId, service: { organizationId: organization.id } },
      select: { id: true },
    });
    if (!pack) {
      return fail(404, "Pack não encontrado.");
    }

    await prisma.servicePack.update({
      where: { id: packId },
      data: { isActive: false },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_PACK_DISABLED",
      metadata: { serviceId, packId },
      ip,
      userAgent,
    });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("DELETE /api/organizacao/servicos/[id]/packs/[packId] error:", err);
    return fail(500, "Erro ao remover pack.");
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);