import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const invitations = await prisma.staffAssignment.findMany({
      where: {
        userId: user.id,
        status: "PENDING",
        revokedAt: null,
      },
      include: {
        event: true,
        organizer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const payload = invitations.map((inv) => ({
      id: inv.id,
      scope: inv.scope,
      eventId: inv.eventId,
      createdAt: inv.createdAt,
      event: inv.event
        ? {
            id: inv.event.id,
            title: inv.event.title,
            startsAt: inv.event.startsAt,
            locationName: inv.event.locationName,
            locationCity: inv.event.locationCity,
          }
        : null,
      organizer: inv.organizer
        ? {
            id: inv.organizer.id,
            publicName: inv.organizer.publicName,
          }
        : null,
    }));

    return NextResponse.json({ ok: true, invitations: payload }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("[staff/invitations] error:", err);
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
