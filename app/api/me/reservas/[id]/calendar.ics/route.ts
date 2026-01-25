import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { buildIcsEvent } from "@/lib/calendar/ics";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

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
    return new Response("ID inválido", { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: user.id },
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        locationText: true,
        service: { select: { title: true, defaultLocationText: true } },
        organization: { select: { publicName: true, businessName: true } },
      },
    });

    if (!booking) {
      return new Response("Reserva não encontrada", { status: 404 });
    }

    const startsAt = booking.startsAt;
    const endsAt = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
    const title = `Reserva — ${booking.service?.title ?? "Serviço"}`;
    const location =
      booking.locationText ||
      booking.service?.defaultLocationText ||
      booking.organization?.publicName ||
      booking.organization?.businessName ||
      null;
    const baseUrl = getAppBaseUrl();
    const url = `${baseUrl}/me/reservas/${booking.id}`;

    const ics = buildIcsEvent({
      uid: `orya:reserva:${booking.id}@orya`,
      title,
      startsAt,
      endsAt,
      location,
      url,
    });

    return new Response(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"orya-reserva-${booking.id}.ics\"`,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return new Response("Não autenticado", { status: 401 });
    }
    console.error("GET /api/me/reservas/[id]/calendar.ics error:", err);
    return new Response("Erro ao gerar calendário", { status: 500 });
  }
}
