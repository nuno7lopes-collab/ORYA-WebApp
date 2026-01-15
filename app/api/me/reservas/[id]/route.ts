import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(
  _req: Request,
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

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: user.id },
      select: {
        id: true,
        status: true,
        startsAt: true,
        pendingExpiresAt: true,
        paymentIntentId: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ ok: false, error: "Reserva não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, booking });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/reservas/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar reserva." }, { status: 500 });
  }
}
