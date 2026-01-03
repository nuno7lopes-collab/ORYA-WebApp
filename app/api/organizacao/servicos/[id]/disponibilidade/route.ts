import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const serviceId = parseServiceId(params.id);
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

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true },
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const items = await prisma.availability.findMany({
      where: { serviceId },
      orderBy: { startsAt: "asc" },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/servicos/[id]/disponibilidade error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar disponibilidade." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const serviceId = parseServiceId(params.id);
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

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId: organization.id },
      select: { id: true, durationMinutes: true },
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const startsAtRaw = payload?.startsAt;
    const parsedStart = startsAtRaw ? new Date(startsAtRaw) : null;
    if (!parsedStart || Number.isNaN(parsedStart.getTime())) {
      return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });
    }

    const durationMinutes = Number(payload?.durationMinutes ?? service.durationMinutes);
    const capacityRaw = Number(payload?.capacity ?? 1);
    const capacity = Number.isFinite(capacityRaw) ? Math.floor(capacityRaw) : capacityRaw;

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || !Number.isFinite(capacity) || capacity <= 0) {
      return NextResponse.json({ ok: false, error: "Valores inválidos." }, { status: 400 });
    }

    const availability = await prisma.availability.create({
      data: {
        serviceId,
        startsAt: parsedStart,
        durationMinutes,
        capacity,
        status: "OPEN",
      },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "AVAILABILITY_CREATED",
      metadata: {
        serviceId,
        availabilityId: availability.id,
        startsAt: parsedStart.toISOString(),
        durationMinutes,
        capacity,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true, availability }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/servicos/[id]/disponibilidade error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar disponibilidade." }, { status: 500 });
  }
}
