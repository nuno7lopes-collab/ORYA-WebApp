// app/api/organizador/staff/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizerProfile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!organizerProfile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 400 },
      );
    }

    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organizer || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json(
        { ok: false, error: "Ainda não és organizador." },
        { status: 403 },
      );
    }

    const assignments = await prisma.staffAssignment.findMany({
      where: { organizerId: organizer.id },
      include: {
        event: true,
        organizer: false,
      },
      orderBy: { createdAt: "desc" },
    });

    const staffProfiles = await prisma.profile.findMany({
      where: { id: { in: assignments.map((a) => a.userId) } },
    });
    const staffMap = Object.fromEntries(staffProfiles.map((p) => [p.id, p]));

    const items = assignments.map((a) => ({
      id: a.id,
      userId: a.userId,
      scope: a.scope,
      eventId: a.eventId,
      createdAt: a.createdAt,
      revokedAt: a.revokedAt,
      status: a.revokedAt ? "REVOKED" : a.status,
      userName: staffMap[a.userId]?.fullName ?? staffMap[a.userId]?.username ?? null,
      userEmail: staffMap[a.userId]?.email ?? null,
      eventTitle: a.event?.title ?? null,
      role: a.role,
    }));

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizador/staff/list error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar staff." },
      { status: 500 },
    );
  }
}
