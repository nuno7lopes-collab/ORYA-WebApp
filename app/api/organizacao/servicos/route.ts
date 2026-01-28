import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
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

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return jsonWrap(
        { ok: false, error: "Perfil não encontrado." },
        { status: 403 }
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return jsonWrap({ ok: false, error: reservasAccess.error }, { status: 403 });
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

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/servicos error:", err);
    return jsonWrap(
      { ok: false, error: "Erro ao carregar serviços." },
      { status: 500 }
    );
  }
}

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return jsonWrap(
        { ok: false, error: "Perfil não encontrado." },
        { status: 403 }
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
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
      return jsonWrap({ ok: false, error: "Duração inválida (30/60/90/120 min)." }, { status: 400 });
    }
    if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
      return jsonWrap({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    let policyId: number | null = null;
    if (Number.isFinite(policyIdRaw)) {
      const policy = await prisma.organizationPolicy.findFirst({
        where: { id: policyIdRaw, organizationId: organization.id },
        select: { id: true },
      });
      if (!policy) {
        return jsonWrap({ ok: false, error: "Política inválida." }, { status: 400 });
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
      return jsonWrap({ ok: false, error: "Localização inválida." }, { status: 400 });
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

    return jsonWrap({ ok: true, service }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/servicos error:", err);
    return jsonWrap(
      { ok: false, error: "Erro ao criar serviço." },
      { status: 500 }
    );
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);