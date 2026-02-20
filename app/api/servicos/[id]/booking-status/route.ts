export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { normalizeEmail } from "@/lib/utils/email";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { rateLimit } from "@/lib/auth/rateLimit";

const BOOKING_STATUS_IP_WINDOW_MS = 60 * 1000;
const BOOKING_STATUS_IP_MAX = 40;
const BOOKING_STATUS_EMAIL_WINDOW_MS = 60 * 1000;
const BOOKING_STATUS_EMAIL_MAX = 12;

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const serviceId = Number(resolved.id);
  if (!Number.isFinite(serviceId)) {
    return jsonWrap({ ok: false, error: "SERVICO_INVALIDO" }, { status: 400 });
  }

  const url = new URL(req.url);
  const bookingIdRaw = url.searchParams.get("bookingId");
  const guestEmailRaw = url.searchParams.get("guestEmail") ?? "";
  const bookingId = bookingIdRaw ? Number(bookingIdRaw) : NaN;
  if (!Number.isFinite(bookingId)) {
    return jsonWrap({ ok: false, error: "RESERVA_INVALIDA" }, { status: 400 });
  }
  const guestEmail = normalizeEmail(guestEmailRaw);
  if (!guestEmail) {
    return jsonWrap({ ok: false, error: "GUEST_EMAIL_REQUIRED" }, { status: 400 });
  }

  try {
    const ipLimiter = await rateLimit(req, {
      windowMs: BOOKING_STATUS_IP_WINDOW_MS,
      max: BOOKING_STATUS_IP_MAX,
      keyPrefix: "servicos:booking-status:ip",
    });
    if (!ipLimiter.allowed) {
      return jsonWrap(
        { ok: false, error: "THROTTLED" },
        { status: 429, headers: { "Retry-After": String(ipLimiter.retryAfter) } },
      );
    }

    const emailLimiter = await rateLimit(req, {
      windowMs: BOOKING_STATUS_EMAIL_WINDOW_MS,
      max: BOOKING_STATUS_EMAIL_MAX,
      keyPrefix: "servicos:booking-status:email",
      identifier: `${serviceId}:${guestEmail}`,
    });
    if (!emailLimiter.allowed) {
      return jsonWrap(
        { ok: false, error: "THROTTLED" },
        { status: 429, headers: { "Retry-After": String(emailLimiter.retryAfter) } },
      );
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        serviceId,
        guestEmail,
      },
      select: { status: true },
    });

    if (!booking) {
      return jsonWrap({ ok: false, error: "RESERVA_NAO_ENCONTRADA" }, { status: 404 });
    }

    return jsonWrap({ ok: true, booking }, { status: 200 });
  } catch (err) {
    console.error("GET /api/servicos/[id]/booking-status error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
