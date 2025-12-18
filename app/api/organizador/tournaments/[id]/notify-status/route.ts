export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";
import { prisma } from "@/lib/prisma";
import { queueEliminated, queueChampion } from "@/domain/notifications/tournament";

/**
 * Endpoint manual para disparar notificações de eliminado/campeão.
 * Útil enquanto não há integração automática com standings finais.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournamentId = Number(params?.id);
  if (!Number.isFinite(tournamentId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as {
    eliminatedUserIds?: string[];
    championUserIds?: string[];
  } | null;
  const eliminatedUserIds = Array.isArray(body?.eliminatedUserIds) ? body?.eliminatedUserIds.filter(Boolean) as string[] : [];
  const championUserIds = Array.isArray(body?.championUserIds) ? body?.championUserIds.filter(Boolean) as string[] : [];

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true, eventId: true },
  });
  if (!tournament?.organizerId) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
    organizerId: tournament.organizerId,
    roles: ["OWNER", "CO_OWNER", "ADMIN"],
  });
  if (!organizer || !membership || !isOrgAdminOrAbove(membership.role)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (eliminatedUserIds.length) {
    await queueEliminated(eliminatedUserIds, tournamentId);
  }
  if (championUserIds.length) {
    await queueChampion(championUserIds, tournamentId);
  }

  return NextResponse.json(
    { ok: true, eliminated: eliminatedUserIds.length, champions: championUserIds.length },
    { status: 200 },
  );
}
