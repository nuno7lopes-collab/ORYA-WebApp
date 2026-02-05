import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const ctx = getRequestContext(req);
  const fail = (status: number, message: string, errorCode = "ERROR") =>
    respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });

  const resolved = await params;
  const token = resolved.token?.trim();
  if (!token) {
    return fail(400, "Token inválido.", "TOKEN_INVALID");
  }

  try {
    const charge = await prisma.bookingCharge.findUnique({
      where: { token },
      select: {
        id: true,
        status: true,
        kind: true,
        payerKind: true,
        label: true,
        amountCents: true,
        currency: true,
        paymentIntentId: true,
        paidAt: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            startsAt: true,
            durationMinutes: true,
            status: true,
            snapshotTimezone: true,
            locationText: true,
            service: { select: { id: true, title: true } },
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

    if (!charge) {
      return fail(404, "Cobrança não encontrada.", "CHARGE_NOT_FOUND");
    }

    return respondOk(ctx, {
      charge: {
        id: charge.id,
        status: charge.status,
        kind: charge.kind,
        payerKind: charge.payerKind,
        label: charge.label,
        amountCents: charge.amountCents,
        currency: charge.currency,
        paymentIntentId: charge.paymentIntentId,
        paidAt: charge.paidAt,
        createdAt: charge.createdAt,
      },
      booking: {
        id: charge.booking.id,
        startsAt: charge.booking.startsAt,
        durationMinutes: charge.booking.durationMinutes,
        status: charge.booking.status,
        snapshotTimezone: charge.booking.snapshotTimezone,
        locationText: charge.booking.locationText,
      },
      service: charge.booking.service,
      organization: charge.booking.organization,
    });
  } catch (err) {
    console.error("GET /api/cobrancas/[token] error:", err);
    return fail(500, "Erro ao carregar cobrança.", "CHARGE_LOAD_FAILED");
  }
}

export const GET = withApiEnvelope(_GET);
