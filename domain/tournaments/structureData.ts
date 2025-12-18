import "server-only";
import { prisma } from "@/lib/prisma";

export async function getTournamentStructure(tournamentId: number) {
  return prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: {
          groups: { orderBy: { order: "asc" }, include: { matches: true } },
          matches: true,
        },
      },
      event: { select: { id: true, title: true, slug: true, startsAt: true } },
    },
  });
}
