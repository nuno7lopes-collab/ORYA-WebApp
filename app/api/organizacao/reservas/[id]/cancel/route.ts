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
  { params }: { params: { id: string } },
) {
  const bookingId = parseId(params.id);
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

    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, organizationId: organization.id },
        include: {
          availability: true,
          policyRef: {
            select: {
              policy: {
                select: {
                  id: true,
                  name: true,
                  policyType: true,
                  cancellationWindowMinutes: true,
                },
              },
            },
          },
        },
      });

      if (!booking) {
        return { error: NextResponse.json({ ok: false, error: "Reserva não encontrada." }, { status: 404 }) };
      }

      if (booking.status === "CANCELLED") {
        return { booking, already: true };
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
      });

      if (booking.availability && booking.availability.status !== "CANCELLED") {
        const activeCount = await tx.booking.count({
          where: { availabilityId: booking.availability.id, status: { not: "CANCELLED" } },
        });
        if (activeCount < booking.availability.capacity && booking.availability.status === "FULL") {
          await tx.availability.update({
            where: { id: booking.availability.id },
            data: { status: "OPEN" },
          });
        }
      }

      await recordOrganizationAudit(tx, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "BOOKING_CANCELLED",
        metadata: {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          availabilityId: booking.availabilityId,
          source: "ORG",
          actorRole: membership.role,
          policyId: booking.policyRef?.policy?.id ?? null,
          reason,
        },
        ip,
        userAgent,
      });

      return { booking: updated, already: false };
    });

    if ("error" in result) return result.error;

    return NextResponse.json({
      ok: true,
      booking: { id: result.booking.id, status: result.booking.status },
      alreadyCancelled: result.already,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/reservas/[id]/cancel error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao cancelar reserva." }, { status: 500 });
  }
}
