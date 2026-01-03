import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureDefaultPolicies } from "@/lib/organizationPolicies";
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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 403 }
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const items = await prisma.service.findMany({
      where: { organizationId: organization.id },
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
        _count: {
          select: { bookings: true, availabilities: true },
        },
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/servicos error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar serviços." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 403 }
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    await ensureDefaultPolicies(prisma, organization.id);

    const payload = await req.json().catch(() => ({}));
    const name = String(payload?.name ?? "").trim();
    const description = String(payload?.description ?? "").trim();
    const durationMinutes = Number(payload?.durationMinutes);
    const price = Number(payload?.price);
    const currency = String(payload?.currency ?? "EUR").trim().toUpperCase();
    const policyIdRaw = Number(payload?.policyId);

    if (!name || !Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(price) || price < 0) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    let policyId: number | null = null;
    if (Number.isFinite(policyIdRaw)) {
      const policy = await prisma.organizationPolicy.findFirst({
        where: { id: policyIdRaw, organizationId: organization.id },
        select: { id: true },
      });
      if (!policy) {
        return NextResponse.json({ ok: false, error: "Política inválida." }, { status: 400 });
      }
      policyId = policy.id;
    } else {
      const defaultPolicy = await prisma.organizationPolicy.findFirst({
        where: { organizationId: organization.id, policyType: "MODERATE" },
        select: { id: true },
      });
      policyId = defaultPolicy?.id ?? null;
    }

    const service = await prisma.service.create({
      data: {
        organizationId: organization.id,
        policyId,
        name,
        description: description || null,
        durationMinutes,
        price: Math.round(price),
        currency: currency || "EUR",
      },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "SERVICE_CREATED",
      metadata: {
        serviceId: service.id,
        name,
        durationMinutes,
        price: Math.round(price),
        currency: currency || "EUR",
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true, service }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/servicos error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao criar serviço." },
      { status: 500 }
    );
  }
}
