export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { queueTournamentEve } from "@/domain/notifications/tournament";

/**
 * Cron endpoint para reminder véspera do torneio.
 * Critério: eventos com startsAt nas próximas 36h e com tournament configurado.
 */
export async function POST() {
  const now = new Date();
  const in36h = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const tournaments = await prisma.tournament.findMany({
    where: {
      event: {
        startsAt: { gt: now, lt: in36h },
        isDeleted: false,
      },
    },
    select: {
      id: true,
      eventId: true,
      event: { select: { startsAt: true, title: true } },
    },
  });

  let notified = 0;
  for (const t of tournaments) {
    const entries = await prisma.tournamentEntry.findMany({
      where: { eventId: t.eventId },
      select: { userId: true },
    });
    const userIds = Array.from(new Set(entries.map((e) => e.userId).filter(Boolean) as string[]));
    if (userIds.length > 0) {
      await queueTournamentEve(userIds, t.id);
      notified += userIds.length;
    }
  }

  return NextResponse.json({ ok: true, tournaments: tournaments.length, notified });
}
