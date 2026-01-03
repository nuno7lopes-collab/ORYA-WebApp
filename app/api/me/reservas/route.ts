import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { decideCancellation } from "@/lib/bookingCancellation";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const bookings = await prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: [{ startsAt: "asc" }, { id: "desc" }],
      take: 200,
      select: {
        id: true,
        organizationId: true,
        availabilityId: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        price: true,
        currency: true,
        createdAt: true,
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
            name: true,
            policy: {
              select: {
                id: true,
                name: true,
                policyType: true,
                cancellationWindowMinutes: true,
              },
            },
            organization: {
              select: {
                id: true,
                publicName: true,
                businessName: true,
                city: true,
                username: true,
                brandingAvatarUrl: true,
              },
            },
          },
        },
      },
    });

    const organizationIds = Array.from(new Set(bookings.map((booking) => booking.organizationId)));
    const defaults = organizationIds.length
      ? await prisma.organizationPolicy.findMany({
          where: {
            organizationId: { in: organizationIds },
            policyType: "MODERATE",
          },
          select: {
            id: true,
            organizationId: true,
            name: true,
            policyType: true,
            cancellationWindowMinutes: true,
          },
        })
      : [];

    const defaultByOrganization = new Map<number, (typeof defaults)[number]>();
    defaults.forEach((policy) => {
      defaultByOrganization.set(policy.organizationId, policy);
    });

    const now = new Date();

    const items = bookings.map((booking) => {
      const policyRaw =
        booking.policyRef?.policy ??
        booking.service?.policy ??
        defaultByOrganization.get(booking.organizationId) ??
        null;

      const policy = policyRaw
        ? {
            id: policyRaw.id,
            name: policyRaw.name,
            policyType: policyRaw.policyType,
            cancellationWindowMinutes: policyRaw.cancellationWindowMinutes,
          }
        : null;

      const decision =
        booking.status === "CONFIRMED" || booking.status === "PENDING"
          ? decideCancellation(booking.startsAt, policy?.cancellationWindowMinutes ?? null, now)
          : { allowed: false, reason: null, deadline: null };

      return {
        id: booking.id,
        startsAt: booking.startsAt,
        durationMinutes: booking.durationMinutes,
        status: booking.status,
        price: booking.price,
        currency: booking.currency,
        createdAt: booking.createdAt,
        availabilityId: booking.availabilityId,
        service: booking.service ? { id: booking.service.id, name: booking.service.name } : null,
        organization: booking.service?.organization ?? null,
        policy,
        cancellation: {
          allowed: decision.allowed,
          reason: decision.reason,
          deadline: decision.deadline,
        },
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/me/reservas error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar reservas." }, { status: 500 });
  }
}
