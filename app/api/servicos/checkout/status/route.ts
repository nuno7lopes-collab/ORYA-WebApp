export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { fulfillServiceBookingIntent } from "@/lib/operations/fulfillServiceBooking";

function parseId(raw: string | null) {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export async function GET(req: NextRequest) {
  const paymentIntentId = req.nextUrl.searchParams.get("paymentIntentId")?.trim() || null;
  const bookingId = parseId(req.nextUrl.searchParams.get("bookingId"));

  if (!paymentIntentId && !bookingId) {
    return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    let booking = await prisma.booking.findFirst({
      where: {
        ...(bookingId ? { id: bookingId } : {}),
        ...(paymentIntentId ? { paymentIntentId } : {}),
      },
      include: {
        availability: { select: { id: true, capacity: true, status: true } },
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
          select: { id: true, name: true, price: true, currency: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (booking.userId !== user.id) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (booking.status === "PENDING" && booking.paymentIntentId) {
      try {
        const intent = await stripe.paymentIntents.retrieve(booking.paymentIntentId, {
          expand: ["latest_charge"],
        });
        if (intent.status === "succeeded") {
          await fulfillServiceBookingIntent(intent);
          booking = await prisma.booking.findFirst({
            where: { id: booking.id },
            include: {
              availability: { select: { id: true, capacity: true, status: true } },
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
                select: { id: true, name: true, price: true, currency: true },
              },
            },
          });
          if (!booking) {
            return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
          }
        }
      } catch (err) {
        console.warn("[servicos/checkout/status] falha ao confirmar pagamento", err);
      }
    }

    if (!booking) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const final = booking.status === "CONFIRMED" || booking.status === "CANCELLED";

    return NextResponse.json({
      ok: true,
      status: booking.status,
      final,
      booking: {
        id: booking.id,
        status: booking.status,
        startsAt: booking.startsAt,
        durationMinutes: booking.durationMinutes,
        price: booking.price,
        currency: booking.currency,
        service: booking.service,
      },
      policy: booking.policyRef?.policy ?? null,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/servicos/checkout/status error:", err);
    return NextResponse.json({ ok: false, error: "STATUS_FAILED" }, { status: 500 });
  }
}
