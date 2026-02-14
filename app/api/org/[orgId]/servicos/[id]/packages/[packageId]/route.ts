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
  { params }: { params: Promise<{ id: string; packageId: string }> },
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
  const packageId = parseId(resolved.packageId);
  if (!serviceId || !packageId) {
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

    const pkg = await prisma.servicePackage.findFirst({
      where: { id: packageId, serviceId, service: { organizationId: organization.id } },
      select: { id: true },
    });
    if (!pkg) {
      return fail(404, "Pacote não encontrado.");
    }

    const payload = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof payload?.label === "string") {
      const label = payload.label.trim();
      if (!label) {
        return fail(400, "Nome do pacote obrigatório.");
      }
      updates.label = label.slice(0, 120);
    }
    if (typeof payload?.description === "string") {
      const description = payload.description.trim();
      updates.description = description ? description.slice(0, 240) : null;
    }
    if (Number.isFinite(Number(payload?.durationMinutes))) {
      const durationMinutes = Math.round(Number(payload.durationMinutes));
      if (durationMinutes <= 0) {
        return fail(400, "Duração inválida.");
      }
      updates.durationMinutes = durationMinutes;
    }
    if (Number.isFinite(Number(payload?.priceCents ?? payload?.price))) {
      const priceCents = Math.round(Number(payload.priceCents ?? payload.price));
      if (priceCents < 0) {
        return fail(400, "Preço inválido.");
      }
      updates.priceCents = priceCents;
    }
    if (typeof payload?.recommended === "boolean") updates.recommended = payload.recommended;
    if (Number.isFinite(Number(payload?.sortOrder))) {
      updates.sortOrder = Math.round(Number(payload.sortOrder));
    }
    if (typeof payload?.isActive === "boolean") updates.isActive = payload.isActive;

    if (Object.keys(updates).length === 0) {
      return fail(400, "Sem alterações.");
    }

    const updated = await prisma.servicePackage.update({
      where: { id: packageId },
      data: updates,
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_PACKAGE_UPDATED",
      metadata: { serviceId, packageId, updates },
      ip,
      userAgent,
    });

    return respondOk(ctx, { package: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("PATCH /api/org/[orgId]/servicos/[id]/packages/[packageId] error:", err);
    return fail(500, "Erro ao atualizar pacote.");
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packageId: string }> },
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
  const packageId = parseId(resolved.packageId);
  if (!serviceId || !packageId) {
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

    const pkg = await prisma.servicePackage.findFirst({
      where: { id: packageId, serviceId, service: { organizationId: organization.id } },
      select: { id: true },
    });
    if (!pkg) {
      return fail(404, "Pacote não encontrado.");
    }

    await prisma.servicePackage.update({
      where: { id: packageId },
      data: { isActive: false },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_PACKAGE_DISABLED",
      metadata: { serviceId, packageId },
      ip,
      userAgent,
    });

    return respondOk(ctx, { ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("DELETE /api/org/[orgId]/servicos/[id]/packages/[packageId] error:", err);
    return fail(500, "Erro ao desativar pacote.");
  }
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
