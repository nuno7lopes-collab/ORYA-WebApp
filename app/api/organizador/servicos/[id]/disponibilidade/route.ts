import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { OrganizerMemberRole } from "@prisma/client";

const ALLOWED_ROLES: OrganizerMemberRole[] = [
  OrganizerMemberRole.OWNER,
  OrganizerMemberRole.CO_OWNER,
  OrganizerMemberRole.ADMIN,
  OrganizerMemberRole.STAFF,
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

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(profile.id, {
      organizerId: organizerId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organizer || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizerId: organizer.id },
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
    console.error("GET /api/organizador/servicos/[id]/disponibilidade error:", err);
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

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(profile.id, {
      organizerId: organizerId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organizer || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizerId: organizer.id },
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
    const capacity = Number(payload?.capacity ?? 1);

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
      organizerId: organizer.id,
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
    console.error("POST /api/organizador/servicos/[id]/disponibilidade error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar disponibilidade." }, { status: 500 });
  }
}
