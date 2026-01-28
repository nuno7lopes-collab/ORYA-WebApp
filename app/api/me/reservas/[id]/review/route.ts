import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const bookingId = parseId(resolved.id);
  if (!bookingId) {
    return jsonWrap({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const payload = await req.json().catch(() => ({}));
    const rating = Number(payload?.rating);
    const comment = typeof payload?.comment === "string" ? payload.comment.trim() : "";

    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return jsonWrap({ ok: false, error: "Rating inválido." }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        userId: true,
        serviceId: true,
        organizationId: true,
        status: true,
      },
    });

    if (!booking) {
      return jsonWrap({ ok: false, error: "Reserva não encontrada." }, { status: 404 });
    }
    if (booking.userId !== user.id) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    if (booking.status !== "COMPLETED") {
      return jsonWrap({ ok: false, error: "Reserva ainda não concluída." }, { status: 409 });
    }

    const existing = await prisma.serviceReview.findFirst({
      where: { bookingId: booking.id },
      select: { id: true },
    });
    if (existing) {
      return jsonWrap({ ok: false, error: "Review já submetida." }, { status: 409 });
    }

    const review = await prisma.serviceReview.create({
      data: {
        bookingId: booking.id,
        serviceId: booking.serviceId,
        organizationId: booking.organizationId,
        userId: user.id,
        rating,
        comment: comment || null,
        isVerified: true,
      },
    });

    return jsonWrap({ ok: true, review });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/reservas/[id]/review error:", err);
    return jsonWrap({ ok: false, error: "Erro ao guardar review." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);