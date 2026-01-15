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

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function parseServiceId(idParam: string) {
  const parsed = Number(idParam);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIdList(value: unknown, label: string) {
  if (value === undefined) return { ids: null as number[] | null, error: null as string | null };
  if (value === null) return { ids: [] as number[], error: null as string | null };
  if (!Array.isArray(value)) {
    return { ids: null as number[] | null, error: `${label} inválidos.` };
  }
  const parsed: number[] = [];
  for (const item of value) {
    const id = Number(item);
    if (!Number.isFinite(id) || id <= 0) {
      return { ids: null as number[] | null, error: `${label} inválidos.` };
    }
    parsed.push(Math.trunc(id));
  }
  return { ids: Array.from(new Set(parsed)), error: null as string | null };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  if (!serviceId) {
    return NextResponse.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: {
        id: true,
        policyId: true,
        kind: true,
        instructorId: true,
        title: true,
        description: true,
        durationMinutes: true,
        unitPriceCents: true,
        currency: true,
        isActive: true,
        categoryTag: true,
        coverImageUrl: true,
        locationMode: true,
        defaultLocationText: true,
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
      },
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, service });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/servicos/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar serviço." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  if (!serviceId) {
    return NextResponse.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const existing = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true, unitPriceCents: true, isActive: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof payload?.title === "string") updates.title = payload.title.trim();
    if (typeof payload?.name === "string" && !updates.title) updates.title = payload.name.trim();
    if (typeof updates.title === "string" && !updates.title) {
      return NextResponse.json({ ok: false, error: "Título inválido." }, { status: 400 });
    }
    if (typeof payload?.description === "string") updates.description = payload.description.trim() || null;
    if (Number.isFinite(Number(payload?.durationMinutes))) {
      const duration = Number(payload.durationMinutes);
      const allowedDurations = new Set([30, 60, 90, 120]);
      if (!allowedDurations.has(duration)) {
        return NextResponse.json({ ok: false, error: "Duração inválida (30/60/90/120 min)." }, { status: 400 });
      }
      updates.durationMinutes = duration;
    }
    if (Number.isFinite(Number(payload?.unitPriceCents ?? payload?.price))) {
      const price = Math.round(Number(payload.unitPriceCents ?? payload.price));
      if (price < 0) {
        return NextResponse.json({ ok: false, error: "Preço inválido." }, { status: 400 });
      }
      updates.unitPriceCents = price;
    }
    if (typeof payload?.currency === "string") updates.currency = payload.currency.trim().toUpperCase();
    if (typeof payload?.isActive === "boolean") updates.isActive = payload.isActive;
    if (typeof payload?.categoryTag === "string") {
      const tag = payload.categoryTag.trim();
      updates.categoryTag = tag ? tag.slice(0, 40) : null;
    }
    if (payload?.coverImageUrl === null) {
      updates.coverImageUrl = null;
    } else if (typeof payload?.coverImageUrl === "string") {
      const url = payload.coverImageUrl.trim();
      updates.coverImageUrl = url ? url.slice(0, 500) : null;
    }
    if (typeof payload?.locationMode === "string") {
      const locationMode = payload.locationMode.trim().toUpperCase();
      if (!["FIXED", "CHOOSE_AT_BOOKING"].includes(locationMode)) {
        return NextResponse.json({ ok: false, error: "Localização inválida." }, { status: 400 });
      }
      updates.locationMode = locationMode;
    }
    if (typeof payload?.defaultLocationText === "string") {
      const text = payload.defaultLocationText.trim();
      updates.defaultLocationText = text ? text.slice(0, 160) : null;
    }
    if (payload?.policyId === null) {
      updates.policyId = null;
    } else if (Number.isFinite(Number(payload?.policyId))) {
      const policyId = Number(payload.policyId);
      const policy = await prisma.organizationPolicy.findFirst({
        where: { id: policyId, organizationId: organization.id },
        select: { id: true },
      });
      if (!policy) {
        return NextResponse.json({ ok: false, error: "Política inválida." }, { status: 400 });
      }
      updates.policyId = policy.id;
    }

    const { ids: professionalIds, error: professionalIdsError } = normalizeIdList(
      payload?.professionalIds,
      "Profissionais",
    );
    if (professionalIdsError) {
      return NextResponse.json({ ok: false, error: professionalIdsError }, { status: 400 });
    }
    if (professionalIds !== null) {
      if (professionalIds.length) {
        const existing = await prisma.reservationProfessional.findMany({
          where: { id: { in: professionalIds }, organizationId: organization.id },
          select: { id: true },
        });
        if (existing.length !== professionalIds.length) {
          return NextResponse.json({ ok: false, error: "Profissionais inválidos." }, { status: 400 });
        }
      }
    }

    const { ids: resourceIds, error: resourceIdsError } = normalizeIdList(payload?.resourceIds, "Recursos");
    if (resourceIdsError) {
      return NextResponse.json({ ok: false, error: resourceIdsError }, { status: 400 });
    }
    if (resourceIds !== null) {
      if (resourceIds.length) {
        const existing = await prisma.reservationResource.findMany({
          where: { id: { in: resourceIds }, organizationId: organization.id },
          select: { id: true },
        });
        if (existing.length !== resourceIds.length) {
          return NextResponse.json({ ok: false, error: "Recursos inválidos." }, { status: 400 });
        }
      }
    }

    if (Object.keys(updates).length === 0 && professionalIds === null && resourceIds === null) {
      return NextResponse.json({ ok: false, error: "Sem alterações." }, { status: 400 });
    }

    const nextUnitPrice =
      typeof updates.unitPriceCents === "number" ? updates.unitPriceCents : existing.unitPriceCents;
    const nextIsActive =
      typeof updates.isActive === "boolean" ? updates.isActive : existing.isActive;
    const checksPaidGate =
      nextIsActive &&
      nextUnitPrice > 0 &&
      (updates.isActive === true || typeof updates.unitPriceCents === "number");

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
            error: formatPaidSalesGateMessage(gate, "Para vender serviços pagos,"),
            missingEmail: gate.missingEmail,
            missingStripe: gate.missingStripe,
          },
          { status: 403 },
        );
      }
    }

    const service = await prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.service.update({
          where: { id: serviceId },
          data: updates,
          select: { id: true },
        });
      }

      if (professionalIds !== null) {
        await tx.serviceProfessionalLink.deleteMany({ where: { serviceId } });
        if (professionalIds.length > 0) {
          await tx.serviceProfessionalLink.createMany({
            data: professionalIds.map((professionalId) => ({
              serviceId,
              professionalId,
            })),
          });
        }
      }

      if (resourceIds !== null) {
        await tx.serviceResourceLink.deleteMany({ where: { serviceId } });
        if (resourceIds.length > 0) {
          await tx.serviceResourceLink.createMany({
            data: resourceIds.map((resourceId) => ({
              serviceId,
              resourceId,
            })),
          });
        }
      }

      return tx.service.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          policyId: true,
          kind: true,
          instructorId: true,
          title: true,
          description: true,
          durationMinutes: true,
          unitPriceCents: true,
          currency: true,
          isActive: true,
          categoryTag: true,
          coverImageUrl: true,
          locationMode: true,
          defaultLocationText: true,
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
        },
      });
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_UPDATED",
      metadata: {
        serviceId: service.id,
        updates,
        professionalIds: professionalIds ?? undefined,
        resourceIds: resourceIds ?? undefined,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true, service });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/servicos/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar serviço." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const serviceId = parseServiceId(resolved.id);
  if (!serviceId) {
    return NextResponse.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const existing = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    await prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_DISABLED",
      metadata: { serviceId },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/servicos/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover serviço." }, { status: 500 });
  }
}
