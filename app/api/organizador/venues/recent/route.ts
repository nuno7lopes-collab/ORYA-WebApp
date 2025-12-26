import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 401 });
    }

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(profile.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organizer || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const venues = await prisma.event.findMany({
      where: {
        organizerId: organizer.id,
        isDeleted: false,
        locationName: {
          not: "",
          ...(q
            ? {
                contains: q,
                mode: "insensitive",
              }
            : {}),
        },
      },
      select: { locationName: true, locationCity: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const unique = new Map<string, { name: string; city?: string | null }>();
    venues.forEach((row) => {
      if (!row.locationName) return;
      const key = `${row.locationName.toLowerCase()}__${(row.locationCity || "").toLowerCase()}`;
      if (!unique.has(key)) {
        unique.set(key, { name: row.locationName, city: row.locationCity });
      }
    });

    return NextResponse.json({ ok: true, items: Array.from(unique.values()) });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizador/venues/recent error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar locais recentes." }, { status: 500 });
  }
}
