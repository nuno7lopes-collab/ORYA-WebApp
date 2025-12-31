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

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function resolveContext(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);
  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) {
    return { error: NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 }) };
  }
  const organizerId = resolveOrganizerIdFromRequest(req);
  const { organizer, membership } = await getActiveOrganizerForUser(profile.id, {
    organizerId: organizerId ?? undefined,
    roles: [...ALLOWED_ROLES],
  });
  if (!organizer || !membership) {
    return { error: NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 }) };
  }
  return { organizer, actorUserId: profile.id };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; availabilityId: string } }
) {
  const serviceId = parseId(params.id);
  const availabilityId = parseId(params.availabilityId);
  if (!serviceId || !availabilityId) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const context = await resolveContext(req);
    if ("error" in context) return context.error;

    const availability = await prisma.availability.findFirst({
      where: {
        id: availabilityId,
        serviceId,
        service: { organizerId: context.organizer.id },
      },
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        capacity: true,
        status: true,
      },
    });

    if (!availability) {
      return NextResponse.json({ ok: false, error: "Horário não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, availability });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizador/servicos/[id]/disponibilidade/[availabilityId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar horário." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; availabilityId: string } }
) {
  const serviceId = parseId(params.id);
  const availabilityId = parseId(params.availabilityId);
  if (!serviceId || !availabilityId) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const context = await resolveContext(req);
    if ("error" in context) return context.error;

    const existing = await prisma.availability.findFirst({
      where: {
        id: availabilityId,
        serviceId,
        service: { organizerId: context.organizer.id },
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Horário não encontrado." }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (payload?.startsAt) {
      const parsed = new Date(payload.startsAt);
      if (!Number.isNaN(parsed.getTime())) updates.startsAt = parsed;
    }
    if (Number.isFinite(Number(payload?.durationMinutes))) updates.durationMinutes = Number(payload.durationMinutes);
    if (Number.isFinite(Number(payload?.capacity))) updates.capacity = Number(payload.capacity);
    if (typeof payload?.status === "string") updates.status = payload.status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: "Sem alterações." }, { status: 400 });
    }

    const availability = await prisma.availability.update({
      where: { id: availabilityId },
      data: updates,
    });

    return NextResponse.json({ ok: true, availability });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizador/servicos/[id]/disponibilidade/[availabilityId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar horário." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; availabilityId: string } }
) {
  const serviceId = parseId(params.id);
  const availabilityId = parseId(params.availabilityId);
  if (!serviceId || !availabilityId) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const context = await resolveContext(req);
    if ("error" in context) return context.error;

    const existing = await prisma.availability.findFirst({
      where: {
        id: availabilityId,
        serviceId,
        service: { organizerId: context.organizer.id },
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Horário não encontrado." }, { status: 404 });
    }

    const { ip, userAgent } = getRequestMeta(req);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.availability.update({
        where: { id: availabilityId },
        data: { status: "CANCELLED" },
      });

      const bookingUpdates = await tx.booking.updateMany({
        where: {
          availabilityId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        data: { status: "CANCELLED" },
      });

      await recordOrganizationAudit(tx, {
        organizerId: context.organizer.id,
        actorUserId: context.actorUserId,
        action: "AVAILABILITY_CANCELLED",
        metadata: {
          serviceId,
          availabilityId: updated.id,
          cancelledBookings: bookingUpdates.count,
        },
        ip,
        userAgent,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizador/servicos/[id]/disponibilidade/[availabilityId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao cancelar horário." }, { status: 500 });
  }
}
