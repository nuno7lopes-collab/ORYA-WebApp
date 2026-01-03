import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { decideCancellation } from "@/lib/bookingCancellation";
import { recordOrganizationAudit } from "@/lib/organizationAudit";

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
    const payload = await req.json().catch(() => ({}));
    const reason = typeof payload?.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
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
          service: {
            select: {
              id: true,
              organizationId: true,
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

      if (booking.userId !== user.id) {
        return { error: NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 }) };
      }

      if (booking.status === "CANCELLED") {
        return { booking, policy: booking.policyRef?.policy ?? booking.service?.policy ?? null, already: true };
      }

      const fallbackPolicy = booking.organizationId
        ? await tx.organizationPolicy.findFirst({
            where: { organizationId: booking.organizationId, policyType: "MODERATE" },
            select: {
              id: true,
              name: true,
              policyType: true,
              cancellationWindowMinutes: true,
            },
          })
        : null;

      const policy =
        booking.policyRef?.policy ?? booking.service?.policy ?? fallbackPolicy ?? null;

      const decision = decideCancellation(
        booking.startsAt,
        policy?.cancellationWindowMinutes ?? null,
        now,
      );

      if (!decision.allowed) {
        const message =
          decision.reason === "ALREADY_STARTED"
            ? "A reserva já começou."
            : decision.reason === "WINDOW_EXPIRED"
              ? "O prazo de cancelamento já passou."
              : "Esta reserva não permite cancelamento.";
        return { error: NextResponse.json({ ok: false, error: message }, { status: 400 }) };
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
        organizationId: booking.organizationId,
        actorUserId: user.id,
        action: "BOOKING_CANCELLED",
        metadata: {
          bookingId: booking.id,
          serviceId: booking.serviceId,
          availabilityId: booking.availabilityId,
          source: "USER",
          policyId: policy?.id ?? null,
          reason,
          deadline: decision.deadline ? decision.deadline.toISOString() : null,
        },
        ip,
        userAgent,
      });

      return { booking: updated, policy, decision, already: false };
    });

    if ("error" in result) return result.error;

    return NextResponse.json({
      ok: true,
      booking: {
        id: result.booking.id,
        status: result.booking.status,
      },
      policy: result.policy,
      alreadyCancelled: result.already,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/reservas/[id]/cancel error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao cancelar reserva." }, { status: 500 });
  }
}
