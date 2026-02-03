import "server-only";
import { prisma } from "@/lib/prisma";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";

export async function getTournamentStructure(tournamentId: number) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      format: true,
      tieBreakRules: true,
      generationSeed: true,
      stages: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          stageType: true,
          groups: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              name: true,
              matches: {
                select: {
                  id: true,
                  groupId: true,
                  pairing1Id: true,
                  pairing2Id: true,
                  round: true,
                  startAt: true,
                  status: true,
                },
              },
            },
          },
          matches: {
            select: {
              id: true,
              groupId: true,
              pairing1Id: true,
              pairing2Id: true,
              round: true,
              startAt: true,
              status: true,
            },
          },
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          startsAt: true,
          pricingMode: true,
          ticketTypes: { select: { price: true } },
        },
      },
    },
  });

  if (!tournament) return null;

  if (!tournament.event) return tournament;

  const isGratis = deriveIsFreeEvent({
    pricingMode: tournament.event.pricingMode ?? undefined,
    ticketPrices: tournament.event.ticketTypes.map((t) => t.price ?? 0),
  });

  return {
    ...tournament,
    event: {
      id: tournament.event.id,
      title: tournament.event.title,
      slug: tournament.event.slug,
      startsAt: tournament.event.startsAt,
      isGratis,
    },
  };
}
