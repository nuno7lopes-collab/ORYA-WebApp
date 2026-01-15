import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { OrganizationMemberRole } from "@prisma/client";

const ALLOWED_ROLES: OrganizationMemberRole[] = [
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
  const resolved = await params;
  const serviceId = parseId(resolved.id);
  const packId = parseId(resolved.packId);
  if (!serviceId || !packId) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const pack = await prisma.servicePack.findFirst({
      where: { id: packId, serviceId, service: { organizationId: organization.id } },
      select: { id: true, packPriceCents: true, isActive: true },
    });
    if (!pack) {
      return NextResponse.json({ ok: false, error: "Pack não encontrado." }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (Number.isFinite(Number(payload?.quantity))) {
      const quantity = Math.floor(Number(payload.quantity));
      if (quantity <= 0) {
        return NextResponse.json({ ok: false, error: "Quantidade inválida." }, { status: 400 });
      }
      updates.quantity = quantity;
    }
    if (Number.isFinite(Number(payload?.packPriceCents ?? payload?.packPrice))) {
      const packPriceCents = Math.round(Number(payload.packPriceCents ?? payload.packPrice));
      if (packPriceCents <= 0) {
        return NextResponse.json({ ok: false, error: "Preço inválido." }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "Sem alterações." }, { status: 400 });
    }

    const nextPrice =
      typeof updates.packPriceCents === "number" ? updates.packPriceCents : pack.packPriceCents;
    const nextIsActive =
      typeof updates.isActive === "boolean" ? updates.isActive : pack.isActive;
    const checksPaidGate =
      nextIsActive &&
      nextPrice > 0 &&
      (updates.isActive === true || typeof updates.packPriceCents === "number");

    if (checksPaidGate) {
      const gate = getPaidSalesGate({
        officialEmail: organization.officialEmail ?? null,
        officialEmailVerifiedAt: organization.officialEmailVerifiedAt ?? null,
        stripeAccountId: organization.stripeAccountId ?? null,
        stripeChargesEnabled: organization.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: organization.stripePayoutsEnabled ?? false,
        requireStripe: organization.orgType !== "PLATFORM",
      });
      if (!gate.ok) {
        return NextResponse.json(
          {
            ok: false,
            code: "PAYMENTS_NOT_READY",
            error: formatPaidSalesGateMessage(gate, "Para vender packs pagos,"),
            missingEmail: gate.missingEmail,
            missingStripe: gate.missingStripe,
          },
          { status: 403 },
        );
      }
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

    return NextResponse.json({ ok: true, pack: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/servicos/[id]/packs/[packId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar pack." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; packId: string }> },
) {
  const resolved = await params;
  const serviceId = parseId(resolved.id);
  const packId = parseId(resolved.packId);
  if (!serviceId || !packId) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const pack = await prisma.servicePack.findFirst({
      where: { id: packId, serviceId, service: { organizationId: organization.id } },
      select: { id: true },
    });
    if (!pack) {
      return NextResponse.json({ ok: false, error: "Pack não encontrado." }, { status: 404 });
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/servicos/[id]/packs/[packId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover pack." }, { status: 500 });
  }
}
