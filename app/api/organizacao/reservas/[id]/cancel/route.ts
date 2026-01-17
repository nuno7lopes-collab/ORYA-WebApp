import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { OrganizationMemberRole } from "@prisma/client";
import { refundBookingPayment } from "@/lib/reservas/bookingRefund";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { decideCancellation } from "@/lib/bookingCancellation";

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

    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, organizationId: organization.id },
        include: {
          service: {
            select: {
              id: true,
              policyId: true,
              policy: { select: { id: true, cancellationWindowMinutes: true } },
            },
          },
          professional: { select: { userId: true } },
          policyRef: {
            select: {
              policy: { select: { id: true, cancellationWindowMinutes: true } },
            },
          },
        },
      });

      if (!booking) {
        return { error: NextResponse.json({ ok: false, error: "Reserva não encontrada." }, { status: 404 }) };
      }
      if (
        membership.role === OrganizationMemberRole.STAFF &&
        (!booking.professional?.userId || booking.professional.userId !== profile.id)
      ) {
        return { error: NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 }) };
      }
      if (["CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG", "CANCELLED"].includes(booking.status)) {
        return { booking, already: true };
      }

      const isPending = ["PENDING_CONFIRMATION", "PENDING"].includes(booking.status);
      const fallbackPolicy =
        booking.service?.policyId &&
        (await tx.organizationPolicy.findFirst({
          where: { id: booking.service.policyId, organizationId: booking.organizationId },
          select: { id: true, cancellationWindowMinutes: true },
        }));
      const policy =
        booking.policyRef?.policy ??
        booking.service?.policy ??
        fallbackPolicy ??
        (await tx.organizationPolicy.findFirst({
          where: { organizationId: booking.organizationId, policyType: "MODERATE" },
          select: { id: true, cancellationWindowMinutes: true },
        })) ??
        (await tx.organizationPolicy.findFirst({
          where: { organizationId: booking.organizationId },
          orderBy: { createdAt: "asc" },
          select: { id: true, cancellationWindowMinutes: true },
        }));

      const decision = decideCancellation(
        booking.startsAt,
        policy?.cancellationWindowMinutes ?? null,
        new Date(),
      );

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED_BY_ORG" },
      });
      const refundRequired =
        !!booking.paymentIntentId &&
        (isPending || (booking.status === "CONFIRMED" && decision.allowed));

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
          reason,
          refundRequired,
          deadline: decision.deadline?.toISOString() ?? null,
        },
        ip,
        userAgent,
      });

      return { booking: updated, already: false, refundRequired, paymentIntentId: booking.paymentIntentId };
    });

    if ("error" in result) return result.error;

    if (result.refundRequired && result.paymentIntentId) {
      try {
        await refundBookingPayment({
          bookingId: result.booking.id,
          paymentIntentId: result.paymentIntentId,
          reason: "ORG_CANCEL",
        });
      } catch (refundErr) {
        console.error("[organizacao/cancel] refund failed", refundErr);
        return NextResponse.json({ ok: false, error: "Reserva cancelada, mas o reembolso falhou." }, { status: 502 });
      }
    }

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
