import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
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

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
  const resolved = await params;
  const serviceId = parseId(resolved.id);
  const packId = parseId(resolved.packId);
  if (!serviceId || !packId) {
    return jsonWrap({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return jsonWrap({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return jsonWrap({ ok: false, error: reservasAccess.error }, { status: 403 });
    }
    const writeAccess = ensureOrganizationWriteAccess(organization, {
      requireStripeForServices: true,
    });
    if (!writeAccess.ok) {
      return jsonWrap({ ok: false, error: writeAccess.error }, { status: 403 });
    }

    const pack = await prisma.servicePack.findFirst({
      where: { id: packId, serviceId, service: { organizationId: organization.id } },
      select: { id: true, packPriceCents: true, isActive: true },
    });
    if (!pack) {
      return jsonWrap({ ok: false, error: "Pack não encontrado." }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (Number.isFinite(Number(payload?.quantity))) {
      const quantity = Math.floor(Number(payload.quantity));
      if (quantity <= 0) {
        return jsonWrap({ ok: false, error: "Quantidade inválida." }, { status: 400 });
      }
      updates.quantity = quantity;
    }
    if (Number.isFinite(Number(payload?.packPriceCents ?? payload?.packPrice))) {
      const packPriceCents = Math.round(Number(payload.packPriceCents ?? payload.packPrice));
      if (packPriceCents <= 0) {
        return jsonWrap({ ok: false, error: "Preço inválido." }, { status: 400 });
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
      return jsonWrap({ ok: false, error: "Sem alterações." }, { status: 400 });
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

    return jsonWrap({ ok: true, pack: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/servicos/[id]/packs/[packId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar pack." }, { status: 500 });
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
  const resolved = await params;
  const serviceId = parseId(resolved.id);
  const packId = parseId(resolved.packId);
  if (!serviceId || !packId) {
    return jsonWrap({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return jsonWrap({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return jsonWrap({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const pack = await prisma.servicePack.findFirst({
      where: { id: packId, serviceId, service: { organizationId: organization.id } },
      select: { id: true },
    });
    if (!pack) {
      return jsonWrap({ ok: false, error: "Pack não encontrado." }, { status: 404 });
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

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/servicos/[id]/packs/[packId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover pack." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);