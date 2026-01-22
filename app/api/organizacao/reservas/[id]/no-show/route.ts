import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { createNotification, shouldNotify } from "@/lib/notifications";
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
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

    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: organization.id },
      include: {
        professional: { select: { userId: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "Reserva não encontrada." }, { status: 404 });
    }
    if (
      membership.role === OrganizationMemberRole.STAFF &&
      (!booking.professional?.userId || booking.professional.userId !== profile.id)
    ) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "COMPLETED", "DISPUTED", "NO_SHOW"].includes(booking.status)) {
      return NextResponse.json({ ok: false, error: "Reserva já encerrada." }, { status: 409 });
    }

    if (booking.startsAt > new Date()) {
      return NextResponse.json({ ok: false, error: "Reserva ainda não ocorreu." }, { status: 409 });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "NO_SHOW" },
      select: { id: true, status: true },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "BOOKING_NO_SHOW",
      metadata: {
        bookingId: booking.id,
        serviceId: booking.serviceId,
        actorRole: membership.role,
      },
      ip,
      userAgent,
    });

    if (booking.userId) {
      const shouldSend = await shouldNotify(booking.userId, "SYSTEM_ANNOUNCE");
      if (shouldSend) {
        await createNotification({
          userId: booking.userId,
          type: "SYSTEM_ANNOUNCE",
          title: "Reserva marcada como no-show",
          body: "A tua reserva foi marcada como não compareceu.",
          ctaUrl: "/me/reservas",
          ctaLabel: "Ver reservas",
          organizationId: organization.id,
        });
      }
    }

    return NextResponse.json({ ok: true, booking: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/reservas/[id]/no-show error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar reserva." }, { status: 500 });
  }
}
