export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { notifyBroadcast } from "@/domain/notifications/producer";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournamentId = Number(params?.id);
  if (!Number.isFinite(tournamentId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { message?: string; audienceKey?: string } | null;
  const message = body?.message?.trim();
  const audienceKey = body?.audienceKey?.trim() || "ALL";

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizerId: true, eventId: true },
  });
  if (!tournament?.organizerId) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: tournament.organizerId,
    roles: ["OWNER", "CO_OWNER", "ADMIN"],
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const entries = await prisma.tournamentEntry.findMany({
    where: { eventId: tournament.eventId },
    select: { userId: true },
  });
  const audienceUserIds = Array.from(new Set(entries.map((e) => e.userId).filter(Boolean) as string[]));

  if (audienceUserIds.length) {
    await Promise.all(
      audienceUserIds.map((uid) =>
        notifyBroadcast({
          userId: uid,
          tournamentId,
          broadcastId: crypto.randomUUID(),
          audienceKey,
        }),
      ),
    );
  }

  // Armazena feed de avisos (simples)
  await prisma.notificationOutbox.create({
    data: {
      notificationType: "BROADCAST",
      dedupeKey: `${tournamentId}:BROADCAST:${Date.now()}`,
      payload: { message: message || "Aviso do organizador", tournamentId },
      status: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, audienceCount: audienceUserIds.length }, { status: 200 });
}
