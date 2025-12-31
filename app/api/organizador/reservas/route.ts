import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { OrganizerMemberRole } from "@prisma/client";

const ALLOWED_ROLES: OrganizerMemberRole[] = [
  OrganizerMemberRole.OWNER,
  OrganizerMemberRole.CO_OWNER,
  OrganizerMemberRole.ADMIN,
  OrganizerMemberRole.STAFF,
];

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(profile.id, {
      organizerId: organizerId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });

    if (!organizer || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const items = await prisma.booking.findMany({
      where: {
        organizerId: organizer.id,
        status: { in: ["PENDING", "CONFIRMED", "CANCELLED"] },
      },
      orderBy: { startsAt: "asc" },
      take: 50,
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        price: true,
        currency: true,
        createdAt: true,
        service: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizador/reservas error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar reservas." }, { status: 500 });
  }
}
