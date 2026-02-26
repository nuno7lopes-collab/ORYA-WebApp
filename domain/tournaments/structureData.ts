import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveTicketPricingSummary } from "@/domain/events/ticketPricing";

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
          order: true,
          name: true,
          stageType: true,
          groups: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              name: true,
              matches: {
                select: {
                  id: true,
                  groupId: true,
                  pairing1Id: true,
                  pairing2Id: true,
                  round: true,
                  roundLabel: true,
                  startAt: true,
                  courtId: true,
                  status: true,
                  score: true,
                  nextMatchId: true,
                  nextSlot: true,
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
              roundLabel: true,
              startAt: true,
              courtId: true,
              status: true,
              score: true,
              nextMatchId: true,
              nextSlot: true,
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
          ticketTypes: {
            select: {
              price: true,
              status: true,
              totalQuantity: true,
              soldQuantity: true,
            },
          },
        },
      },
    },
  });

  if (!tournament) return null;

  if (!tournament.event) return tournament;

  const pricing = resolveTicketPricingSummary({
    pricingMode: tournament.event.pricingMode ?? undefined,
    ticketTypes: tournament.event.ticketTypes,
  });
  const isGratis = pricing.isGratis;

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
